// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {AgentSmartAccount, PackedUserOperation} from "../src/AgentSmartAccount.sol";

/// @dev 最小 ERC-20（只够测 approve 额度策略）。
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

/// @dev 一个能收 ETH 的目标合约，用来测 native 额度 + 选择器白名单。
contract PiggyBank {
    uint256 public total;

    function deposit() external payable {
        total += msg.value;
    }

    function poke() external pure returns (uint256) {
        return 42; // 故意不加进白名单
    }
}

/// @notice 验证 session key 策略：目标 / 选择器 / 单笔额度 / 每日额度 / ERC-20 授权额度 / 过期 / 撤销。
///         测试合约再次扮演 EntryPoint。
contract SessionKeyPolicyTest is Test {
    AgentSmartAccount internal account;
    MockERC20 internal token;
    PiggyBank internal piggy;

    uint256 internal ownerPk = 0xA11CE;
    address internal owner;

    uint256 internal agentPk = 0xA6E70; // agent 的 session key
    address internal agent;

    address internal escrow = address(0xE5C0);

    bytes4 internal constant APPROVE_SELECTOR = bytes4(keccak256("approve(address,uint256)"));

    function setUp() public {
        owner = vm.addr(ownerPk);
        agent = vm.addr(agentPk);

        account = new AgentSmartAccount(owner, address(this));
        token = new MockERC20();
        piggy = new PiggyBank();

        vm.deal(address(account), 10 ether);

        // 人类 owner 给 agent 发一把受限钥匙：7 天过期，单笔 ≤1 ETH，每日 ≤2 ETH。
        vm.startPrank(owner);
        account.registerSessionKey(agent, 0, uint48(block.timestamp + 7 days), 1 ether, 2 ether);
        // 只允许调 piggy.deposit 和 token.approve
        account.setSessionKeyTarget(agent, address(piggy), true);
        account.setSessionKeySelector(agent, PiggyBank.deposit.selector, true);
        account.setSessionKeyTarget(agent, address(token), true);
        account.setSessionKeySelector(agent, APPROVE_SELECTOR, true);
        // token 单笔授权上限 100e18
        account.setSessionKeyErc20Cap(agent, address(token), 100e18);
        vm.stopPrank();
    }

    // ---- 工具 ----

    function _executeCalldata(address target, uint256 value, bytes memory inner)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encodeWithSelector(AgentSmartAccount.execute.selector, target, value, inner);
    }

    function _op(bytes memory callData) internal view returns (PackedUserOperation memory op) {
        op.sender = address(account);
        op.callData = callData;
    }

    function _sign(bytes32 userOpHash, uint256 pk) internal pure returns (bytes memory) {
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    /// @dev agent 签一笔 execute(target,value,inner) 的 op，返回 validationData。
    function _validateAgentCall(address target, uint256 value, bytes memory inner, bytes32 h)
        internal
        returns (uint256)
    {
        PackedUserOperation memory op = _op(_executeCalldata(target, value, inner));
        op.signature = _sign(h, agentPk);
        return account.validateUserOp(op, h, 0);
    }

    function _isSuccess(uint256 vd) internal pure returns (bool) {
        return uint160(vd) == 0; // authorizer == 0
    }

    // ---- 白名单 ----

    function test_SessionKey_AllowedTargetAndSelector_Passes() public {
        uint256 vd =
            _validateAgentCall(address(piggy), 0.5 ether, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("d1"));
        assertTrue(_isSuccess(vd), "deposit within scope should pass");

        // 时间窗被正确打包
        uint48 validUntil = uint48(vd >> 160);
        assertEq(validUntil, uint48(block.timestamp + 7 days));

        // 真的能执行（EntryPoint 调 execute）
        account.execute(address(piggy), 0.5 ether, abi.encodeWithSelector(PiggyBank.deposit.selector));
        assertEq(piggy.total(), 0.5 ether);
    }

    function test_SessionKey_WrongTarget_Fails() public {
        uint256 vd = _validateAgentCall(
            address(0xBAD), 0, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("wt")
        );
        assertEq(vd, 1, "unlisted target must fail");
    }

    function test_SessionKey_WrongSelector_Fails() public {
        uint256 vd =
            _validateAgentCall(address(piggy), 0, abi.encodeWithSelector(PiggyBank.poke.selector), keccak256("ws"));
        assertEq(vd, 1, "unlisted selector must fail");
    }

    // ---- 额度 ----

    function test_SessionKey_PerCallCap_Fails() public {
        uint256 vd = _validateAgentCall(
            address(piggy), 2 ether, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("pc")
        );
        assertEq(vd, 1, "over per-call cap must fail");
    }

    function test_SessionKey_DailyCap_Accumulates() public {
        // 1 + 1 = 2 == dailyCap，前两笔通过
        assertTrue(
            _isSuccess(
                _validateAgentCall(address(piggy), 1 ether, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("a"))
            )
        );
        assertTrue(
            _isSuccess(
                _validateAgentCall(address(piggy), 1 ether, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("b"))
            )
        );
        // 第三笔哪怕 1 wei 也超日额度
        uint256 vd =
            _validateAgentCall(address(piggy), 1, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("c"));
        assertEq(vd, 1, "over daily cap must fail");
    }

    function test_SessionKey_DailyCap_ResetsNextDay() public {
        bytes memory deposit = abi.encodeWithSelector(PiggyBank.deposit.selector);

        // 第一天：两笔 1 ETH，恰好打满 2 ETH 日额度
        assertTrue(_isSuccess(_validateAgentCall(address(piggy), 1 ether, deposit, keccak256("d1a"))));
        assertTrue(_isSuccess(_validateAgentCall(address(piggy), 1 ether, deposit, keccak256("d1b"))));
        // 同一天第三笔应超额度
        assertEq(_validateAgentCall(address(piggy), 1 ether, deposit, keccak256("d1c")), 1);

        // 跨到第二天，额度重置：又能花 2 ETH
        vm.warp(block.timestamp + 1 days + 1);
        assertTrue(_isSuccess(_validateAgentCall(address(piggy), 1 ether, deposit, keccak256("d2a"))));
        assertTrue(_isSuccess(_validateAgentCall(address(piggy), 1 ether, deposit, keccak256("d2b"))));
    }

    // ---- ERC-20 授权额度 ----

    function test_SessionKey_Erc20Approve_UnderCap_Passes() public {
        bytes memory inner = abi.encodeWithSelector(APPROVE_SELECTOR, escrow, 50e18);
        uint256 vd = _validateAgentCall(address(token), 0, inner, keccak256("ap1"));
        assertTrue(_isSuccess(vd), "approve under cap should pass");
    }

    function test_SessionKey_Erc20Approve_OverCap_Fails() public {
        bytes memory inner = abi.encodeWithSelector(APPROVE_SELECTOR, escrow, 200e18);
        uint256 vd = _validateAgentCall(address(token), 0, inner, keccak256("ap2"));
        assertEq(vd, 1, "approve over cap must fail");
    }

    function test_SessionKey_Erc20Approve_MalformedLength_Fails() public {
        bytes memory normalApprove = abi.encodeWithSelector(APPROVE_SELECTOR, escrow, 50e18);
        bytes memory innerWithTrailingByte = bytes.concat(normalApprove, hex"00");

        uint256 vd = _validateAgentCall(address(token), 0, innerWithTrailingByte, keccak256("ap3"));
        assertEq(vd, 1, "approve with unexpected trailing calldata must fail");
    }

    // ---- 撤销 ----

    function test_SessionKey_Revoked_Fails() public {
        vm.prank(owner);
        account.revokeSessionKey(agent);

        uint256 vd = _validateAgentCall(
            address(piggy), 0.5 ether, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("rev")
        );
        assertEq(vd, 1, "revoked key must fail");
        assertFalse(account.isSessionKeyActive(agent));
    }

    // ---- 过期 ----

    function test_SessionKey_Expiry_ReflectedInActiveAndWindow() public {
        // 仍在有效期内：active
        assertTrue(account.isSessionKeyActive(agent));

        // 越过 validUntil
        vm.warp(block.timestamp + 8 days);
        assertFalse(account.isSessionKeyActive(agent), "should be inactive after validUntil");

        // 验证阶段仍会打包出（已过去的）validUntil，真实拦截由 EntryPoint 比对时间窗完成
        uint256 vd = _validateAgentCall(
            address(piggy), 0.1 ether, abi.encodeWithSelector(PiggyBank.deposit.selector), keccak256("exp")
        );
        uint48 validUntil = uint48(vd >> 160);
        assertLt(validUntil, uint48(block.timestamp), "validUntil is in the past -> EntryPoint would reject");
    }

    // ---- owner 是 root ----

    function test_Owner_BypassesSessionScope() public {
        // owner 直接签一个未在白名单里的调用（poke），依然有效
        PackedUserOperation memory op =
            _op(_executeCalldata(address(piggy), 0, abi.encodeWithSelector(PiggyBank.poke.selector)));
        bytes32 h = keccak256("owner-poke");
        op.signature = _sign(h, ownerPk);
        assertEq(account.validateUserOp(op, h, 0), 0, "owner is root");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {AgentSmartAccount, PackedUserOperation} from "../src/AgentSmartAccount.sol";
import {SessionKeyManager} from "../src/SessionKeyPolicy.sol";

/// @dev 一个总是 revert 的目标，用来测 execute 会不会把失败原因冒泡上来。
contract Reverter {
    error Boom(string reason);

    function explode() external pure {
        revert Boom("kaboom");
    }
}

/// @notice 本测试合约把自己当成 EntryPoint（部署账户时 entryPoint = address(this)），
///         这样不用真实 EntryPoint 也能直接调 validateUserOp / execute，看清账户内部逻辑。
contract AgentSmartAccountTest is Test {
    AgentSmartAccount internal account;

    uint256 internal ownerPk = 0xA11CE;
    address internal owner;

    function setUp() public {
        owner = vm.addr(ownerPk);
        account = new AgentSmartAccount(owner, address(this)); // entryPoint = 本测试合约
    }

    // ---- 工具函数 ----

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

    function _signUserOp(bytes32 userOpHash, uint256 pk) internal pure returns (bytes memory) {
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ---- 测试 ----

    function test_Constructor_SetsOwnerAndEntryPoint() public view {
        assertEq(account.owner(), owner);
        assertEq(account.entryPoint(), address(this));
    }

    function test_RevertWhen_OwnerIsZero() public {
        vm.expectRevert(AgentSmartAccount.InvalidOwner.selector);
        new AgentSmartAccount(address(0), address(this));
    }

    function test_OnlyEntryPointCanValidate() public {
        PackedUserOperation memory op = _op(_executeCalldata(address(0xBEEF), 0, ""));
        bytes32 h = keccak256("op");
        op.signature = _signUserOp(h, ownerPk);

        vm.prank(address(0xdead)); // 非 EntryPoint
        vm.expectRevert(AgentSmartAccount.NotEntryPoint.selector);
        account.validateUserOp(op, h, 0);
    }

    function test_OwnerSignedOp_IsValid() public {
        PackedUserOperation memory op = _op(_executeCalldata(address(0xBEEF), 0, ""));
        bytes32 h = keccak256("owner-op");
        op.signature = _signUserOp(h, ownerPk);

        uint256 vd = account.validateUserOp(op, h, 0);
        assertEq(vd, 0, "owner op should validate with 0");
    }

    function test_GarbageSignature_IsInvalid() public {
        PackedUserOperation memory op = _op(_executeCalldata(address(0xBEEF), 0, ""));
        bytes32 h = keccak256("bad");
        op.signature = abi.encodePacked(bytes32(uint256(1)), bytes32(uint256(2)), uint8(27));

        uint256 vd = account.validateUserOp(op, h, 0);
        assertEq(vd, 1, "garbage signature should be SIG_VALIDATION_FAILED");
    }

    function test_Execute_OnlyOwnerOrEntryPoint() public {
        vm.deal(address(account), 1 ether);

        // 随机地址不能调
        vm.prank(address(0xdead));
        vm.expectRevert(AgentSmartAccount.NotAuthorizedCaller.selector);
        account.execute(address(0xBEEF), 0, "");

        // owner 可以
        vm.prank(owner);
        account.execute(payable(address(0xBEEF)), 0.1 ether, "");
        assertEq(address(0xBEEF).balance, 0.1 ether);

        // EntryPoint（本合约）可以
        account.execute(payable(address(0xBEEF)), 0.1 ether, "");
        assertEq(address(0xBEEF).balance, 0.2 ether);
    }

    function test_Execute_BubblesUpRevert() public {
        Reverter r = new Reverter();
        bytes memory inner = abi.encodeWithSelector(Reverter.explode.selector);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Reverter.Boom.selector, "kaboom"));
        account.execute(address(r), 0, inner);
    }

    function test_EIP1271_AcceptsOwnerSignature() public view {
        bytes32 digest = keccak256("task-intent-digest");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerPk, digest); // EIP-712 摘要直接签，不加前缀
        bytes memory sig = abi.encodePacked(r, s, v);

        assertEq(account.isValidSignature(digest, sig), bytes4(0x1626ba7e));
    }

    function test_EIP1271_RejectsStranger() public view {
        bytes32 digest = keccak256("task-intent-digest");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(uint256(0xB0B), digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        assertEq(account.isValidSignature(digest, sig), bytes4(0xffffffff));
    }

    function test_SessionAdmin_OnlyOwner() public {
        vm.prank(address(0xdead));
        vm.expectRevert(SessionKeyManager.NotSessionAdmin.selector);
        account.registerSessionKey(address(0x1234), 0, uint48(block.timestamp + 1 days), 1 ether, 1 ether);
    }

    function test_TransferOwnership() public {
        address newOwner = vm.addr(0xC0FFEE);
        vm.prank(owner);
        account.transferOwnership(newOwner);
        assertEq(account.owner(), newOwner);
    }
}

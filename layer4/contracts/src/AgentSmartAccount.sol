// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {IERC1271} from "openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {SessionKeyManager} from "./SessionKeyPolicy.sol";

/// @dev EntryPoint v0.7 / v0.8 的 UserOperation 打包结构。
///      教学起见内联在这里，避免为一个最小账户引入整包 eth-infinitism/account-abstraction。
///      生产环境请直接继承官方 `BaseAccount`，别自己抄这个 struct。
struct PackedUserOperation {
    address sender;
    uint256 nonce;
    bytes initCode;
    bytes callData;
    bytes32 accountGasLimits;
    uint256 preVerificationGas;
    bytes32 gasFees;
    bytes paymasterAndData;
    bytes signature;
}

/// @dev ERC-4337 账户只需对 EntryPoint 暴露这一个验证入口。
interface IAccount {
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData);
}

/// @title AgentSmartAccount
/// @notice 一个“看得懂内部”的最小 ERC-4337 智能账户，专门为 agent 钱包演示：
///
///           - owner 是人类（root 权限，签名直接通过）。
///           - agent 拿到的是一把受限 session key（作用域 / 额度 / 过期 / 可撤销）。
///           - 账户在 `validateUserOp` 里强制 session key 策略：不满足就判签名无效。
///           - 账户实现 EIP-1271 `isValidSignature`，这样它可以作为 Layer 2 escrow 的
///             `client` 去签 `TaskIntent`（合约账户不能用 ECDSA.recover 直接验，必须走 1271）。
///
///         这不是生产级账户：没做 initCode/工厂、没做批量执行、没做模块化（ERC-7579）、
///         验证阶段的存储访问也没严格按 ERC-7562 收敛。它的目标是让你看清
///         “EntryPoint 调过来之后，一把受限钥匙到底是怎么在链上被拦住的”。
contract AgentSmartAccount is IAccount, IERC1271, SessionKeyManager {
    using MessageHashUtils for bytes32;

    address public owner;
    address public immutable entryPoint;

    uint256 internal constant SIG_VALIDATION_SUCCESS = 0;
    uint256 internal constant SIG_VALIDATION_FAILED = 1;

    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;
    bytes4 internal constant EXECUTE_SELECTOR = bytes4(keccak256("execute(address,uint256,bytes)"));

    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event Executed(address indexed target, uint256 value, bytes4 selector);

    error NotEntryPoint();
    error NotAuthorizedCaller();
    error InvalidOwner();

    constructor(address _owner, address _entryPoint) {
        if (_owner == address(0)) revert InvalidOwner();
        owner = _owner;
        entryPoint = _entryPoint;
        emit OwnerChanged(address(0), _owner);
    }

    receive() external payable {}

    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert NotEntryPoint();
        _;
    }

    /// @dev 只有人类 owner（或账户自身，通过 owner 的 op 自调用）能增删改 session key。
    function _authorizeSessionAdmin() internal view override {
        if (msg.sender != owner && msg.sender != address(this)) revert NotSessionAdmin();
    }

    function transferOwnership(address newOwner) external {
        if (msg.sender != owner && msg.sender != address(this)) revert NotAuthorizedCaller();
        if (newOwner == address(0)) revert InvalidOwner();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    // ------------------------------------------------------------------
    // ERC-4337：验证阶段
    // ------------------------------------------------------------------

    /// @notice EntryPoint 在打包 UserOperation 时调用。返回 0 表示签名有效、
    ///         非零最低位表示签名无效；高位打包了 validAfter / validUntil 时间窗。
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        onlyEntryPoint
        returns (uint256 validationData)
    {
        validationData = _validate(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }

    function _validate(PackedUserOperation calldata userOp, bytes32 userOpHash) internal returns (uint256) {
        bytes32 ethHash = userOpHash.toEthSignedMessageHash();
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(ethHash, userOp.signature);
        if (err != ECDSA.RecoverError.NoError || signer == address(0)) {
            return SIG_VALIDATION_FAILED;
        }

        // owner 是 root：无条件通过，且不受 session 策略约束。
        if (signer == owner) {
            return SIG_VALIDATION_SUCCESS;
        }

        // session key 路径：这把钥匙只能通过 execute(target,value,data) 干活。
        if (userOp.callData.length < 4 || bytes4(userOp.callData[0:4]) != EXECUTE_SELECTOR) {
            return SIG_VALIDATION_FAILED;
        }

        (address target, uint256 value, bytes memory innerCall) =
            abi.decode(userOp.callData[4:], (address, uint256, bytes));

        // 目标 / 选择器 / 单笔额度 / ERC-20 授权额度：任一不过 => 判签名无效。
        if (!_checkSessionScope(signer, target, value, innerCall)) {
            return SIG_VALIDATION_FAILED;
        }

        // 每日 native 额度记账（验证阶段写自己的存储，符合 ERC-4337）。
        if (!_consumeDailyBudget(signer, value)) {
            return SIG_VALIDATION_FAILED;
        }

        // 时间窗交给 EntryPoint 强制（validAfter / validUntil）。
        (uint48 validAfter, uint48 validUntil) = _sessionWindow(signer);
        return _packValidationData(validAfter, validUntil);
    }

    /// @dev 把成功的验证结果 + 时间窗打包成 ERC-4337 的 validationData。
    ///      低 160 位 authorizer = 0 表示成功；validUntil 在 [160,208)，validAfter 在 [208,256)。
    function _packValidationData(uint48 validAfter, uint48 validUntil) internal pure returns (uint256) {
        return (uint256(validUntil) << 160) | (uint256(validAfter) << 208);
    }

    /// @dev 给 EntryPoint 预付它垫付的 gas（缺多少补多少），失败不阻塞验证（按标准忽略返回值）。
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds == 0) return;
        (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
        (ok);
    }

    // ------------------------------------------------------------------
    // ERC-4337：执行阶段
    // ------------------------------------------------------------------

    /// @notice 真正对外发起一笔调用。EntryPoint（验证通过后）或 owner 可直接调用。
    ///         注意：策略在验证阶段已经强制过，这里不再重复判定。
    function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory) {
        if (msg.sender != entryPoint && msg.sender != owner && msg.sender != address(this)) {
            revert NotAuthorizedCaller();
        }

        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }

        emit Executed(target, value, data.length >= 4 ? bytes4(data[0:4]) : bytes4(0));
        return ret;
    }

    // ------------------------------------------------------------------
    // EIP-1271：让合约账户能“签”结构化消息（给 Layer 2 escrow 的 TaskIntent 用）
    // ------------------------------------------------------------------

    /// @notice 外部合约（如 escrow）通过它验证“这份签名对本账户是否有效”。
    ///         本最小实现只认 owner 的签名；扩展时可加“允许某 session key 代签”。
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hash, signature);
        if (err == ECDSA.RecoverError.NoError && signer == owner) {
            return ERC1271_MAGIC_VALUE;
        }
        return ERC1271_INVALID;
    }
}

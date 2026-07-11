// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SessionKeyManager
/// @notice session key 注册表 + 权限策略模块。它回答一个问题：
///         “这把 agent 钥匙，此刻能不能调这个合约的这个函数、花这么多钱？”
///
///         策略维度（本教学版本刻意做小、做清楚）：
///           1. 目标合约白名单（allowedTarget）：只能调指定合约
///           2. 函数选择器白名单（allowedSelector）：只能调指定函数
///           3. 时间边界（validAfter / validUntil）：N 天后自动失效
///           4. 单笔 native value 上限（perCallCap）
///           5. 每日 native value 上限（dailyCap，按自然日滚动）
///           6. 单笔 ERC-20 授权额度上限（erc20CallCap，针对 approve(address,uint256)）
///           7. 撤销（revoked）：人类一键作废这把钥匙
///
///         注意：真实生产里这类“花费上限”策略非常难做全（要覆盖 approve / transfer /
///         transferFrom / permit / 各种 DeFi 调用），一般用 Rhinestone、ZeroDev 等
///         成熟的 policy 模块。这里只教清楚“策略是怎么在链上被强制的”这件事本身。
abstract contract SessionKeyManager {
    struct SessionKey {
        bool registered; // 是否登记过（用于区分“未登记”和“额度为 0”）
        bool revoked; // 是否已被人类撤销
        uint48 validAfter; // 生效时间（Unix 秒），0 表示立即生效
        uint48 validUntil; // 过期时间（Unix 秒），0 表示永不过期（不推荐给 agent 用）
        uint256 perCallCap; // 单笔 native value 上限（wei）
        uint256 dailyCap; // 每日 native value 上限（wei）
        uint256 spentToday; // 当日已花 native value
        uint48 daySlot; // 当日窗口标识 = block.timestamp / 1 days
    }

    // key => 策略
    mapping(address sessionKey => SessionKey) internal _sessionKeys;
    // key => 目标合约 => 是否允许
    mapping(address sessionKey => mapping(address target => bool)) internal _allowedTarget;
    // key => 函数选择器 => 是否允许
    mapping(address sessionKey => mapping(bytes4 selector => bool)) internal _allowedSelector;
    // key => ERC-20 token => 单笔 approve 额度上限（0 表示该 token 未设上限，approve 一律拒绝，安全默认）
    mapping(address sessionKey => mapping(address token => uint256 cap)) internal _erc20CallCap;

    event SessionKeyRegistered(
        address indexed key, uint48 validAfter, uint48 validUntil, uint256 perCallCap, uint256 dailyCap
    );
    event SessionKeyRevoked(address indexed key);
    event SessionKeyTargetSet(address indexed key, address indexed target, bool allowed);
    event SessionKeySelectorSet(address indexed key, bytes4 indexed selector, bool allowed);
    event SessionKeyErc20CapSet(address indexed key, address indexed token, uint256 cap);

    error NotSessionAdmin();
    error InvalidSessionKey();
    error InvalidWindow();

    /// @dev 由具体账户实现：谁有权增删改 session key（本课程约定只有人类 owner）。
    function _authorizeSessionAdmin() internal view virtual;

    // ------------------------------------------------------------------
    // 管理入口（人类 owner 用）
    // ------------------------------------------------------------------

    /// @notice 登记 / 覆盖一把 session key 的基础策略。
    function registerSessionKey(
        address key,
        uint48 validAfter,
        uint48 validUntil,
        uint256 perCallCap,
        uint256 dailyCap
    ) external {
        _authorizeSessionAdmin();
        if (key == address(0)) revert InvalidSessionKey();
        // 过期时间必须晚于生效时间；给 agent 用的钥匙必须设过期。
        if (validUntil == 0 || (validAfter != 0 && validUntil <= validAfter)) revert InvalidWindow();

        SessionKey storage sk = _sessionKeys[key];
        sk.registered = true;
        sk.revoked = false;
        sk.validAfter = validAfter;
        sk.validUntil = validUntil;
        sk.perCallCap = perCallCap;
        sk.dailyCap = dailyCap;
        // 重新登记（轮换额度）时清空当日计数
        sk.spentToday = 0;
        sk.daySlot = uint48(block.timestamp / 1 days);

        emit SessionKeyRegistered(key, validAfter, validUntil, perCallCap, dailyCap);
    }

    /// @notice 一键撤销：撤销后这把钥匙的任何操作都会在链上被拒绝。
    function revokeSessionKey(address key) external {
        _authorizeSessionAdmin();
        _sessionKeys[key].revoked = true;
        emit SessionKeyRevoked(key);
    }

    function setSessionKeyTarget(address key, address target, bool allowed) external {
        _authorizeSessionAdmin();
        _allowedTarget[key][target] = allowed;
        emit SessionKeyTargetSet(key, target, allowed);
    }

    function setSessionKeySelector(address key, bytes4 selector, bool allowed) external {
        _authorizeSessionAdmin();
        _allowedSelector[key][selector] = allowed;
        emit SessionKeySelectorSet(key, selector, allowed);
    }

    function setSessionKeyErc20Cap(address key, address token, uint256 cap) external {
        _authorizeSessionAdmin();
        _erc20CallCap[key][token] = cap;
        emit SessionKeyErc20CapSet(key, token, cap);
    }

    // ------------------------------------------------------------------
    // 只读视图（前端“账户可视化”会用到）
    // ------------------------------------------------------------------

    function sessionKey(address key) external view returns (SessionKey memory) {
        return _sessionKeys[key];
    }

    function isSessionKeyActive(address key) public view returns (bool) {
        SessionKey storage sk = _sessionKeys[key];
        if (!sk.registered || sk.revoked) return false;
        if (sk.validAfter != 0 && block.timestamp < sk.validAfter) return false;
        if (sk.validUntil != 0 && block.timestamp > sk.validUntil) return false;
        return true;
    }

    function isTargetAllowed(address key, address target) external view returns (bool) {
        return _allowedTarget[key][target];
    }

    function isSelectorAllowed(address key, bytes4 selector) external view returns (bool) {
        return _allowedSelector[key][selector];
    }

    function erc20Cap(address key, address token) external view returns (uint256) {
        return _erc20CallCap[key][token];
    }

    // ------------------------------------------------------------------
    // 策略强制（供账户在验证阶段调用）
    // ------------------------------------------------------------------

    /// @dev 硬性范围检查：目标 / 选择器 / 撤销 / 单笔 native 上限 / ERC-20 授权上限。
    ///      这些都是“非黑即白”的失败，返回 false 让账户判定签名无效。
    ///      过期 / 未生效不在这里判，交给 ERC-4337 的 validationData 时间窗（更符合标准）。
    function _checkSessionScope(address key, address target, uint256 value, bytes memory innerCall)
        internal
        view
        returns (bool)
    {
        SessionKey storage sk = _sessionKeys[key];
        if (!sk.registered || sk.revoked) return false;
        if (!_allowedTarget[key][target]) return false;
        if (value > sk.perCallCap) return false;

        bytes4 selector = _selectorOf(innerCall);
        if (!_allowedSelector[key][selector]) return false;

        // 针对 approve(address,uint256) 做额度上限检查：解出金额，和该 token 的上限比。
        // approve 的 calldata 布局：selector(4) + spender(32) + amount(32)，总长必须刚好 68 字节，
        // amount 在偏移 36。教学版本采用严格长度，避免“带尾巴”的 calldata 绕过新手的理解模型。
        if (selector == 0x095ea7b3) {
            if (innerCall.length != 68) return false;
            uint256 amount = _wordAt(innerCall, 36);
            if (amount > _erc20CallCap[key][target]) return false;
        }

        return true;
    }

    /// @dev 读 memory bytes 的前 4 字节作为函数选择器。
    function _selectorOf(bytes memory data) internal pure returns (bytes4 sel) {
        if (data.length < 4) return bytes4(0);
        assembly {
            sel := mload(add(data, 32))
        }
    }

    /// @dev 读 memory bytes 在 byteOffset 处的 32 字节，作为 uint256。
    function _wordAt(bytes memory data, uint256 byteOffset) internal pure returns (uint256 word) {
        assembly {
            word := mload(add(add(data, 32), byteOffset))
        }
    }

    /// @dev 每日 native value 记账（状态写入）。ERC-4337 允许账户在验证阶段
    ///      读写“自己的关联存储”，所以把额度消耗放这里是合规的。
    function _consumeDailyBudget(address key, uint256 value) internal returns (bool) {
        SessionKey storage sk = _sessionKeys[key];
        uint48 slot = uint48(block.timestamp / 1 days);
        if (sk.daySlot != slot) {
            sk.daySlot = slot;
            sk.spentToday = 0;
        }
        uint256 next = sk.spentToday + value;
        if (next > sk.dailyCap) return false;
        sk.spentToday = next;
        return true;
    }

    /// @dev 返回这把 key 的时间窗，供账户打包进 validationData。
    function _sessionWindow(address key) internal view returns (uint48 validAfter, uint48 validUntil) {
        SessionKey storage sk = _sessionKeys[key];
        return (sk.validAfter, sk.validUntil);
    }
}

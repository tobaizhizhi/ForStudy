// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentSmartAccount} from "../src/AgentSmartAccount.sol";

/// @notice 部署一个 AgentSmartAccount 到测试网。
///
///         教学说明：真实 ERC-4337 里账户一般由“工厂 + initCode”按 CREATE2 部署，
///         地址在发第一笔 UserOperation 时才被反事实（counterfactual）创建。
///         这里为了 Layer 4 选修模块能直接上链验收，用最朴素的 `new` 直接部署一个账户实例，
///         owner 和 EntryPoint 从环境变量读。SDK 主线（模块 3-5）不需要这个脚本。
///
/// 用法：
///   export PRIVATE_KEY=0x...              # 部署者私钥（付 gas）
///   export ACCOUNT_OWNER=0x...            # 账户 owner（人类）
///   export ENTRY_POINT=0x0000000071727De22E5E9d8BAf0edAc6f37da032  # v0.7；v0.8 见文档
///   forge script script/DeployAgentSmartAccount.s.sol \
///     --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast
contract DeployAgentSmartAccount is Script {
    // Base Sepolia 上 EntryPoint v0.7 的规范地址（各链一致）。
    address internal constant ENTRY_POINT_V07 = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function run() external returns (AgentSmartAccount account) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("ACCOUNT_OWNER", vm.addr(pk));
        address entryPoint = vm.envOr("ENTRY_POINT", ENTRY_POINT_V07);

        console.log("Deployer:", vm.addr(pk));
        console.log("Owner:", owner);
        console.log("EntryPoint:", entryPoint);

        vm.startBroadcast(pk);
        account = new AgentSmartAccount(owner, entryPoint);
        vm.stopBroadcast();

        console.log("AgentSmartAccount:", address(account));
    }
}

import { http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { CHAIN, ENTRY_POINT, PIMLICO_URL, pimlicoClient, publicClient } from "./config";

/// 用一把 owner 私钥，构造一个“账户 + 智能账户客户端”。
///
/// 关键点：
///   - toSimpleSmartAccount：由 owner 反事实推导出一个 SimpleAccount 地址（还没上链）。
///   - createSmartAccountClient：把 bundler（发 UserOp）和 paymaster（代付 gas）接上，
///     之后 sendTransaction 会自动打包成 UserOperation、找 paymaster 赞助、走 bundler 上链。
///   - 我们全程没有手写 UserOperation / EntryPoint / bundler 交互，这正是“优先用 SDK”。
export async function buildSmartAccountClient(ownerPrivateKey: Hex) {
  const owner = privateKeyToAccount(ownerPrivateKey);

  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: ENTRY_POINT,
  });

  const smartAccountClient = createSmartAccountClient({
    account,
    chain: CHAIN,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return { owner, account, smartAccountClient };
}

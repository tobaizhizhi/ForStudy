import { formatEther } from "viem";
import { OWNER_PRIVATE_KEY, explorerTx, publicClient } from "./config";
import { buildSmartAccountClient } from "./smartAccount";

/// 模块 3 主脚本：从 owner 私钥推导智能账户地址，并用一笔“赞助的 UserOperation”把它部署上链。
///
/// 运行：pnpm create-account
async function main() {
  const { owner, account, smartAccountClient } = await buildSmartAccountClient(OWNER_PRIVATE_KEY);

  console.log("owner (EOA)   :", owner.address);
  console.log("smart account :", account.address);

  const code = await publicClient.getCode({ address: account.address });
  console.log("是否已部署    :", code && code !== "0x" ? "是" : "否（下面这笔 UserOp 会部署它）");

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("账户 ETH 余额 :", formatEther(balance));

  // 发一笔最小的自调用（value=0），触发账户部署 + 走一遍 bundler/paymaster 全链路。
  // gas 由 Pimlico paymaster 赞助，所以账户里可以一分 ETH 都没有。
  const hash = await smartAccountClient.sendTransaction({
    to: account.address,
    value: 0n,
    data: "0x",
  });

  console.log("已提交赞助交易:", explorerTx(hash));

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("上链状态      :", receipt.status);
  console.log("区块          :", receipt.blockNumber.toString());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

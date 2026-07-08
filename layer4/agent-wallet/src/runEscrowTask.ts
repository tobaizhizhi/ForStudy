import { encodeFunctionData, parseUnits } from "viem";
import { OWNER_PRIVATE_KEY, ESCROW_ADDRESS, TOKEN_ADDRESS, explorerTx, publicClient } from "./config";
import { buildSmartAccountClient } from "./smartAccount";
import { escrowAbi } from "./abi/escrow";
import { erc20Abi } from "./abi/erc20";

/// 模块 8/9 主脚本：让“智能账户作为 client”在 Layer 2 escrow 上跑 createTask -> approve -> fundTask。
/// 每一步都是一笔 gas 被赞助的 UserOperation。这就是“agent 用一个钱包在权限边界内花钱”的执行链路。
///
/// 前置：ESCROW_ADDRESS、TOKEN_ADDRESS 已配置；账户里有可注资的测试 token。
/// 运行：pnpm run-task
async function main() {
  if (!ESCROW_ADDRESS || !TOKEN_ADDRESS) {
    throw new Error("请先在 .env 配置 ESCROW_ADDRESS 和 TOKEN_ADDRESS（来自 layer2/deployments）");
  }

  const { account, smartAccountClient } = await buildSmartAccountClient(OWNER_PRIVATE_KEY);
  console.log("智能账户(client):", account.address);

  const decimals = await publicClient.readContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const amount = parseUnits("1", decimals);

  const operator = account.address; // 演示：同一账户既当 client 又当 operator；真实场景应是两方
  const refundAfter = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 3600);

  // 1) createTask —— 赞助的 UserOp
  console.log("→ createTask ...");
  const createHash = await smartAccountClient.sendTransaction({
    to: ESCROW_ADDRESS,
    data: encodeFunctionData({
      abi: escrowAbi,
      functionName: "createTask",
      args: [operator, TOKEN_ADDRESS, amount, "layer4-demo", refundAfter],
    }),
  });
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  console.log("  ok:", explorerTx(createHash));

  // createTask 的 return value 拿不到，读 taskCount 当作最新 taskId（demo 简化）
  const taskId = await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "taskCount",
  });
  console.log("  taskId:", taskId.toString());

  // 2) approve —— 授权 escrow 花账户里的 token
  console.log("→ approve ...");
  const approveHash = await smartAccountClient.sendTransaction({
    to: TOKEN_ADDRESS,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ESCROW_ADDRESS, amount] }),
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("  ok:", explorerTx(approveHash));

  // 3) fundTask —— 把 token 打进 escrow
  console.log("→ fundTask ...");
  const fundHash = await smartAccountClient.sendTransaction({
    to: ESCROW_ADDRESS,
    data: encodeFunctionData({ abi: escrowAbi, functionName: "fundTask", args: [taskId] }),
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log("  ok:", explorerTx(fundHash));

  const task = await publicClient.readContract({
    address: ESCROW_ADDRESS,
    abi: escrowAbi,
    functionName: "tasks",
    args: [taskId],
  });
  console.log("任务最终状态(status):", task[7]); // 1 = Funded
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

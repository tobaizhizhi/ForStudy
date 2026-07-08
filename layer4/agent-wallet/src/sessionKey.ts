import {
  createWalletClient,
  http,
  encodeFunctionData,
  parseEther,
  parseUnits,
  toFunctionSelector,
  type Address,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import {
  AGENT_PRIVATE_KEY,
  AGENT_SMART_ACCOUNT_ADDRESS,
  CHAIN,
  ESCROW_ADDRESS,
  OWNER_PRIVATE_KEY,
  RPC_URL,
  TOKEN_ADDRESS,
  explorerTx,
  publicClient,
} from "./config";
import { agentSmartAccountAbi } from "./abi/agentSmartAccount";

/// 选修路线（配合模块 07 的 AgentSmartAccount）：人类 owner 给 agent 发一把受限 session key。
///
/// 这演示“权限生命周期”的创建端：设作用域（只能调 escrow / token）、单笔与每日额度、过期时间。
/// 撤销 / 轮换只是再调 revokeSessionKey / registerSessionKey。
///
/// 注意：permissionless 的 SimpleAccount 没有原生 session key；on-chain 强制 session key 要么用
/// 我们模块 07 的自定义账户，要么用 ZeroDev/Kernel 这类模块化账户 SDK。本脚本走“自定义账户”路线。
///
/// 运行：pnpm session-key
async function main() {
  if (!AGENT_SMART_ACCOUNT_ADDRESS) {
    throw new Error("请先部署模块 07 的 AgentSmartAccount，并把地址写进 AGENT_SMART_ACCOUNT_ADDRESS");
  }
  if (!ESCROW_ADDRESS || !TOKEN_ADDRESS) {
    throw new Error("请配置 ESCROW_ADDRESS 和 TOKEN_ADDRESS");
  }

  const ownerAccount = privateKeyToAccount(OWNER_PRIVATE_KEY);
  const ownerWallet = createWalletClient({ account: ownerAccount, chain: CHAIN, transport: http(RPC_URL) });
  const account = AGENT_SMART_ACCOUNT_ADDRESS;

  // agent 的钥匙：优先用 .env 里的，否则现场生成一把（真实场景 agent 侧持有私钥，只把地址给 owner）
  const agentKey = AGENT_PRIVATE_KEY && AGENT_PRIVATE_KEY.startsWith("0x") ? AGENT_PRIVATE_KEY : generatePrivateKey();
  const agent = privateKeyToAccount(agentKey);
  console.log("agent session key 地址:", agent.address);

  const now = Math.floor(Date.now() / 1000);
  const validUntil = BigInt(now + 7 * 24 * 3600); // 7 天后过期
  const perCallCap = parseEther("0"); // 这条链路不发 native value，native 单笔上限设 0
  const dailyCap = parseEther("0");

  const approveSelector = toFunctionSelector("approve(address,uint256)");
  const createTaskSelector = toFunctionSelector("createTask(address,address,uint256,string,uint256)");
  const fundTaskSelector = toFunctionSelector("fundTask(uint256)");

  const calls: { label: string; to: Address; data: `0x${string}` }[] = [
    {
      label: "registerSessionKey(7 天过期, native 上限 0)",
      to: account,
      data: encodeFunctionData({
        abi: agentSmartAccountAbi,
        functionName: "registerSessionKey",
        args: [agent.address, 0, Number(validUntil), perCallCap, dailyCap],
      }),
    },
    {
      label: "allow target = escrow",
      to: account,
      data: encodeFunctionData({
        abi: agentSmartAccountAbi,
        functionName: "setSessionKeyTarget",
        args: [agent.address, ESCROW_ADDRESS, true],
      }),
    },
    {
      label: "allow target = token",
      to: account,
      data: encodeFunctionData({
        abi: agentSmartAccountAbi,
        functionName: "setSessionKeyTarget",
        args: [agent.address, TOKEN_ADDRESS, true],
      }),
    },
    {
      label: "allow selector createTask / fundTask / approve",
      to: account,
      data: encodeFunctionData({
        abi: agentSmartAccountAbi,
        functionName: "setSessionKeySelector",
        args: [agent.address, createTaskSelector, true],
      }),
    },
    {
      label: "erc20 单笔授权上限 = 10 token",
      to: account,
      data: encodeFunctionData({
        abi: agentSmartAccountAbi,
        functionName: "setSessionKeyErc20Cap",
        args: [agent.address, TOKEN_ADDRESS, parseUnits("10", 18)],
      }),
    },
  ];

  // 逐条由 owner 直接发交易（owner 是人类 EOA，这些是一次性的授权设置）
  for (const call of calls) {
    const hash = await ownerWallet.sendTransaction({ to: call.to, data: call.data });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✓ ${call.label}: ${explorerTx(hash)}`);
  }

  // 还要补两个 selector（脚本只演示一条 setSessionKeySelector；其余同理）
  for (const sel of [fundTaskSelector, approveSelector]) {
    const hash = await ownerWallet.sendTransaction({
      to: account,
      data: encodeFunctionData({
        abi: agentSmartAccountAbi,
        functionName: "setSessionKeySelector",
        args: [agent.address, sel, true],
      }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`✓ allow selector ${sel}: ${explorerTx(hash)}`);
  }

  const active = await publicClient.readContract({
    address: account,
    abi: agentSmartAccountAbi,
    functionName: "isSessionKeyActive",
    args: [agent.address],
  });
  console.log("session key active:", active);
  console.log("\n把这把 key 交给 agent 后，它就只能在上述作用域和额度内替这个账户干活了。");
  console.log("要收回权限：owner 调 revokeSessionKey(agent) 即可，旧 key 立刻失效。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

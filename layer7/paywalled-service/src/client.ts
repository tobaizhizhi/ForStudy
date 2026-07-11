import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { toClientEvmSigner } from "@x402/evm";
import { CLIENT_PRIVATE_KEY, NETWORK, RPC_URL, SERVICE_URL } from "./config.js";

// ============================================================================
// 进程②：付费 client —— 用 wrapFetchWithPayment 自动完成 402 → 签名 → 重试。
// 你几乎写不到 402 的细节：包一层 fetch，遇到 402 就自动签 EIP-3009、带 proof 重试。
//
// 起：pnpm start:client（需要 .env 里 CLIENT_PRIVATE_KEY = 有测网 USDC 的测试钱包）
// ============================================================================

async function main(): Promise<void> {
  if (!CLIENT_PRIVATE_KEY) {
    console.log("[client] ⚠️ 未设置 CLIENT_PRIVATE_KEY。");
    console.log("[client] 真实付款需要一个有 Base Sepolia 测网 USDC 的测试钱包：");
    console.log("[client]   1) 复制 .env.example 为 .env");
    console.log("[client]   2) 填 CLIENT_PRIVATE_KEY（只用测试网私钥！）");
    console.log("[client]   3) 领测网 USDC：https://faucet.circle.com （选 Base Sepolia）");
    console.log("[client] 想先看握手不花钱，跑：pnpm inspect");
    process.exit(1);
  }

  const account = privateKeyToAccount(CLIENT_PRIVATE_KEY as `0x${string}`);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  // 组装 x402 client：为 Base Sepolia 注册 exact-evm 客户端方案（用我们的签名器）。
  const signer = toClientEvmSigner(account, publicClient);
  const client = new x402Client().register(NETWORK, new ExactEvmScheme(signer));

  // 包一层 fetch：遇到 402 自动付款重试。
  const fetchWithPay = wrapFetchWithPayment(fetch, client);

  console.log(`[client] 用钱包 ${account.address} 调付费资源 ${SERVICE_URL}/premium ...`);
  const res = await fetchWithPay(`${SERVICE_URL}/premium`);
  console.log(`[client] 最终 HTTP 状态：${res.status}`);
  const body = await res.json();
  console.log("[client] 拿到付费内容：", body);
  console.log("\n这次调用：请求 → 402 → 自动签 EIP-3009 USDC 授权 → 带 proof 重试 → facilitator 结算 → 拿到结果。");
}

main().catch((e) => {
  console.error("[client] 失败：", e);
  process.exit(1);
});

import { SERVICE_URL } from "./config.js";

// ============================================================================
// 进程③：inspect —— 不花钱、不需要私钥，直接看 x402 的 402 握手。
// 裸 fetch 请求付费资源，打印 402 响应和 server 给的付款要求。
//
// 起：pnpm inspect（只需要 server 在跑）
// ============================================================================

async function main(): Promise<void> {
  console.log(`[inspect] 裸 fetch 请求付费资源 ${SERVICE_URL}/premium（不带任何付款）...\n`);

  const res = await fetch(`${SERVICE_URL}/premium`);
  console.log(`HTTP 状态：${res.status} ${res.statusText}`);

  if (res.status === 402) {
    console.log("✅ 如预期返回 402 Payment Required —— 这就是 x402 握手的第一步。\n");
    // x402 v2 把付款要求放在响应头 / body 里
    const relevantHeaders = ["payment-required", "www-authenticate", "content-type"];
    console.log("相关响应头：");
    for (const h of relevantHeaders) {
      const v = res.headers.get(h);
      if (v) console.log(`  ${h}: ${v.length > 80 ? v.slice(0, 80) + "..." : v}`);
    }
    const body = await res.text();
    console.log("\n响应 body（付款要求，PaymentRequirements）：");
    console.log(body.length > 600 ? body.slice(0, 600) + "\n...(截断)" : body);
    console.log("\n下一步（client 侧，需私钥）：选一个 requirement → 签 EIP-3009 授权 → 带 proof 重试。");
    console.log("跑 pnpm start:client（填了 .env 的测试钱包）看完整付款。");
  } else {
    console.log(`⚠️ 期望 402，实际 ${res.status}。检查 server 是否在跑、/premium 是否挂了付费闸门。`);
    console.log(await res.text());
  }
}

main().catch((e) => {
  console.error("[inspect] 失败（server 起了吗？）：", e);
  process.exit(1);
});

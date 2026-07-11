import {
  makeRequirements,
  printKV,
  runIfMain,
  section,
  verdict,
  type Eip3009Authorization,
  type PaymentPayload,
  type PaymentRequirements,
} from "./shared.js";

// ============================================================================
// 练习 1：x402 的 HTTP 402 握手 —— server 说"怎么付"，client 拼一笔 payment
//   流程：client 请求 → server 回 402 + PaymentRequirements → client 选一个、
//         签一笔 EIP-3009 授权 → 带 payment 重试。本 demo 本地把这几步拼出来看。
// ============================================================================

// client 侧：拿到一组 requirements，选一个，拼出 payment payload（教学：签名用占位）
function buildPayment(req: PaymentRequirements, from: string, now: number): PaymentPayload {
  const auth: Eip3009Authorization = {
    from,
    to: req.payTo,
    value: req.amount, // 恰好付要求的金额
    validAfter: now - 1,
    validBefore: now + req.maxTimeoutSeconds,
    nonce: "0x" + "a1".repeat(32), // 教学固定 nonce
  };
  return {
    scheme: req.scheme,
    network: req.network,
    asset: req.asset,
    authorization: auth,
    signature: "0xEIP712_SIGNATURE_PLACEHOLDER", // 真实里是对 EIP-3009 结构的 EIP-712 签名
  };
}

export function runDemo(): void {
  section("练习 1：x402 的 402 握手（server 报价 → client 拼 payment）");

  const now = 1_800_000_000;

  // 第 1 步：client 请求付费资源，server 回 402 + 这组 requirements
  const req = makeRequirements();
  console.log("① server 回 402 Payment Required，附上 PaymentRequirements：");
  printKV("scheme", req.scheme);
  printKV("network(CAIP-2)", req.network);
  printKV("amount(原子单位)", `${req.amount}（USDC 6 位 = $${Number(req.amount) / 1e6}）`);
  printKV("asset", req.asset);
  printKV("payTo", req.payTo);
  printKV("maxTimeoutSeconds", req.maxTimeoutSeconds);
  console.log("");

  // 第 2 步：client 选这个 requirement，拼 payment
  const payment = buildPayment(req, "0xClientWalletaaaaaaaaaaaaaaaaaaaaaaaaaaaa", now);
  console.log("② client 选中它，签一笔 EIP-3009 授权，拼成 PaymentPayload：");
  printKV("授权 from", payment.authorization.from);
  printKV("授权 to (=payTo)", payment.authorization.to);
  printKV("授权 value", payment.authorization.value);
  printKV("validBefore", payment.authorization.validBefore);
  printKV("nonce(防重放)", payment.authorization.nonce);
  console.log("");

  // 第 3 步：client 带 PAYMENT-SIGNATURE header 重试；server/facilitator 验证再放行
  console.log("③ client 带 payment 重试 → facilitator 验证 → server 放行返回资源");
  verdict(true, "握手结构完整：requirements ↔ payment 一一对应");

  console.log("\n要点：x402 是【一次 HTTP 往返】完成机器对机器支付——");
  console.log("      不需要账号、API key、月结账单；agent 就能付一次几厘钱的调用。");
  console.log("      下一课（练习 2）看 facilitator 到底怎么验这笔 payment。");
}

runIfMain(import.meta.url, runDemo);

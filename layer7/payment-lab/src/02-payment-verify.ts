import {
  makeRequirements,
  runIfMain,
  section,
  verdict,
  verifyPayment,
  type Eip3009Authorization,
  type PaymentPayload,
  type PaymentRequirements,
} from "./shared.js";

// ============================================================================
// 练习 2：facilitator 怎么验一笔 payment —— "验证再放行" 的核心
//   server 拿到 client 带来的 payment，交给 facilitator 校验：
//   scheme/链/币种/收款方/金额/时间窗/防重放，全对上才结算、才放行资源。
// ============================================================================

function payment(req: PaymentRequirements, over: Partial<Eip3009Authorization>, sig = "0xSIG"): PaymentPayload {
  const auth: Eip3009Authorization = {
    from: "0xClientaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    to: req.payTo,
    value: req.amount,
    validAfter: 0,
    validBefore: 2_000_000_000,
    nonce: "0x" + "11".repeat(32),
    ...over,
  };
  return { scheme: req.scheme, network: req.network, asset: req.asset, authorization: auth, signature: sig };
}

export function runDemo(): void {
  section("练习 2：facilitator 校验 payment（验证再放行）");

  const now = 1_800_000_000;
  const req = makeRequirements(); // 要求付 $0.001 USDC 到 payTo，Base Sepolia

  const cases: { label: string; pay: PaymentPayload; freshNonce?: boolean }[] = [
    { label: "合法：金额/链/币/收款方全对，签名在", pay: payment(req, {}) },
    { label: "金额不足：只授权 500 < 要求 1000", pay: payment(req, { value: "500" }) },
    { label: "错收款方：授权给了攻击者地址", pay: payment(req, { to: "0xAttacker00000000000000000000000000000000" }) },
    { label: "过期 quote：validBefore 在 now 之前", pay: payment(req, { validBefore: now - 1, nonce: "0x" + "22".repeat(32) }) },
    { label: "伪造 proof：signature 为空", pay: payment(req, { nonce: "0x" + "33".repeat(32) }, "0x") },
    { label: "错链：payment 声称在别的链", pay: { ...payment(req, { nonce: "0x" + "44".repeat(32) }), network: "eip155:1" } },
  ];

  const ctx = { now, usedNonces: new Set<string>() };
  for (const c of cases) {
    const r = verifyPayment(c.pay, req, ctx);
    verdict(r.ok, c.label, r.ok ? undefined : r.reason);
  }

  // 重复提交：把第一笔合法 payment 再交一次（nonce 已用过）
  console.log("");
  const replay = payment(req, {}); // 和第一笔同 nonce
  const r = verifyPayment(replay, req, ctx);
  verdict(r.ok, "重复提交：同一 nonce 再交一次（重放）", r.ok ? undefined : r.reason);

  console.log("\n要点：服务端必须【先验证再释放资源】。伪造 proof / 金额不足 / 改收款方 /");
  console.log("      过期 quote / 重复提交，任何一条不过就拒绝——这是支付安全的底线。");
}

runIfMain(import.meta.url, runDemo);

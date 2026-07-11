import {
  generateP256,
  makeRequirements,
  runIfMain,
  section,
  signMandate,
  verdict,
  verifyMandate,
  verifyPayment,
  type Eip3009Authorization,
  type Mandate,
  type PaymentPayload,
} from "./shared.js";

// ============================================================================
// 练习 6：互操作拒绝矩阵 —— Layer 7 的安全灵魂
//   把支付链路的每道闸串起来，喂各种坏输入，确认全部 ⛔（带自断言）。
//   agent 能自主动钱时，"接受了一笔伪造/重复/错单的支付"就是真实资金损失。
// ============================================================================

export function runDemo(): void {
  section("练习 6：支付互操作拒绝矩阵（带自断言）");

  const now = 1_800_000_000;
  const req = makeRequirements(); // 付 $0.001 USDC 到 payTo
  const ownerKey = generateP256();
  const trusted = new Set([ownerKey.publicKeyPem]);

  function pay(over: Partial<Eip3009Authorization>, sig = "0xSIG"): PaymentPayload {
    const auth: Eip3009Authorization = {
      from: "0xClientaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      to: req.payTo, value: req.amount, validAfter: 0, validBefore: now + 300,
      nonce: "0x" + Math.floor(over.validBefore ?? 1).toString(16).padStart(64, "0"), ...over,
    };
    return { scheme: "exact", network: req.network, asset: req.asset, authorization: auth, signature: sig };
  }

  const goodMandate: Mandate = {
    type: "payment", payer: "0xUser", payee: req.payTo, amount: req.amount,
    asset: req.asset, network: req.network, taskId: "t1", nonce: "m1", expiresAt: now + 600,
  };
  const signedMandate = signMandate(goodMandate, ownerKey);

  const ctx = { now, usedNonces: new Set<string>() };

  // 每条：[标签, 判定函数, 期望结果]
  const cases: { label: string; run: () => boolean; expectOk: boolean }[] = [
    { label: "合法 payment：金额/链/币/收款方全对", run: () => verifyPayment(pay({ nonce: "0x" + "01".repeat(32) }), req, ctx).ok, expectOk: true },
    { label: "伪造 proof（签名为空）", run: () => verifyPayment(pay({ nonce: "0x" + "02".repeat(32) }, "0x"), req, ctx).ok, expectOk: false },
    { label: "金额不足", run: () => verifyPayment(pay({ value: "1", nonce: "0x" + "03".repeat(32) }), req, ctx).ok, expectOk: false },
    { label: "错收款方", run: () => verifyPayment(pay({ to: "0xAttacker00000000000000000000000000000000", nonce: "0x" + "04".repeat(32) }), req, ctx).ok, expectOk: false },
    { label: "过期 quote", run: () => verifyPayment(pay({ validBefore: now - 1, nonce: "0x" + "05".repeat(32) }), req, ctx).ok, expectOk: false },
    { label: "合法 mandate：授权与实际结算一致", run: () => verifyMandate(signedMandate, { now, trustedKeys: trusted, expect: { amount: req.amount, payee: req.payTo } }).ok, expectOk: true },
    { label: "mandate 金额被挪用（授权少、结算多）", run: () => verifyMandate(signedMandate, { now, trustedKeys: trusted, expect: { amount: "999999999" } }).ok, expectOk: false },
    { label: "mandate 过期", run: () => verifyMandate(signedMandate, { now: now + 700, trustedKeys: trusted }).ok, expectOk: false },
    { label: "不可信 key 自签 mandate", run: () => verifyMandate(signMandate(goodMandate, generateP256()), { now, trustedKeys: trusted }).ok, expectOk: false },
  ];

  let pass = 0;
  for (const c of cases) {
    const got = c.run();
    verdict(got, c.label);
    if (got === c.expectOk) pass++;
    else console.log(`   ❗ 预期 ${c.expectOk ? "通过" : "拒绝"}，实际相反 —— 断言失败`);
  }

  // 重复提交：把第一笔 nonce 再验一次
  const dup = verifyPayment(pay({ nonce: "0x" + "01".repeat(32) }), req, ctx).ok;
  verdict(dup, "重复提交（nonce 已用过）");
  if (!dup) pass++;
  else console.log("   ❗ 预期 拒绝，实际通过 —— 断言失败");

  console.log("");
  section(`断言：${pass}/${cases.length + 1} 条与预期一致`);
  if (pass !== cases.length + 1) {
    console.log("有断言失败——支付闸门逻辑与安全验收不符。");
    process.exitCode = 1;
  } else {
    console.log("全部符合预期：合法放行，伪造 proof/金额不足/错收款方/过期/重复提交/挪用 mandate 全部拒绝。");
    console.log("这正对应本层安全验收：授权与结算必须绑定同一任务/金额/币/链/收款方。");
  }
}

runIfMain(import.meta.url, runDemo);

import {
  canonical,
  generateP256,
  printKV,
  runIfMain,
  section,
  signMandate,
  verdict,
  verifyMandate,
  type Mandate,
} from "./shared.js";

// ============================================================================
// 练习 5：AP2 mandate（授权层）—— 签一个"这笔钱被批准了"的可验证凭证
//   AP2 只授权、不动钱：产出一个用户/管理员签过的 mandate，x402 再去结算。
//   本 demo 用 P-256 (ECDSA) 本地演示原理，和真实 AP2(W3C VC + P-256) 同一心智；
//   不接真实 AP2 SDK。高风险金额触发人工审批。
// ============================================================================

const HIGH_RISK_THRESHOLD = 50_000_000; // $50（USDC 6 位）以上算高风险，需 mandate

export function runDemo(): void {
  section("练习 5：AP2 mandate —— 高风险支付需要签过的授权");

  const now = 1_800_000_000;
  const ownerKey = generateP256(); // 用户/管理员的签名密钥
  const trusted = new Set([ownerKey.publicKeyPem]);

  // 场景 A：小额自动放行（走 session key + x402 自动路径，无需 mandate）
  const small = 1000; // $0.001
  console.log(`场景 A：小额 $${small / 1e6} —— 低于高风险阈值 $${HIGH_RISK_THRESHOLD / 1e6}`);
  verdict(true, "小额自动放行，不需要 AP2 mandate（走 x402 自动路径）");
  console.log("");

  // 场景 B：大额必须先拿到签过的 Payment Mandate
  const big = 80_000_000; // $80
  console.log(`场景 B：大额 $${big / 1e6} —— 超过高风险阈值，必须先有 mandate`);

  const mandate: Mandate = {
    type: "payment",
    payer: "0xUserWalletaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    payee: "0xServiceBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    amount: String(big),
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    network: "eip155:84532",
    taskId: "task-42",
    nonce: "mnd-0001",
    expiresAt: now + 600,
  };
  const signed = signMandate(mandate, ownerKey);
  console.log("用户签发 Payment Mandate（ECDSA P-256 + SHA-256）：");
  printKV("签名输入(canonical)", canonical(mandate));
  printKV("signature", signed.signature);
  console.log("");

  section("结算前校验：mandate 必须绑定这次实际结算的金额/收款方/任务");

  // 正确：实际结算和 mandate 授权一致
  verdict(
    verifyMandate(signed, { now, trustedKeys: trusted, expect: { amount: String(big), payee: mandate.payee, taskId: "task-42" } }).ok,
    "实际结算 = 授权（$80 / 同收款方 / 同任务）",
  );

  // 攻击：拿着 $80 的 mandate 去结算 $800（金额不符）
  const r1 = verifyMandate(signed, { now, trustedKeys: trusted, expect: { amount: "800000000" } });
  verdict(r1.ok, "有人拿 $80 的 mandate 去结算 $800", r1.ok ? undefined : r1.reason);

  // 攻击：改收款方
  const r2 = verifyMandate(signed, { now, trustedKeys: trusted, expect: { payee: "0xAttacker0000000000000000000000000000000000" } });
  verdict(r2.ok, "有人把收款方换成攻击者", r2.ok ? undefined : r2.reason);

  // 攻击：mandate 过期
  const r3 = verifyMandate(signed, { now: now + 700, trustedKeys: trusted });
  verdict(r3.ok, "mandate 过期后还想用", r3.ok ? undefined : r3.reason);

  // 攻击：不可信 key 自签一个 mandate
  const attackerKey = generateP256();
  const forged = signMandate({ ...mandate, payee: "0xAttacker0000000000000000000000000000000000" }, attackerKey);
  const r4 = verifyMandate(forged, { now, trustedKeys: trusted });
  verdict(r4.ok, "攻击者用自己的 key 自签 mandate", r4.ok ? undefined : r4.reason);

  console.log("\n要点：AP2 = 谁批准了这笔钱（签名授权），x402 = 钱真的付了（链上结算）。");
  console.log("      mandate 必须绑定 payer/payee/金额/币/链/任务/过期——任一不符就拒绝。");
}

runIfMain(import.meta.url, runDemo);

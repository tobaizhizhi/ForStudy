import {
  baseCard,
  generateEd25519,
  negotiateVersion,
  runIfMain,
  section,
  signCard,
  validateCardShape,
  verdict,
  verifyCard,
  type AgentCard,
  type KeyPair,
} from "./shared.js";

// ============================================================================
// 练习 6：互操作拒绝矩阵 —— 本层的安全灵魂
//   把发现链路的每一道闸串起来，喂各种坏 Card，确认系统全部 ⛔。
//   一个 agent 能自主动钱/派任务时，“接受了一张伪造/过期/篡改的 Card”就是真实损失。
//   完整发现闸门顺序：结构校验 → JWS 验签 → 公钥可信 → 版本协商 →（过期检查）。
// ============================================================================

/** 一个可信 owner 的公钥名单（真实系统里来自 DID / JWKS / ERC-8004 身份注册表）。 */
interface TrustContext {
  trustedPublicKeys: Set<string>;
  now: number;
}

/** 教学扩展：给卡加一个可选的 expiresAt，演示“过期卡”被拒。 */
type CardWithExpiry = AgentCard & { expiresAt?: number };

function fullDiscoveryCheck(
  card: Partial<CardWithExpiry>,
  ctx: TrustContext,
  requestedVersion: string,
): { ok: true } | { ok: false; reason: string } {
  // 闸 1：结构
  const shape = validateCardShape(card);
  if (!shape.ok) return shape;
  const c = card as CardWithExpiry;

  // 闸 2：JWS 验签（卡被篡改 / 未签名 → 挂）
  const sig = verifyCard(c);
  if (!sig.ok) return sig;

  // 闸 3：公钥必须在可信名单里（挡住“攻击者用自己 key 自签”的有效 JWS）
  const pub = c.signature!.publicKeyPem;
  if (!ctx.trustedPublicKeys.has(pub)) {
    return { ok: false, reason: "签名公钥不在可信名单（自签卡：JWS 有效但签发者不可信）" };
  }

  // 闸 4：版本协商（用 client 请求的版本，不是卡里印的版本）
  const ver = negotiateVersion(requestedVersion);
  if (!ver.ok) return ver;

  // 闸 5：过期检查
  if (c.expiresAt !== undefined && c.expiresAt < ctx.now) {
    return { ok: false, reason: `Agent Card 已过期（expiresAt=${c.expiresAt} < now=${ctx.now}）` };
  }

  return { ok: true };
}

export function runDemo(): void {
  section("练习 6：互操作拒绝矩阵（发现链路的完整闸门）");

  const ownerKey: KeyPair = generateEd25519();
  const attackerKey: KeyPair = generateEd25519();
  const now = 1_800_000_000; // 固定时间，保证可复现

  const ctx: TrustContext = {
    trustedPublicKeys: new Set([ownerKey.publicKeyPem]),
    now,
  };

  const goodSigned = signCard(baseCard(), ownerKey);

  const cases: { label: string; card: Partial<CardWithExpiry>; version: string; expectOk: boolean }[] = [
    { label: "合法卡：结构全 + owner 签 + 版本 1.0 + 未过期", card: goodSigned, version: "1.0", expectOk: true },
    { label: "缺字段（结构闸拦下）", card: { ...goodSigned, url: undefined }, version: "1.0", expectOk: false },
    { label: "被篡改（url 改了 → JWS 验签失败）", card: { ...goodSigned, url: "https://evil.example/a2a" }, version: "1.0", expectOk: false },
    { label: "未签名卡", card: baseCard(), version: "1.0", expectOk: false },
    { label: "攻击者自签（JWS 有效但公钥不可信）", card: signCard(baseCard(), attackerKey), version: "1.0", expectOk: false },
    { label: "版本不兼容（请求 0.3，server 只支持 1.0）", card: goodSigned, version: "0.3", expectOk: false },
    { label: "过期卡（expiresAt 在 now 之前）", card: signCard({ ...baseCard(), expiresAt: now - 1 } as AgentCard, ownerKey), version: "1.0", expectOk: false },
    { label: "伪造 endpoint（url 指向内网穿透，结构闸拦下）", card: { ...goodSigned, url: "http://169.254.169.254/a2a", signature: undefined }, version: "1.0", expectOk: false },
  ];

  let pass = 0;
  for (const t of cases) {
    // 注意：version 从入参走，其余从 card 走
    const result = fullDiscoveryCheck(t.card, ctx, t.version);
    verdict(result.ok, t.label, result.ok ? undefined : result.reason);
    // 断言：实际结果要和预期一致（这就是这套 lab 的“测试”）
    if (result.ok === t.expectOk) pass++;
    else console.log(`   ❗ 预期 ${t.expectOk ? "通过" : "拒绝"}，实际相反 —— 断言失败`);
  }

  console.log("");
  section(`断言：${pass}/${cases.length} 条与预期一致`);
  if (pass !== cases.length) {
    console.log("有断言失败——发现闸门逻辑与安全验收不符。");
    process.exitCode = 1;
  } else {
    console.log("全部符合预期：合法卡放行，坏卡（缺字段/篡改/未签/自签/错版本/过期/伪造端点）全部拒绝。");
    console.log("这正对应本层安全验收：未签名 / 验签失败 / 错版本 / 过期 / 伪造 endpoint 一律拒绝。");
  }
}

runIfMain(import.meta.url, runDemo);

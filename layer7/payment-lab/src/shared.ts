import { pathToFileURL } from "node:url";
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

// ============================================================================
// Layer 7 payment-lab 的公共工具。
// 全部本地运行：不联网、不付真钱、不需要私钥文件。
// x402 的 PaymentRequirements / EIP-3009 授权、AP2 mandate 这里用本地类型 +
// Node 内置 crypto 手写演示【原理】，不是生产密码库 / 不是真实 SDK。
// 真实 x402 SDK 端到端在隔壁 ../paywalled-service/。
// ============================================================================

// ---------------------------------------------------------------------------
// 打印工具（复刻 layer4/layer6 lab 的 section / printKV / verdict）
// ---------------------------------------------------------------------------

export function section(title: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

export function shortHex(s: string, head = 12, tail = 8): string {
  if (s.length <= head + tail) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

export function printKV(label: string, value: unknown): void {
  const rendered =
    typeof value === "bigint"
      ? value.toString()
      : typeof value === "string" && (value.startsWith("0x") || value.length > 44)
        ? shortHex(value)
        : value;
  console.log(`${label.padEnd(24)}: ${rendered}`);
}

/** ✅通过 / ⛔拒绝 —— 全层统一的判定打印。 */
export function verdict(ok: boolean, label: string, reason?: string): void {
  console.log(`${ok ? "✅ 通过" : "⛔ 拒绝"} | ${label}`);
  if (!ok && reason) printKV("原因", reason);
}

export function runIfMain(metaUrl: string, fn: () => void | Promise<void>): void {
  if (process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href) {
    Promise.resolve(fn()).catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
  }
}

export type Result = { ok: true } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// x402 常量（Base Sepolia，教学值）
// ---------------------------------------------------------------------------

/** CAIP-2 网络标识：Base Sepolia = eip155:84532（x402 v2 用 CAIP-2）。 */
export const NETWORK_BASE_SEPOLIA = "eip155:84532";

/** Base Sepolia 测试网 USDC 合约（x402 结算主力币）。 */
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

/** 公共测试 facilitator（Base Sepolia + Solana devnet）。 */
export const PUBLIC_FACILITATOR = "https://x402.org/facilitator";

// ---------------------------------------------------------------------------
// x402 PaymentRequirements —— server 在 402 响应里告诉 client "怎么付"
//   （字段对齐 x402 v2 的 exact-evm scheme，教学精简版）
// ---------------------------------------------------------------------------

export interface PaymentRequirements {
  scheme: "exact";
  network: string; // CAIP-2
  /** 原子单位金额（USDC 6 位小数：1000 = $0.001）。 */
  amount: string;
  /** 结算资产合约地址。 */
  asset: string;
  /** 收款地址。 */
  payTo: string;
  /** 授权有效秒数。 */
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string; resourceUrl?: string };
}

export function makeRequirements(overrides: Partial<PaymentRequirements> = {}): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK_BASE_SEPOLIA,
    amount: "1000", // $0.001（USDC 6 位）
    asset: USDC_BASE_SEPOLIA,
    payTo: "0x1c47E9C085c2B7458F5b6C16cCBD65A65255a9f6",
    maxTimeoutSeconds: 300,
    extra: { name: "USDC", version: "2", resourceUrl: "https://svc.example/premium" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// EIP-3009 授权 —— client 签的"授权 payTo 拿走 amount"，gasless
//   （教学结构；真实 SDK 会算 EIP-712 domain/typeHash 并签，这里只表结构 + 校验逻辑）
// ---------------------------------------------------------------------------

export interface Eip3009Authorization {
  from: string;
  to: string;
  value: string; // 原子单位
  validAfter: number;
  validBefore: number;
  nonce: string; // 32 字节随机，防重放
}

export interface PaymentPayload {
  scheme: "exact";
  network: string;
  asset: string;
  authorization: Eip3009Authorization;
  /** 教学占位：真实里是 EIP-712 签名的 hex。 */
  signature: string;
}

/**
 * server / facilitator 侧校验一笔 payment 是否满足 requirements。
 * 这是 x402 "验证再放行" 的核心：金额/币种/链/收款方/时间窗/防重放全对上才算数。
 */
export function verifyPayment(
  pay: PaymentPayload,
  req: PaymentRequirements,
  ctx: { now: number; usedNonces: Set<string> },
): Result {
  if (pay.scheme !== req.scheme) return { ok: false, reason: `scheme 不符：${pay.scheme} ≠ ${req.scheme}` };
  if (pay.network !== req.network) return { ok: false, reason: `链不符：${pay.network} ≠ ${req.network}` };
  if (pay.asset.toLowerCase() !== req.asset.toLowerCase()) return { ok: false, reason: "结算币种不符" };

  const a = pay.authorization;
  if (a.to.toLowerCase() !== req.payTo.toLowerCase()) return { ok: false, reason: "收款地址不是要求的 payTo（可能被改单）" };
  if (BigInt(a.value) < BigInt(req.amount)) return { ok: false, reason: `金额不足：${a.value} < ${req.amount}` };
  if (ctx.now < a.validAfter) return { ok: false, reason: "授权还没生效" };
  if (ctx.now > a.validBefore) return { ok: false, reason: "授权已过期（quote 过期）" };
  if (ctx.usedNonces.has(a.nonce)) return { ok: false, reason: "nonce 已用过（重复提交/重放）" };

  if (!pay.signature || pay.signature === "0x") return { ok: false, reason: "缺少支付签名（伪造 proof）" };

  ctx.usedNonces.add(a.nonce);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// AP2 mandate（轻量演示）—— W3C VC 风格 + P-256 (ECDSA) 签名
//   AP2 只授权、不动钱；这里演示"签一个授权、验一个授权"的原理。
//   真实 AP2 用 JSON-LD VC + ECDSA P-256/SHA-256，本课不接真实 AP2 SDK。
// ---------------------------------------------------------------------------

export type MandateType = "intent" | "cart" | "payment";

export interface Mandate {
  type: MandateType;
  /** 授权谁付给谁、多少、什么币、哪条链。 */
  payer: string;
  payee: string;
  amount: string;
  asset: string;
  network: string;
  taskId: string;
  nonce: string;
  expiresAt: number;
}

export interface KeyPair {
  publicKeyPem: string;
  privateKey: KeyObject;
}

/** P-256 (prime256v1) 密钥对，对应 AP2 的 ECDSA over P-256。 */
export function generateP256(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey,
  };
}

/** 规范化 mandate（key 排序），作为签名输入——和 Layer 6 的 JCS 同一个心智。 */
export function canonical(m: Mandate): string {
  const keys = Object.keys(m).sort() as (keyof Mandate)[];
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, m[k]])));
}

export interface SignedMandate {
  mandate: Mandate;
  signature: string; // base64
  publicKeyPem: string;
}

/** 用户/管理员签一个 mandate（ECDSA P-256 + SHA-256）。 */
export function signMandate(m: Mandate, key: KeyPair): SignedMandate {
  const sig = nodeSign("sha256", Buffer.from(canonical(m)), key.privateKey);
  return { mandate: m, signature: sig.toString("base64"), publicKeyPem: key.publicKeyPem };
}

/** 验证一个 signed mandate：签名对 + 未过期 + （可选）绑定的任务上下文一致。 */
export function verifyMandate(
  sm: SignedMandate,
  ctx: { now: number; expect?: Partial<Mandate>; trustedKeys?: Set<string> },
): Result {
  let pub: KeyObject;
  try {
    pub = createPublicKey(sm.publicKeyPem);
  } catch {
    return { ok: false, reason: "公钥解析失败" };
  }
  const valid = nodeVerify("sha256", Buffer.from(canonical(sm.mandate)), pub, Buffer.from(sm.signature, "base64"));
  if (!valid) return { ok: false, reason: "mandate 签名校验不通过（被篡改或非该私钥所签）" };

  if (ctx.trustedKeys && !ctx.trustedKeys.has(sm.publicKeyPem)) {
    return { ok: false, reason: "签名公钥不在可信名单（自签 mandate）" };
  }
  if (sm.mandate.expiresAt < ctx.now) return { ok: false, reason: "mandate 已过期" };

  // 绑定校验：mandate 授权的金额/收款方/任务，必须和实际要结算的一致
  if (ctx.expect) {
    for (const [k, v] of Object.entries(ctx.expect) as [keyof Mandate, unknown][]) {
      if (String(sm.mandate[k]).toLowerCase() !== String(v).toLowerCase()) {
        return { ok: false, reason: `mandate 与实际结算不符：${k}（授权 ${sm.mandate[k]} ≠ 实际 ${v}）` };
      }
    }
  }
  return { ok: true };
}

// keep createPrivateKey referenced for advanced examples (avoids unused import churn)
export { createPrivateKey };

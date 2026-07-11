import { pathToFileURL } from "node:url";
import {
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

// ============================================================================
// Layer 6 protocol-lab 的公共工具。
// 全部本地运行：不联网、不调 SDK 网络接口、不需要 API key。
// JWS/JCS 这里用 Node 内置 crypto 手写演示【原理】，不是生产密码库。
// ============================================================================

// ---------------------------------------------------------------------------
// 打印工具（复刻 layer4 agent-wallet-lab 的 section / printKV / shortHex）
// ---------------------------------------------------------------------------

export function section(title: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

export function shortHex(s: string, head = 14, tail = 8): string {
  if (s.length <= head + tail) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

export function printKV(label: string, value: unknown): void {
  const rendered =
    typeof value === "string" && (value.startsWith("0x") || value.length > 44)
      ? shortHex(value)
      : value;
  console.log(`${label.padEnd(24)}: ${rendered}`);
}

/** ✅通过 / ⛔拒绝 —— 全层统一的判定打印。 */
export function verdict(ok: boolean, label: string, reason?: string): void {
  const prefix = ok ? "✅ 通过" : "⛔ 拒绝";
  console.log(`${prefix} | ${label}`);
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

// ---------------------------------------------------------------------------
// Agent Card 类型（A2A 概念按 v1.0；字段是教学精简版，非完整 schema）
// ---------------------------------------------------------------------------

/** A2A 里 agent 声明的一项能力。 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** 用来做能力匹配的标签，如 "onchain-read"、"base-sepolia"。 */
  tags: string[];
}

export interface AgentCard {
  /** 协议版本，用于版本协商。A2A v1.0 用 "1.0"。 */
  protocolVersion: string;
  name: string;
  description: string;
  /** A2A 服务端点（JSON-RPC / REST）。 */
  url: string;
  /** agent 自己的版本（和 protocolVersion 不是一回事）。 */
  version: string;
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
  };
  skills: Skill[];
  /** 收费提示（教学字段）：null=免费。 */
  pricing?: { unit: string; amount: string; token: string } | null;
  /** 支持的链（教学字段），如 ["base-sepolia"]。 */
  chains?: string[];
  /** 只有 Signed Agent Card 才有：JWS 分离签名 + 签名者公钥（教学里内联）。 */
  signature?: CardSignature;
}

export interface CardSignature {
  /** JWS 保护头（base64url(JSON)），含 alg。 */
  protected: string;
  /** JWS 签名值（base64url）。 */
  signature: string;
  /** 教学简化：把签名者公钥内联进来，省掉 DID/JWKS 解析这步。 */
  publicKeyPem: string;
}

// ---------------------------------------------------------------------------
// JCS —— JSON Canonicalization Scheme（RFC 8785）的教学实现
//   核心规则：对象 key 按 UTF-16 码元升序排序、去掉多余空白、递归。
//   顺序敏感：少排一层、多一个空格，规范化字节就变，签名立刻对不上。
//   ⚠️ 生产请用经过测试的 canonicalize 库（如 canonicalize / rfc8785）。
// ---------------------------------------------------------------------------

export function jcsCanonicalize(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => jcsCanonicalize(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(); // 关键：key 升序
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${jcsCanonicalize(obj[k])}`)
      .join(",");
    return "{" + body + "}";
  }
  throw new Error(`JCS 无法规范化的类型: ${typeof value}`);
}

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

export function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64url");
}

// ---------------------------------------------------------------------------
// JWS —— 对「JCS 规范化后的 Agent Card」用 Ed25519 签名（RFC 7515，教学版）
//   分离签名：签的是 card 去掉 signature 字段后的规范化字节。
//   alg 用 EdDSA（Ed25519），Node 内置支持，无需第三方库。
// ---------------------------------------------------------------------------

export interface KeyPair {
  publicKeyPem: string;
  privateKey: KeyObject;
}

export function generateEd25519(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey,
  };
}

/** 取 card 去掉 signature 后的部分，JCS 规范化。这是签名和验签的共同输入。 */
export function signingInput(card: AgentCard): string {
  const { signature: _omit, ...rest } = card;
  return jcsCanonicalize(rest);
}

/** owner 侧：产出一张 Signed Agent Card。 */
export function signCard(card: AgentCard, key: KeyPair): AgentCard {
  const protectedHeader = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWS" }));
  const payload = b64url(signingInput(card));
  const signingBytes = Buffer.from(`${protectedHeader}.${payload}`, "utf8");
  const sig = nodeSign(null, signingBytes, key.privateKey);
  return {
    ...card,
    signature: {
      protected: protectedHeader,
      signature: sig.toString("base64url"),
      publicKeyPem: key.publicKeyPem,
    },
  };
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/** client 侧：验证一张 Signed Agent Card 的 JWS。 */
export function verifyCard(card: AgentCard): VerifyResult {
  const sig = card.signature;
  if (!sig) return { ok: false, reason: "Agent Card 没有 signature（未签名卡）" };

  let alg: string;
  try {
    const header = JSON.parse(Buffer.from(sig.protected, "base64url").toString("utf8"));
    alg = header.alg;
  } catch {
    return { ok: false, reason: "JWS protected header 解析失败" };
  }
  if (alg !== "EdDSA") return { ok: false, reason: `不支持的 alg: ${alg}` };

  // 关键：验签时用【当前 card】重新算 JCS 规范化输入。
  // 只要 card 任何字段被篡改，signingInput 就变，验签必失败。
  const payload = b64url(signingInput(card));
  const signingBytes = Buffer.from(`${sig.protected}.${payload}`, "utf8");

  let pubKey: KeyObject;
  try {
    pubKey = createPublicKey(sig.publicKeyPem);
  } catch {
    return { ok: false, reason: "公钥 PEM 解析失败" };
  }

  const valid = nodeVerify(
    null,
    signingBytes,
    pubKey,
    Buffer.from(sig.signature, "base64url"),
  );
  return valid ? { ok: true } : { ok: false, reason: "JWS 签名校验不通过（卡被篡改或非该公钥所签）" };
}

// ---------------------------------------------------------------------------
// 版本协商（A2A-Version）
// ---------------------------------------------------------------------------

export const SUPPORTED_A2A_VERSIONS = ["1.0"] as const;

export function negotiateVersion(
  clientRequested: string,
  serverSupported: readonly string[] = SUPPORTED_A2A_VERSIONS,
): VerifyResult {
  if (serverSupported.includes(clientRequested)) return { ok: true };
  return {
    ok: false,
    reason: `不支持的 A2A-Version: ${clientRequested}（server 支持 ${serverSupported.join(", ")}）`,
  };
}

// ---------------------------------------------------------------------------
// Agent Card 结构校验（发现链路的第一步，验签之前）
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof AgentCard)[] = [
  "protocolVersion",
  "name",
  "url",
  "version",
  "capabilities",
  "skills",
];

export function validateCardShape(card: Partial<AgentCard>): VerifyResult {
  for (const f of REQUIRED_FIELDS) {
    if (card[f] === undefined) return { ok: false, reason: `Agent Card 缺字段: ${f}` };
  }
  if (!Array.isArray(card.skills) || card.skills.length === 0) {
    return { ok: false, reason: "Agent Card 的 skills 为空" };
  }
  if (!/^https?:\/\//.test(card.url ?? "")) {
    return { ok: false, reason: `Agent Card 的 url 不是合法 http(s) 端点: ${card.url}` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Fixtures：一张合法卡的“基底”，各 demo 在它上面改造出坏卡。
// ---------------------------------------------------------------------------

export function baseCard(url = "https://agent-b.example/a2a"): AgentCard {
  return {
    protocolVersion: "1.0",
    name: "chain-reader-agent",
    description: "查 Base Sepolia 链上只读数据（余额 / 区块号）",
    url,
    version: "0.1.0",
    capabilities: { streaming: true, pushNotifications: false },
    skills: [
      {
        id: "get-balance",
        name: "getBalance",
        description: "查询某地址在 Base Sepolia 的原生余额",
        tags: ["onchain-read", "base-sepolia", "balance"],
      },
    ],
    pricing: null,
    chains: ["base-sepolia"],
  };
}

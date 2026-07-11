import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import type { AgentCard } from "@a2a-js/sdk";
import { A2A_BASE_URL, CHAIN, SIGN_AGENT_CARD } from "./config.js";

// ============================================================================
// 组装 A2A Agent Card。签名开时用 JCS + JWS 产出 Signed Agent Card。
// 这里的 JCS/JWS 与 protocol-lab/shared.ts 同一套原理（Ed25519，教学演示）。
// client.ts 会拉这张卡、验签、再派任务。
// ============================================================================

/** 本进程启动时生成一把 owner 签名密钥。真实系统里私钥在 KMS/HSM，公钥经 DID/JWKS 发布。 */
const signingKey = generateKeyPairSync("ed25519");
export const OWNER_PUBLIC_KEY_PEM = signingKey.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

// ---- JCS（RFC 8785 教学实现，与 lab 一致）----
function jcs(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(jcs).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => `${JSON.stringify(k)}:${jcs(obj[k])}`).join(",") + "}";
}

/** 未签名的基础卡（A2A v0.3.x SDK 的 AgentCard 形状）。 */
export function buildBaseCard(): AgentCard {
  return {
    protocolVersion: "0.3.0", // ⚠️ SDK 实现 spec v0.3.0；协议已 v1.0（见正文版本核验）
    name: "chain-reader-agent",
    description: "查 Base Sepolia 链上只读数据（余额 / 区块号 / nonce）",
    url: `${A2A_BASE_URL}/`,
    version: "0.1.0",
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "get-balance",
        name: "getBalance",
        description: "查询某地址在 Base Sepolia 的原生余额",
        tags: ["onchain-read", CHAIN, "balance"],
      },
    ],
  };
}

/** JWS 分离签名：签的是卡去掉 signatures 后的 JCS 规范化字节。 */
export function buildAgentCard(): AgentCard {
  const card = buildBaseCard();
  if (!SIGN_AGENT_CARD) return card;

  const protectedHeader = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "JWS" })).toString("base64url");
  const payload = Buffer.from(jcs(card)).toString("base64url");
  const sig = nodeSign(null, Buffer.from(`${protectedHeader}.${payload}`), signingKey.privateKey);

  // A2A v0.3.x 的 AgentCard 有 signatures 字段（AgentCardSignature[]）。
  // 教学里把公钥放进 header，省掉 JWKS 解析这一步。
  return {
    ...card,
    signatures: [
      {
        protected: protectedHeader,
        signature: sig.toString("base64url"),
        header: { publicKeyPem: OWNER_PUBLIC_KEY_PEM },
      },
    ],
  };
}

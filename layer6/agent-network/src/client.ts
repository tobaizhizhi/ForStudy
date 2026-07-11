import { verify as nodeVerify, createPublicKey } from "node:crypto";
import { pathToFileURL } from "node:url";
import { ClientFactory, JsonRpcTransportFactory } from "@a2a-js/sdk/client";
import type { AgentCard } from "@a2a-js/sdk";
import { v4 as uuidv4 } from "./uuid.js";
import { A2A_BASE_URL, DEMO_ADDRESS } from "./config.js";

// ============================================================================
// 进程③：client —— 发现 A2A agent → 验签 Agent Card → 派任务 → 收结果。
// 这是 agent-to-agent 一次完整交接的“请求方”。
//
// 起：pnpm start:client（需要 mcp-server + a2a-agent 已在跑）
// ============================================================================

// ---- JCS（与 agent 侧一致）----
function jcs(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(jcs).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => `${JSON.stringify(k)}:${jcs(obj[k])}`).join(",") + "}";
}

/** 验证 Signed Agent Card 的 JWS（对应 protocol-lab 的 verifyCard）。 */
export function verifySignedCard(card: AgentCard): { ok: boolean; reason?: string } {
  const sigs = (card as AgentCard & { signatures?: any[] }).signatures;
  if (!sigs || sigs.length === 0) return { ok: false, reason: "未签名卡（没有 signatures）" };
  const sig = sigs[0];
  const pem = sig.header?.publicKeyPem as string | undefined;
  if (!pem) return { ok: false, reason: "签名里没有公钥（教学内联字段缺失）" };

  // 关键：验签时用【当前卡】去掉 signatures 后重算 JCS —— 篡改任何字段都会失败。
  const { signatures: _omit, ...rest } = card as AgentCard & { signatures?: any[] };
  const payload = Buffer.from(jcs(rest)).toString("base64url");
  const signingBytes = Buffer.from(`${sig.protected}.${payload}`);
  try {
    const valid = nodeVerify(null, signingBytes, createPublicKey(pem), Buffer.from(sig.signature, "base64url"));
    return valid ? { ok: true } : { ok: false, reason: "JWS 校验不通过（卡被篡改或非该公钥所签）" };
  } catch (e) {
    return { ok: false, reason: `验签异常：${(e as Error).message}` };
  }
}

/** 直接抓 well-known Agent Card（保留我们内联的 signatures.header 公钥）。 */
export async function fetchAgentCard(baseUrl: string): Promise<AgentCard> {
  const res = await fetch(`${baseUrl}/.well-known/agent-card.json`);
  if (!res.ok) throw new Error(`拉取 Agent Card 失败：HTTP ${res.status}`);
  return (await res.json()) as AgentCard;
}

async function main(): Promise<void> {
  console.log("========== agent-to-agent 一次任务交接 ==========\n");

  // 1) 发现：拉 Agent Card（默认 /.well-known/agent-card.json）
  const card = await fetchAgentCard(A2A_BASE_URL);
  console.log(`[client] 发现 agent: ${card.name}  protocolVersion=${card.protocolVersion}`);
  console.log(`[client] 能力: ${card.skills.map((s) => s.name).join(", ")}`);

  // 2) 验签（发现链路的信任闸）
  const verified = verifySignedCard(card);
  console.log(`[client] Agent Card 验签: ${verified.ok ? "✅ 通过" : "⛔ 拒绝 —— " + verified.reason}`);
  if (!verified.ok) {
    console.log("[client] 未通过验签，拒绝把任务派给它（避免调用伪装 agent）。");
    return;
  }

  // 3) 派任务
  const factory = new ClientFactory({ transports: [new JsonRpcTransportFactory()] });
  const client = await factory.createFromUrl(A2A_BASE_URL);
  const question = `查一下 ${DEMO_ADDRESS} 在 Base Sepolia 的余额`;
  console.log(`\n[client] 派任务："${question}"`);

  const result = await client.sendMessage({
    message: {
      kind: "message",
      messageId: uuidv4(),
      role: "user",
      parts: [{ kind: "text", text: question }],
    },
  });

  // 4) 收结果
  const reply = result as { kind?: string; parts?: { kind: string; text?: string }[] };
  if (reply.parts) {
    const text = reply.parts.filter((p) => p.kind === "text").map((p) => p.text).join("");
    console.log(`\n[client] agent 回复：${text}`);
  } else {
    console.log(`\n[client] 收到响应：${JSON.stringify(result)}`);
  }
  console.log("\n这次交接：client 发现 → 验签 → 派任务 → agent 内部调 MCP 查真链 → 回真实链上数据。");
}

// 只有直接运行本文件时才跑 main（被 gateway.ts import 时不触发，避免日志混淆）。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

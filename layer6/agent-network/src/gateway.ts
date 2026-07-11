import { ClientFactory, JsonRpcTransportFactory } from "@a2a-js/sdk/client";
import type { AgentCard } from "@a2a-js/sdk";
import { v4 as uuidv4 } from "./uuid.js";
import { A2A_BASE_URL, CHAIN, DEMO_ADDRESS } from "./config.js";
import { fetchAgentCard, verifySignedCard } from "./client.js";

// ============================================================================
// 里程碑：Agent Protocol Gateway
//   把全层能力收敛成一个网关，跑一次端到端交接 + 一次错误回放。
//   组成：A2A discovery（含 JWS 验签）+ 版本协商 + 轻量服务目录撮合 + HTTP fallback；
//         ERC-8004 信誉作可插拔模块（这里用 fixture 供 reputation，接口留链上口）。
//
// 起：pnpm start:gateway（需要 mcp-server + a2a-agent 已在跑）
// ============================================================================

const SUPPORTED_VERSIONS = ["0.3.0", "1.0"]; // SDK 实现 0.3.x；同时声明能协商到 1.0 概念

interface DirectoryEntry {
  name: string;
  baseUrl: string;
  capability: string;
  chain: string;
  /** 可插拔：真实系统里应来自 ERC-8004 Reputation 注册表，而非本地写死。 */
  reputation: number;
}

/** ERC-8004 可插拔口：现在读 fixture，未来换成链上 Reputation 注册表查询。 */
function getReputation(_agentUrl: string): number {
  return 88; // fixture
}

async function discoverAndVerify(baseUrl: string): Promise<AgentCard | null> {
  const card = await fetchAgentCard(baseUrl);

  // 闸 1：版本协商
  if (!SUPPORTED_VERSIONS.includes(card.protocolVersion)) {
    console.log(`[gateway] ⛔ 版本不兼容：${card.protocolVersion} 不在 ${SUPPORTED_VERSIONS.join(", ")} → 尝试 HTTP fallback`);
    return null;
  }

  // 闸 2：JWS 验签
  const v = verifySignedCard(card);
  if (!v.ok) {
    console.log(`[gateway] ⛔ Agent Card 验签失败：${v.reason} → 拒绝，不派任务`);
    return null;
  }
  console.log(`[gateway] ✅ ${card.name} 验签通过、版本 ${card.protocolVersion} 可协商`);
  return card;
}

async function dispatch(baseUrl: string, question: string): Promise<void> {
  const client = await new ClientFactory({ transports: [new JsonRpcTransportFactory()] }).createFromUrl(baseUrl);
  const result = await client.sendMessage({
    message: { kind: "message", messageId: uuidv4(), role: "user", parts: [{ kind: "text", text: question }] },
  });
  const reply = result as { parts?: { kind: string; text?: string }[] };
  const text = reply.parts?.filter((p) => p.kind === "text").map((p) => p.text).join("") ?? JSON.stringify(result);
  console.log(`[gateway] 任务结果：${text}`);
}

async function main(): Promise<void> {
  console.log("========== Agent Protocol Gateway：端到端 + 错误回放 ==========\n");

  // ---- 正常路径 ----
  console.log("① 正常交接：发现 → 验签 → 目录撮合 → 派任务");
  const card = await discoverAndVerify(A2A_BASE_URL);
  if (card) {
    // 轻量服务目录撮合（按能力 + 链 + 信誉）
    const entry: DirectoryEntry = {
      name: card.name,
      baseUrl: A2A_BASE_URL,
      capability: "onchain-read",
      chain: CHAIN,
      reputation: getReputation(A2A_BASE_URL),
    };
    console.log(`[gateway] 目录撮合命中：${entry.name}（能力=${entry.capability} 链=${entry.chain} 信誉=${entry.reputation}）`);
    await dispatch(A2A_BASE_URL, `查一下 ${DEMO_ADDRESS} 在 Base Sepolia 的余额`);
  }

  // ---- 错误回放：喂一张被篡改的卡 ----
  console.log("\n② 错误回放：一张被篡改的 Agent Card 必须被拒绝");
  const good = await fetchAgentCard(A2A_BASE_URL);
  const tampered: AgentCard = { ...good, url: "http://attacker.example/a2a" };
  const v = verifySignedCard(tampered);
  console.log(`[gateway] 篡改 url 后验签：${v.ok ? "✅（不该通过！）" : "⛔ 拒绝 —— " + v.reason}`);
  console.log(`[gateway] 决策：拒绝该卡，不把任务派给可能是伪造端点的 agent。`);

  console.log("\n网关把 A2A 发现+验签、版本协商、目录撮合、错误回放串成了一条可审计的决策链。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

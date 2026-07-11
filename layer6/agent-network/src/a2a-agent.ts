import express from "express";
import { v4 as uuidv4 } from "./uuid.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { AgentExecutor, ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import type { Message } from "@a2a-js/sdk";
import { A2A_PORT, MCP_URL, SIGN_AGENT_CARD } from "./config.js";
import { buildAgentCard } from "./a2a-agent-card.js";

// ============================================================================
// 进程②：A2A agent —— 发布 Agent Card，接任务，内部调 MCP server 的链上工具。
// 展示 MCP↔A2A 边界：对外用 A2A 接任务，对内用 MCP 调工具。
//
// 起：pnpm start:agent（需要 mcp-server 已在跑）
// ============================================================================

/** 从任务消息里抽出纯文本。 */
function textOf(message: Message): string {
  return message.parts
    .filter((p): p is { kind: "text"; text: string } => p.kind === "text")
    .map((p) => p.text)
    .join(" ")
    .trim();
}

/** 内部调 MCP server 的一个工具（Streamable HTTP）。 */
async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  const client = new Client({ name: "a2a-chain-agent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  try {
    const result = await client.callTool({ name, arguments: args });
    const parts = (result.content ?? []) as { type: string; text?: string }[];
    return parts.filter((c) => c.type === "text").map((c) => c.text).join("");
  } finally {
    await client.close();
  }
}

// 极简意图解析：从任务文本里找 "0x..." 地址，选工具。
function parseIntent(text: string): { tool: string; args: Record<string, unknown> } {
  const addr = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
  if (/block/i.test(text)) return { tool: "getBlockNumber", args: {} };
  if (/nonce|tx.?count/i.test(text) && addr) return { tool: "getTxCount", args: { address: addr } };
  if (addr) return { tool: "getBalance", args: { address: addr } };
  return { tool: "getBlockNumber", args: {} };
}

class ChainReaderExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const text = textOf(requestContext.userMessage);
    const { tool, args } = parseIntent(text);
    console.log(`[a2a-agent] 收到任务："${text}" → 调 MCP 工具 ${tool}(${JSON.stringify(args)})`);

    let replyText: string;
    try {
      const toolResult = await callMcpTool(tool, args);
      replyText = `${tool} 结果：${toolResult}`;
    } catch (e) {
      replyText = `工具调用失败：${(e as Error).message}`;
    }

    const reply: Message = {
      kind: "message",
      messageId: uuidv4(),
      role: "agent",
      parts: [{ kind: "text", text: replyText }],
      taskId: requestContext.taskId,
      contextId: requestContext.contextId,
    };
    eventBus.publish(reply);
    eventBus.finished();
  }

  async cancelTask(): Promise<void> {
    // 本 demo 的任务是即时完成的，无需取消逻辑。
  }
}

async function main(): Promise<void> {
  const agentCard = buildAgentCard();
  const requestHandler = new DefaultRequestHandler(agentCard, new InMemoryTaskStore(), new ChainReaderExecutor());

  const app = express();
  new A2AExpressApp(requestHandler).setupRoutes(app);

  app.listen(A2A_PORT, "0.0.0.0", () => {
    console.log(`[a2a-agent] Agent Card: http://127.0.0.1:${A2A_PORT}/.well-known/agent-card.json`);
    console.log(`[a2a-agent] 签名：${SIGN_AGENT_CARD ? "开（Signed Agent Card）" : "关（未签名卡）"}`);
    console.log(`[a2a-agent] 上游 MCP 工具：${MCP_URL}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

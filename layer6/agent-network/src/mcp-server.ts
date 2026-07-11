import express, { type Request, type Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MCP_PORT } from "./config.js";
import { getBalance, getBlockNumber, getTxCount } from "./mcp-tools.js";

// ============================================================================
// 进程①：MCP server —— 把 Base Sepolia 只读链能力封装成 MCP 工具。
// 传输用 Streamable HTTP（SSE 已废弃）。这是 a2a-agent 内部要调的“工具后端”。
//
// 起：pnpm start:mcp
// ============================================================================

function buildServer(): McpServer {
  const server = new McpServer({ name: "mcp-chain-server", version: "0.1.0" });

  server.registerTool(
    "getBalance",
    {
      description: "查询某地址在 Base Sepolia 的原生 ETH 余额",
      inputSchema: { address: z.string().describe("0x 开头的以太坊地址") },
    },
    async ({ address }) => {
      const r = await getBalance(address);
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    },
  );

  server.registerTool(
    "getBlockNumber",
    { description: "查询 Base Sepolia 最新区块号", inputSchema: {} },
    async () => {
      const r = await getBlockNumber();
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    },
  );

  server.registerTool(
    "getTxCount",
    {
      description: "查询某地址在 Base Sepolia 的交易数（nonce）",
      inputSchema: { address: z.string().describe("0x 开头的以太坊地址") },
    },
    async ({ address }) => {
      const r = await getTxCount(address);
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    },
  );

  return server;
}

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // 无状态模式：每个请求现建 server + transport（sessionIdGenerator: undefined）。
  // 教学够用；生产要按会话复用（见正文模块 3）。
  app.post("/mcp", async (req: Request, res: Response) => {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(MCP_PORT, "0.0.0.0", () => {
    console.log(`[mcp-server] Base Sepolia 只读工具已上线：http://127.0.0.1:${MCP_PORT}/mcp`);
    console.log(`[mcp-server] 工具：getBalance / getBlockNumber / getTxCount`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

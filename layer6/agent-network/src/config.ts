// ============================================================================
// agent-network 统一配置。
// 只读公共 RPC，无私钥、无写链、无付费 API key。签名私钥为可选开关。
// ============================================================================

/** Base Sepolia 公共 RPC（只读）。可用 .env 的 RPC_URL 覆盖。 */
export const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";

/** 链标识，用于 Agent Card 的能力声明与目录撮合。 */
export const CHAIN = "base-sepolia";

/** 三个进程的端口。 */
export const MCP_PORT = Number(process.env.MCP_PORT ?? 41241);
export const A2A_PORT = Number(process.env.A2A_PORT ?? 41242);

/** MCP server 的 Streamable HTTP 端点（a2a-agent 的 executor 会连它）。
 *  用 127.0.0.1 而非 localhost：避免 WSL2/Node 下 localhost 解析到 IPv6 造成 ECONNREFUSED。 */
export const MCP_URL = process.env.MCP_URL ?? `http://127.0.0.1:${MCP_PORT}/mcp`;

/** A2A agent 的对外地址（client 从这里发现它）。同样用 127.0.0.1。 */
export const A2A_BASE_URL = process.env.A2A_BASE_URL ?? `http://127.0.0.1:${A2A_PORT}`;

/**
 * 是否给 Agent Card 签名（Signed Agent Card）。
 * 默认开；关掉可演示“未签名卡被 client 拒绝”。
 */
export const SIGN_AGENT_CARD = process.env.SIGN_AGENT_CARD !== "false";

/** 一个用来演示的查询地址（有历史活动的 Base Sepolia 地址）。 */
export const DEMO_ADDRESS =
  process.env.DEMO_ADDRESS ?? "0x0000000000000000000000000000000000000000";

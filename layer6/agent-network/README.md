# agent-network —— Layer 6 真实三进程 demo

用**真实** `@modelcontextprotocol/sdk` 与 `@a2a-js/sdk`，把「MCP 接工具、A2A 接 agent」跑成三个真进程：

```
client / gateway          a2a-agent                 mcp-chain-server
（请求方）  ──A2A 发现──▶ （提供方）  ──MCP 调工具──▶ （工具后端）
  验签 Card               发布 Signed Card            viem 真连 Base Sepolia
  派任务                  executor 接任务              getBalance / getBlockNumber / getTxCount
```

只读公共 Base Sepolia RPC，**无私钥、不写链、无付费 API key**（签名私钥进程启动时自动生成，仅用于给 Agent Card 签名）。

## 跑起来（开三个终端）

```bash
pnpm install

# 终端 1：MCP server（Base Sepolia 只读工具）
pnpm start:mcp

# 终端 2：A2A agent（发布 Signed Agent Card；需要终端 1 已起）
pnpm start:agent

# 终端 3：client 发现→验签→派任务（需要终端 1、2 已起）
pnpm start:client
```

里程碑网关（正常交接 + 目录撮合 + 错误回放，需要终端 1、2 已起）：

```bash
pnpm start:gateway
```

类型检查：

```bash
pnpm typecheck
```

## 预期输出（client）

```
[client] 发现 agent: chain-reader-agent  protocolVersion=0.3.0
[client] Agent Card 验签: ✅ 通过
[client] 派任务："查一下 0x... 在 Base Sepolia 的余额"
[client] agent 回复：getBalance 结果：{"address":"0x...","balanceEth":"..."}
```

回的是**真实链上余额**——agent 内部通过 MCP 调 `getBalance`，viem 连公共 RPC 查到的。

## 演示「未签名卡被拒绝」

```bash
# 终端 2 改用未签名卡重启
SIGN_AGENT_CARD=false pnpm start:agent
# 终端 3 再跑 client → 验签这步会 ⛔ 拒绝，不派任务
pnpm start:client
```

## 文件职责

| 文件 | 进程 | 职责 |
| --- | --- | --- |
| `config.ts` | 共用 | RPC / 端口 / MCP URL / 签名开关（用 127.0.0.1 避免 WSL2 下 localhost 解析到 IPv6） |
| `mcp-tools.ts` | ① | viem 只读连 Base Sepolia：getBalance / getBlockNumber / getTxCount |
| `mcp-server.ts` | ① | MCP server（StreamableHTTP + Express），注册三个工具 |
| `a2a-agent-card.ts` | ② | 组装 Agent Card，签名开时 JCS+JWS 产 Signed Card |
| `a2a-agent.ts` | ② | A2A agent：AgentExecutor 接任务→内部调 MCP→回结果 |
| `client.ts` | ③ | 发现→验签→派任务；`verifySignedCard` 复用给 gateway |
| `gateway.ts` | ③ | 里程碑网关：发现+验签+版本协商+目录撮合+错误回放 |
| `uuid.ts` | 共用 | `crypto.randomUUID` 包装，省一个依赖 |

## 边界（诚实标注，2026-07）

- **`@a2a-js/sdk` 当前实现 A2A spec v0.3.0**，而 A2A *协议*已发 v1.0。所以卡里 `protocolVersion` 是 `0.3.0`，SDK 的 API（`ClientFactory` / `AgentExecutor`）也是 v0.3.x 形态。v1.0 的概念（11 方法、三 binding、破坏性变更）见正文模块 6；**追平前以当前 npm 包为准**。
- **`@modelcontextprotocol/sdk` 用 v1.x**（生产支持版；v2 拆包演进中，v1 至少再维护 6 个月）。传输用 StreamableHTTP（SSE 已废弃），导入路径带 `.js` 后缀。
- Signed Agent Card 的 JWS/JCS 是**教学演示实现**（Node 内置 Ed25519，公钥内联进 card），不是生产的 DID/JWKS 信任链。
- 服务目录的 `reputation` 是 fixture；`gateway.ts` 的 `getReputation()` 留了 ERC-8004 Reputation 注册表的可插拔口（见正文模块 9）。

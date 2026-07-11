# 模块 3：MCP 传输层 —— stdio 与 StreamableHTTP

上一模块我们把链上只读能力封装成了 MCP 工具（`getBalance` / `getBlockNumber` / `getTxCount`）。但工具封装好只是一半——**server 和 client 之间靠什么把 JSON-RPC 消息传过去？** 这就是传输层（transport）要解决的问题。

传输层选错，你的 MCP server 要么只能自己机器上的进程用，要么根本连不上远程 agent。而本层的北极星业务是「A2A agent 内部调 MCP 工具查真链」——这一跳恰恰是**远程调用**。所以本章要把传输选型讲清楚：什么时候用 stdio，什么时候用 StreamableHTTP，以及为什么 SSE 传输已经被废弃。

> 目标：能说清 stdio 与 StreamableHTTP 的适用边界；能起一个用 StreamableHTTP 的远程可调 MCP server；能从 client 侧用 URL 连上它；知道 SSE 传输为什么被废弃、无状态与有状态会话的区别。

## 3.1 为什么传输层要分「本地」和「远程」两种

MCP 协议本身只规定「消息长什么样」（JSON-RPC 2.0 的 request / response / notification），不规定「消息怎么送到对面」。送法就是 transport。官方 SDK 提供两条主线：

- **stdio**：server 是 client **同机拉起的子进程**，两边通过标准输入 / 标准输出（stdin / stdout）收发 JSON-RPC 帧。像 IDE 里的插件、桌面 App 里内置的工具服务，都是这么接的。
- **StreamableHTTP**：server 是一个 **HTTP 服务**，client 用一个 URL 连过去。跨网络、多客户端、要加鉴权 / 网关 / 负载均衡时，只能走它。

用一个类比：

> stdio 像**内线电话**——同一栋楼里拉一根线，插上就通，没有拨号、没有身份验证，因为对方就是你自己叫起来的。StreamableHTTP 像**打外线**——要有对方的号码（URL），要过总机（HTTP / 鉴权 / 网关），因为对面是另一台机器、可能同时有很多人在打。

**为什么这是把 MCP 接到 A2A 的关键一跳？** 因为 A2A agent 和它要调的 MCP 工具，天然是两个独立进程（甚至两台机器）。agent 不可能把 MCP server 当子进程 `spawn` 起来——那样每个 agent 都得自带一份工具后端，还谈什么「多 agent 共享工具」。正确姿势是：**MCP server 独立部署成一个 HTTP 服务，agent 用 URL 连它。** 这就必须用 StreamableHTTP。

```text
本地插件场景（stdio）           远程 agent 场景（StreamableHTTP，本层用这个）

┌──────────────┐               ┌──────────────┐        HTTP        ┌──────────────┐
│  IDE / App   │               │  A2A agent   │  ───────────────►  │  MCP server  │
│  (client)    │               │  (client)    │   POST /mcp URL    │  (独立进程)  │
│    │spawn    │               └──────────────┘  ◄───────────────  └──────────────┘
│    ▼         │                     可在另一台机器 / 容器 / 多个 agent 共用一个 server
│ ┌──────────┐ │
│ │MCP server│ │  ← 同机子进程
│ │(subproc) │ │     stdin/stdout 收发
│ └──────────┘ │
└──────────────┘
```

本层的 `agent-network` 走的是右边这条：`mcp-server.ts` 是独立进程①，`a2a-agent.ts`（进程②）用 URL 连它。

## 3.2 传输对照表

| 维度 | stdio | StreamableHTTP |
| --- | --- | --- |
| 部署形态 | client **拉起的同机子进程** | 独立 HTTP 服务 |
| client 怎么连 | `spawn` 一个命令，接 stdin/stdout | 一个 **URL**（`http://host:port/mcp`） |
| 跨网络 | ❌ 只能同机 | ✅ 可跨机 / 跨容器 |
| 多客户端 | ❌ 一个子进程服务一个 client | ✅ 一个 server 服务多个 client |
| 鉴权 / 网关 | ❌ 没有 HTTP 层可挂 | ✅ 可挂 Bearer / OAuth / 反代 / 限流 |
| 生命周期 | 随 client 起停 | 独立起停，可长驻 |
| 典型场景 | IDE 插件、桌面 App 内置工具 | 远程 agent、SaaS 化工具、本层 A2A↔MCP |
| SDK transport 类 | `StdioServerTransport` / `StdioClientTransport` | `StreamableHTTPServerTransport` / `StreamableHTTPClientTransport` |

**关于已废弃的 SSE 传输（重要）：** 老版本 MCP 曾有一个独立的 **HTTP+SSE transport**（两个端点：一个 POST 收请求、一个 GET 长连 SSE 推响应）。它已被 **StreamableHTTP 取代并标记废弃**——StreamableHTTP 把两者合并到**单个 `/mcp` 端点**，按需在同一次 HTTP 交互里升级成 SSE 流（只在服务端需要流式推送时才用 SSE）。

> 结论（截至 2026-07）：**新写的 MCP server 不要再用独立 SSE 传输**（`SSEServerTransport` / `SSEClientTransport` 属遗留），远程一律用 StreamableHTTP。SSE 只是 StreamableHTTP **内部按需的一种响应形态**，不再是一个你要单独选的 transport。

## 3.3 真实代码：server 侧用 StreamableHTTP（无状态模式）

这就是 `agent-network/src/mcp-server.ts` 里那个真进程。注意三个要点：**导入路径带 `.js` 后缀**、`sessionIdGenerator: undefined` 开无状态模式、用 express 把 transport 挂在 `/mcp` 上。

```ts
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MCP_PORT } from "./config.js";
import { getBalance, getBlockNumber, getTxCount } from "./mcp-tools.js";

async function main(): Promise<void> {
  const app = express();
  app.use(express.json());

  // 无状态模式：每个请求现建 server + transport（sessionIdGenerator: undefined）。
  // 教学够用；生产要按会话复用（见 3.5）。
  app.post("/mcp", async (req: Request, res: Response) => {
    const server = buildServer();  // 见上一模块：registerTool 挂 3 个链上工具
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
  });
}
```

逐行拆关键点：

- **`@modelcontextprotocol/sdk/server/streamableHttp.js`**：导入路径**必须带 `.js` 后缀**，这是 SDK 的 ESM 导出约定，去掉后缀会 `ERR_MODULE_NOT_FOUND`。server 侧的 `McpServer` 在 `.../server/mcp.js`。
- **`sessionIdGenerator: undefined`**：这是**无状态模式**的开关。传 `undefined`，server 就不发 `Mcp-Session-Id`、不维护会话状态，每个请求当成一次独立的完整交互。教学 / 只读工具够用，也最省心。
- **每请求现建 `server` + `transport`**：无状态下不复用实例，`res.on("close")` 里把 transport 和 server 都 `close()` 掉，防泄漏。
- **`await server.connect(transport)` 再 `transport.handleRequest(req, res, req.body)`**：先把 MCP server 接到这个 transport，再让 transport 处理这一次 HTTP 请求。因为 express 已 `express.json()` 解析过 body，这里把 `req.body` 显式传进去。
- **`app.listen(MCP_PORT, "0.0.0.0", ...)`**：绑 `0.0.0.0`（见 3.5 的坑）。

## 3.4 真实代码：client 侧用 URL 连接

client 侧就是 `a2a-agent.ts` 里 `callMcpTool()` 的写法——A2A agent 的 executor 每次要查链，就当一回 MCP client 去连 server：

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MCP_URL } from "./config.js";  // "http://127.0.0.1:41241/mcp"

/** 内部调 MCP server 的一个工具（Streamable HTTP）。 */
async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  const client = new Client({ name: "a2a-chain-agent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));  // ← 只要一个 URL
  await client.connect(transport);
  try {
    const result = await client.callTool({ name, arguments: args });
    const parts = (result.content ?? []) as { type: string; text?: string }[];
    return parts.filter((c) => c.type === "text").map((c) => c.text).join("");
  } finally {
    await client.close();
  }
}
```

对比 server 侧，client 侧的关键点：

- **导入路径同样带 `.js`**：`.../client/index.js`（`Client` 类）、`.../client/streamableHttp.js`（transport）。
- **`new StreamableHTTPClientTransport(new URL(MCP_URL))`**：client 侧连接**只需要一个 URL**，不需要知道 server 用了 express 还是别的框架、无状态还是有状态。这正是「远程」的意义——两端只靠 URL 和协议耦合。
- **`connect → callTool → close`**：连上、调工具、用完关掉。无状态 server 下每次 `callTool` 都是独立请求，用完即走没有负担。
- **`result.content` 里抽 `type: "text"` 的部分**：MCP 工具返回的是 content 数组（上一模块工具里 `return { content: [{ type: "text", text: ... }] }`），这里过滤出文本拼起来。

把 3.3 和 3.4 合起来看：server 在 `41241/mcp` 上等，agent 用 `MCP_URL` 连过去调 `getBalance`，server 里的工具用 viem 查 Base Sepolia 真余额，结果沿原路返回。**这一整跳全靠 StreamableHTTP。**

## 3.5 无状态 vs 有状态会话

`sessionIdGenerator` 那个开关决定了 server 是「无状态」还是「有状态」。两者的差别用图看最清楚：

```text
无状态（sessionIdGenerator: undefined）—— 本层用这个
  client ──POST /mcp (initialize+call 一次完整交互)──►  ┌─────────────┐
         ◄──────────── response ──────────────────────  │ 每请求现建   │
  client ──POST /mcp (下一次，全新)──────────────────►  │ server+transp│
         ◄──────────── response ──────────────────────  │ 不记会话     │
                                                          └─────────────┘
  特点：无 Mcp-Session-Id；请求间不共享状态；实例用完即弃；最省心、天然可水平扩展

有状态（sessionIdGenerator: () => randomUUID()）
  client ──POST /mcp initialize──►  server 生成 Mcp-Session-Id 回传
  client ──POST /mcp (带同一 Session-Id) 后续调用──►  server 按 id 找回同一会话
         ◄──── 可在同一会话里做 SSE 流式推送、保留上下文 ────
  特点：server 维护会话表；支持流式 / 有上下文的多轮；要处理会话过期、跨实例共享
```

选型很简单：

| 需求 | 选无状态 | 选有状态 |
| --- | --- | --- |
| 只读、单次工具调用（本层） | ✅ | 过度设计 |
| 每请求独立、想直接水平扩展 | ✅ | 需共享会话存储才行 |
| 需要服务端流式推送 / 长任务进度 | 一般够（单次交互内也能流） | ✅ 更自然 |
| 需要跨多轮保留服务端上下文 | ❌ | ✅ |

本层 `mcp-server.ts` 选无状态，因为工具是**只读、无副作用、单次完成**的——查个余额不需要记住你是谁。生产里若工具有多轮上下文或长任务，再上有状态（`sessionIdGenerator: () => crypto.randomUUID()`，并维护会话复用与过期回收）。

【学习提示】本章的 server **不是纸上代码，就是 `agent-network` 里那个真进程**——`pnpm start:mcp` 起来的就是它，`pnpm start:agent` 里的 agent 就靠 3.4 那段连它。你可以真的开两个终端，一个起 server、一个起 agent，看 agent 打印「收到任务 → 调 MCP 工具 → 返回 Base Sepolia 真实余额」。

**顺带一个 WSL2 下的真坑（务必记住）：** server 绑 `0.0.0.0`、client 连 `127.0.0.1`，都**别用 `localhost`**。原因是 WSL2 / Node 下 `localhost` 常被解析到 IPv6 的 `::1`，而 server 若只监听在 IPv4，client 连 `localhost` 就吃 `ECONNREFUSED`——一个「代码全对但就是连不上」的经典坑。所以 `config.ts` 里 `MCP_URL` 写死 `http://127.0.0.1:41241/mcp`，server `app.listen(port, "0.0.0.0", ...)` 监听所有 IPv4 网卡。记这条规矩即可：**监听用 `0.0.0.0`，连接用 `127.0.0.1`，两边都躲开 `localhost`。**

## 3.6 版本核验（重要）

以下均为**实测**（截至 **2026-07**），动手前仍以你 `node_modules` 里的当前版本为准：

- **`@modelcontextprotocol/sdk` 实测 `1.29.0`**（v1.x 生产支持线；v2 正在拆包演进，但 v1 至少还会维护一段时间）。
- **导入路径必须带 `.js` 后缀**（SDK 的 ESM 导出约定）：
  - server：`@modelcontextprotocol/sdk/server/mcp.js`、`@modelcontextprotocol/sdk/server/streamableHttp.js`
  - client：`@modelcontextprotocol/sdk/client/index.js`、`@modelcontextprotocol/sdk/client/streamableHttp.js`
  - 去掉 `.js` 会 `ERR_MODULE_NOT_FOUND`，这是最常见的上手报错。
- **远程传输一律用 StreamableHTTP；SSE 传输已废弃**（`SSEServerTransport` / `SSEClientTransport` 属遗留兼容，新项目不用）。SSE 现在只是 StreamableHTTP 内部按需的响应形态，不是独立可选的 transport。
- **`StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` = 无状态模式**；要有状态传 `sessionIdGenerator: () => crypto.randomUUID()`。
- **`zod` 是 peer 依赖**（上一模块 `registerTool` 的 `inputSchema` 用 zod shape），需一并安装。
- server 监听 `0.0.0.0`、client 连 `127.0.0.1`、**都别用 `localhost`**（WSL2/IPv6 `ECONNREFUSED` 坑）。

## 本模块小结

- MCP 传输分两条主线：**stdio**（同机子进程，走 stdin/stdout，用于本地插件）与 **StreamableHTTP**（HTTP 服务，用一个 URL 连，用于远程 / 多客户端 / 可鉴权）。
- 把 MCP 接到 A2A **必须走 StreamableHTTP**：agent 和 MCP server 是独立进程，agent 用 URL 连 server，这是本层的关键一跳。
- **SSE 传输已废弃**：远程一律 StreamableHTTP，SSE 只是它内部按需的响应形态。
- server 侧：`StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` + express 挂 `/mcp`；client 侧：`new StreamableHTTPClientTransport(new URL(MCP_URL))`。
- 导入路径**带 `.js` 后缀**；无状态（`undefined`）最省心且天然可扩展，有状态才需要维护会话表。
- WSL2 坑：监听 `0.0.0.0`、连接 `127.0.0.1`、都躲开 `localhost`。

## 复习题

1. stdio 与 StreamableHTTP 各自的部署形态是什么？client 分别怎么连上 server？
2. 为什么「把 MCP 接到 A2A」必须用 StreamableHTTP 而不能用 stdio？
3. SSE 传输现在处于什么状态？远程 MCP 该用哪种传输，SSE 现在扮演什么角色？
4. `StreamableHTTPServerTransport` 的 `sessionIdGenerator: undefined` 表示什么模式？和有状态模式在生命周期、会话、扩展性上差在哪？
5. 无状态模式下，为什么代码要「每请求现建 server + transport」并在 `res.on("close")` 里 `close()`？
6. SDK 的导入路径为什么要带 `.js` 后缀？去掉会报什么错？
7. `callMcpTool()` 里，client 连 server 只需要什么？这说明「远程」的两端靠什么耦合？
8. WSL2 下为什么 server 绑 `0.0.0.0`、client 连 `127.0.0.1`，且两边都不用 `localhost`？不遵守会出现什么现象？
9. 什么样的工具场景适合无状态、什么场景需要有状态会话？本层的链上只读工具为什么选无状态？

下一模块，我们从 MCP 转到 A2A：一张 Agent Card 到底有哪些字段、agent 怎么被发现，以及 MCP（接工具）和 A2A（接 agent）的边界到底划在哪。

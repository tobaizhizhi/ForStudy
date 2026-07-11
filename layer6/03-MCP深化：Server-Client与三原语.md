# 模块 2：MCP 深化 —— Server/Client 与三原语

Layer 5 你已经用 MCP 造过工具：把「查链上余额」封装成一个 tool，让 agent 的大脑能调它。那一层的重点是「工具怎么用」。这一模块把 MCP 本身的全貌补齐——**Server 和 Client 各是什么、三原语（tools / resources / prompts）在语义上到底差在哪、以及为什么本层要在这些之上再接一层 A2A。**

> 目标：能说清 MCP 的 Server↔Client 结构，分清三原语的「谁控制、有没有副作用」，并能读懂脚手架里 `mcp-server.ts` 用 `registerTool` 把只读链查询封装成 tool 的真实代码，以及高层 Client 的 `listTools` / `callTool`。

## 2.1 为什么还要「深化」——L5 造工具，L6 补全貌

Layer 5 是站在「工具作者」的视角：写一个函数，注册成 tool，agent 就能调。但那时你没被要求关心：这个 tool 是被谁托管的？调用方（agent 的大脑）和被调方（工具）之间是什么关系？除了 tool，MCP 还能暴露别的东西吗？

这一模块补的就是这三块。因为到了 Layer 6，agent 不再是「自己有大脑 + 自己的工具」这么简单——它要把工具**通过网络**暴露给别的 agent，还要和 A2A 拼在一起用。不搞清楚 MCP 的 Server/Client 分工和三原语语义，后面「MCP 接工具、A2A 接 agent」这条边界就画不清。

先记住一句心智：

```text
MCP = agent 的大脑（Host/Client） ↔ 一堆能力（Server） 之间的标准接口
      Client 发起，Server 提供。一个 Host 可以同时连多个 Server。
```

## 2.2 Server 和 Client 分别是什么

MCP 里有三个角色，别混：

| 角色 | 是什么 | 在我们脚手架里对应谁 |
| --- | --- | --- |
| **Host** | 拿主意的那个应用（agent 的大脑 / IDE / Claude Desktop） | `a2a-agent.ts` 的 executor——它决定「这次要调哪个工具」 |
| **Client** | Host 内部、一对一连某个 Server 的连接器 | `a2a-agent.ts` 里 `new Client(...)` 那个实例 |
| **Server** | 把某类能力（工具 / 数据 / 模板）暴露出来的进程 | `mcp-server.ts`——把 Base Sepolia 只读查询暴露成工具 |

关键关系：**一个 Host 里可以有多个 Client，每个 Client 一对一连一个 Server。** 你可以同时连「链上工具 Server」「文件系统 Server」「数据库 Server」，Host 统一调度。Client 和 Server 是 1:1 的长连接，Host 是 1:N 的调度者。

在我们的真实脚手架里，这条链路是这样接的：

```text
a2a-agent（Host + Client）                        mcp-server（Server）
  收到 A2A 任务 → parseIntent 选工具 ──MCP 调用──▶  registerTool 注册的 getBalance
  new Client(...) + StreamableHTTPClientTransport                    │
                                                     viem 只读连 Base Sepolia
  ◀──────────────── tool 结果（余额 JSON）──────────────────────────┘
```

也就是说，**同一个 `a2a-agent` 进程，对外是 A2A 的 Server（接别的 agent 的任务），对内是 MCP 的 Client（去调链上工具 Server）。** 这正是本层「MCP 接工具、A2A 接 agent」分工的最小活样本。

## 2.3 三原语：tools / resources / prompts

MCP Server 能暴露三类东西，叫「三原语（primitives）」。它们最容易被初学者混成一团，但语义差别很大，核心就问两件事：**谁来控制它、它有没有副作用。**

| 原语 | 谁控制 | 语义类比 | 有无副作用 | 典型用途 |
| --- | --- | --- | --- | --- |
| **tools** | 模型（LLM）自主决定调用 | 类 HTTP `POST` / 函数调用 | **可能有**（写、转账、发消息…） | 让 agent「做事」：查链、下单、调合约 |
| **resources** | 应用 / 用户挑选、喂给上下文 | 类 HTTP `GET`（幂等、只读） | **无**（纯读） | 给模型「看资料」：文件、配置、一段链上快照 |
| **prompts** | 用户显式选取的模板 | 类「菜单里的预设指令」 | 无（只是模板） | 用户触发的可复用工作流：`/审计这个合约` |

【学习提示】三原语最好用「控制权在谁手上」来记：**tools 是模型自己决定调（model-controlled）**，所以有副作用的风险，必须让模型判断时机；**resources 是应用/用户决定塞进上下文（app-controlled）**，本质是只读数据，像 GET 一样应当幂等、无副作用；**prompts 是用户主动从菜单里选（user-controlled）**，是给人用的预设模板。三者不是「三种函数」，而是「三种控制权归属」。

一个高频误区：把「只读查询」既能做成 tool 也能做成 resource，到底选哪个？判据是——**如果你希望模型在推理时自主决定要不要去查，就做成 tool；如果是你（应用）想主动把一份数据塞进上下文让模型参考，就做成 resource。** 我们脚手架把「查余额」做成 **tool**，正是因为要让 agent 根据任务文本自己判断该不该查、查谁。

## 2.4 密集真实代码：把「查链上余额」封装成 tool

看脚手架 `agent-network/src/mcp-server.ts`。用 `McpServer` + `registerTool` 注册工具，`inputSchema` 用 zod 描述参数（peer 依赖 zod，SDK 靠它做运行时校验 + 生成给模型看的 JSON Schema）：

```ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getBalance, getBlockNumber, getTxCount } from "./mcp-tools.js";

function buildServer(): McpServer {
  const server = new McpServer({ name: "mcp-chain-server", version: "0.1.0" });

  server.registerTool(
    "getBalance",
    {
      description: "查询某地址在 Base Sepolia 的原生 ETH 余额",
      inputSchema: { address: z.string().describe("0x 开头的以太坊地址") }, // zod shape
    },
    async ({ address }) => {
      const r = await getBalance(address);                   // 真去 viem 只读查链
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    },
  );

  server.registerTool(
    "getBlockNumber",
    { description: "查询 Base Sepolia 最新区块号", inputSchema: {} }, // 空 shape = 无参
    async () => {
      const r = await getBlockNumber();
      return { content: [{ type: "text", text: JSON.stringify(r) }] };
    },
  );

  return server;
}
```

三个要点，逐个看清：

1. **`registerTool(name, config, handler)` 三段式**：名字、配置（`description` + `inputSchema`）、异步 handler。`description` 不是给人看的注释——它是喂给模型判断「什么时候该调这个工具」的关键信号，写清楚工具做什么。
2. **`inputSchema` 是一个 zod shape（对象字面量），不是 `z.object(...)`**。SDK 内部会包成 object 并用它做两件事：运行时校验入参、生成给模型的 JSON Schema。无参工具传 `{}`。
3. **返回值是 `{ content: [...] }`**，`type: "text"` 的文本块。工具真正的实现（`getBalance`）在 `mcp-tools.ts` 里用 viem 只读连 Base Sepolia——**只读、不写链、不碰私钥**，这是本层对工具后端的硬约束。

工具后端本体（`agent-network/src/mcp-tools.ts` 节选），一眼确认它就是只读：

```ts
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

export async function getBalance(address: string) {
  if (!isAddress(address)) throw new Error(`不是合法地址: ${address}`);
  const wei = await publicClient.getBalance({ address });      // 只读
  return { address, balanceWei: wei.toString(), balanceEth: formatEther(wei) };
}
```

## 2.5 高层 Client：listTools 与 callTool

Server 注册好工具，调用方（Client）怎么用？看 `a2a-agent.ts` 里 executor 内部调 MCP 的真实写法：

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  const client = new Client({ name: "a2a-chain-agent", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);                 // 内部先完成 initialize 握手
  try {
    const result = await client.callTool({ name, arguments: args }); // 调 getBalance
    const parts = (result.content ?? []) as { type: string; text?: string }[];
    return parts.filter((c) => c.type === "text").map((c) => c.text).join("");
  } finally {
    await client.close();
  }
}
```

`callTool` 是「调某个工具」；配套还有 `listTools`，让 Client 先问 Server「你都有哪些工具、各要什么参数」——这是「能力发现」，让调用方（尤其是模型）动态知道有什么可调：

```ts
const { tools } = await client.listTools();
// tools = [{ name: "getBalance", description: "...", inputSchema: {...} }, ...]
// 真实 agent 会把这份清单喂给模型，让它自己决定调哪个、传什么参数
```

对应地，`resources` 有 `listResources` / `readResource`，`prompts` 有 `listPrompts` / `getPrompt`——**每个原语都是「list（列出有什么）+ 取用（调/读/取）」这一对方法**。记住这个对称结构，三原语的 Client API 就不用死记。

## 2.6 时序：initialize → capabilities → 调用

`client.connect(transport)` 这一句背后，MCP 做了标准的能力协商握手。展开看：

```text
Client (a2a-agent)                                Server (mcp-server)
     │                                                   │
     │  1. initialize（我支持的协议版本 + 我的能力）        │
     │ ─────────────────────────────────────────────────▶│
     │                                                   │  选一个双方都支持的版本
     │  2. initialize result（协商后的版本 + 我暴露的能力） │  声明：我有 tools 能力
     │ ◀─────────────────────────────────────────────────│
     │                                                   │
     │  3. notifications/initialized（握手完成）           │
     │ ─────────────────────────────────────────────────▶│
     │                                                   │
     │  4. tools/list（你都有哪些工具？）                   │
     │ ─────────────────────────────────────────────────▶│
     │  5. 工具清单（getBalance / getBlockNumber / ...）    │
     │ ◀─────────────────────────────────────────────────│
     │                                                   │
     │  6. tools/call getBalance {address}                │
     │ ─────────────────────────────────────────────────▶│  viem 查 Base Sepolia
     │  7. result（余额 JSON）                             │
     │ ◀─────────────────────────────────────────────────│
```

第 1-3 步是 **initialize 握手 + capabilities 协商**：双方先对齐协议版本、互相声明「我支持 tools / resources / prompts 里的哪些」。SDK 把它包在 `connect()` 里，你看不到手写帧，但它真实发生。第 4 步起才是业务：先 `list` 发现能力，再 `call` 真正调用。**注意 `listTools`/`callTool` 是 SDK 高层方法名，线上实际的 JSON-RPC 方法名是 `tools/list` / `tools/call`**——SDK 帮你把方法名和 JSON-RPC 帧都封好了。

## 2.7 Layer 5 与 Layer 6 的分工：MCP 在这里的位置

到这里要把一条边界钉死，否则后面 A2A 一进来就乱：

```text
Layer 5：用 MCP「造工具」——把链上能力写成 tool，让单个 agent 的大脑能调
          关注点：工具怎么写、agent 怎么用工具做决策（本地、单进程即可）

Layer 6：把 MCP「深化 + 接到 A2A」
          - 深化：Server/Client 全貌、三原语语义、能力协商握手（本模块）
          - 传输：把 MCP 从「本地进程内」升级成「远程可调」（下一模块 StreamableHTTP）
          - 接 A2A：MCP 只负责「agent↔工具」，A2A 负责「agent↔agent」；
                    我们的 a2a-agent 对外用 A2A 接任务，对内用 MCP 调工具
```

一句话：**MCP 是 agent 和它的工具之间的接口；A2A 是 agent 和别的 agent 之间的接口。** 本层坚决不拿 A2A 当工具协议，也不拿 MCP 当 agent 发现协议。你在 `a2a-agent.ts` 里看到的「对外 A2A Server、对内 MCP Client」的双重身份，就是这条分工的落地写法，后面模块 4-6 讲 A2A 时会反复回到它。

## 2.8 版本核验（务必按当前包动手）

- **`@modelcontextprotocol/sdk` 实测版本 `1.29.0`**。这是 v1.x 生产支持版；v2 正在拆包演进中，但 v1 至少还会再维护约 6 个月，教学与本层脚手架都锁 v1.x。动手前以你 `pnpm ls @modelcontextprotocol/sdk` 的实际版本为准。
- **导入路径必须带 `.js` 后缀**（ESM 规范），这是最容易踩的坑：
  - Server：`@modelcontextprotocol/sdk/server/mcp.js`、`@modelcontextprotocol/sdk/server/streamableHttp.js`
  - Client：`@modelcontextprotocol/sdk/client/index.js`、`@modelcontextprotocol/sdk/client/streamableHttp.js`
- **`zod` 是 peer 依赖**，要单独装（`pnpm add zod`）。`registerTool` 的 `inputSchema` 收的是 zod **shape（对象字面量）**，不是 `z.object(...)`；SDK 内部包装并用它做入参校验 + 生成 JSON Schema。
- **传输用 StreamableHTTP，SSE 传输已废弃**——本模块只用到它的 Client/Server 类；「为什么废弃 SSE、stdio 和 StreamableHTTP 怎么选」是下一模块（MCP 传输层）的正题，这里先不展开。
- 对应脚手架文件：`agent-network/src/mcp-server.ts`（Server + registerTool）、`agent-network/src/mcp-tools.ts`（viem 只读工具后端）、`agent-network/src/a2a-agent.ts`（内部 MCP Client 的 `callTool`）。三终端起 `pnpm start:mcp` / `start:agent` / `start:client` 即可看到完整链路。

## 本模块小结

- MCP 有三角色：**Host**（拿主意的应用）、**Client**（Host 内 1:1 连某 Server 的连接器）、**Server**（暴露能力的进程）；一个 Host 可连多个 Server。
- 三原语按「控制权归属」区分：**tools**（模型自主调、可能有副作用，类 POST）、**resources**（应用/用户喂上下文、只读幂等，类 GET）、**prompts**（用户从菜单选的模板）。
- 用 `McpServer` + `registerTool(name, {description, inputSchema}, handler)` 注册工具；`inputSchema` 是 zod shape，返回 `{ content: [{ type: "text", text }] }`。
- 高层 Client 每个原语都是「list + 取用」一对方法：`listTools`/`callTool`、`listResources`/`readResource`、`listPrompts`/`getPrompt`。
- `client.connect()` 内部完成 **initialize → capabilities 协商 → initialized** 握手，之后才 `tools/list` → `tools/call`。
- 分工：**Layer 5 用 MCP 造工具；Layer 6 深化 MCP（全貌+三原语+握手）、升级传输、并接到 A2A**。MCP 接工具，A2A 接 agent，各司其职。
- 工具后端只读、不写链、不碰私钥；导入路径带 `.js`，zod 是 peer 依赖，SDK 锁 v1.29.0。

## 复习题

1. MCP 的 Host、Client、Server 各是什么？三者在数量关系上是怎样的（谁 1:N、谁 1:1）？
2. 在我们的脚手架里，`a2a-agent` 进程同时扮演了哪两个协议里的什么角色？为什么说它是「MCP 接工具、A2A 接 agent」的最小样本？
3. 三原语 tools / resources / prompts，分别由谁控制、有没有副作用、类比到哪个 HTTP 方法？
4. 同一个「只读链查询」，什么情况下应该做成 tool、什么情况下做成 resource？我们脚手架为什么选了 tool？
5. `registerTool` 的 `inputSchema` 收的是 `z.object(...)` 还是 zod shape？无参工具怎么写？SDK 拿这个 schema 做哪两件事？
6. 高层 Client 里 `listTools` 和 `callTool` 分别解决什么问题？其它两个原语的对应方法叫什么？
7. `client.connect(transport)` 这一句背后，MCP 在真正调工具前完成了哪几步握手？为什么需要「capabilities 协商」？
8. SDK 方法名 `listTools` / `callTool` 对应线上的哪两个 JSON-RPC 方法名？
9. 为什么导入路径必须带 `.js`？漏掉会怎样？
10. 用一句话说清 Layer 5 和 Layer 6 在「MCP」这件事上的分工差别。
```

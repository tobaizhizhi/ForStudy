# 模块 10：里程碑 —— Agent Protocol Gateway

前面九个模块，我们一件件把零件磨出来了：MCP 把链上能力封成工具、A2A 定义 Agent Card 与任务、JWS+JCS 给卡签名验签、版本协商处理 v0.3.0↔v1.0 落差、服务目录按能力/信誉撮合、ERC-8004 当可插拔身份层。这一模块把它们**收敛成一个网关**，让两个 agent 完成一次真实的、可审计的任务交接。

> 目标：交付 **Agent Protocol Gateway**——一个进程同时接住 A2A discovery（含 JWS 验签）、版本协商、轻量服务目录撮合、HTTP fallback，ERC-8004 信誉作可插拔模块。跑通一次端到端交接：client 发现 agent B → 验签 → 撮合 → 派任务 → B 内部调 MCP 查真链 → 回真实余额；再演一次错误回放：篡改的卡被 ⛔ 拒绝。

## 10.1 为什么要一个 gateway

到模块 9 为止，能力是散的：MCP server 一个进程、A2A agent 一个进程、验签逻辑在 client 里、目录撮合在 lab 里。真实系统里，一个 agent 要接入网络，得有一个**统一的入口**替它做完“发现→信任→路由→派发”这一整套决策——这就是网关。

用一句话说清网关的价值：

```text
没有 gateway：每个调用方各写一遍“抓卡→验签→协商→撮合→派任务→错误处理”，各写各的、各漏各的
有   gateway：这套决策链收敛到一个地方，一次写对，所有交接都走同一条可审计的闸门
```

网关不是新协议，它是**把本层所有安全约束串成一条决策链的编排层**。任何一步不过（版本不兼容 / 验签失败 / 撮合不到），它就停下来，要么降级、要么拒绝，绝不带着一张没验过的卡去派任务。

## 10.2 网关的四个组成 + 一个可插拔模块

对照 `agent-network/src/gateway.ts`，网关由四块硬能力 + 一块可插拔模块组成：

| 组成 | 职责 | 来自本层哪个模块 | 落在哪个进程/文件 |
| --- | --- | --- | --- |
| MCP server（链上只读工具） | `getBalance`/`getBlockNumber`/`getTxCount`，viem 只连 Base Sepolia | 模块 2、3 | `src/mcp-server.ts` + `src/mcp-tools.ts` |
| A2A discovery（含 JWS 验签） | 抓 `/.well-known/agent-card.json`、JCS 重算、JWS 验签 | 模块 4、5 | `src/gateway.ts` 的 `discoverAndVerify` → `verifySignedCard` |
| 版本协商 | `protocolVersion` 落在支持集里才继续，否则走 fallback | 模块 6 | `src/gateway.ts` 的 `SUPPORTED_VERSIONS` 闸 |
| 轻量服务目录 | 按能力 / 链 / 信誉撮合出目标 agent | 模块 7、8 | `src/gateway.ts` 的 `DirectoryEntry` 撮合 |
| ERC-8004 信誉（可插拔） | 给撮合提供 reputation 分；现在读 fixture，未来换链上注册表 | 模块 9 | `src/gateway.ts` 的 `getReputation()` |

关键是那块**可插拔**的信誉模块。网关不把架构焊死在 ERC-8004 当前接口上，而是留一个函数口子：

```ts
/** ERC-8004 可插拔口：现在读 fixture，未来换成链上 Reputation 注册表查询。 */
function getReputation(_agentUrl: string): number {
  return 88; // fixture
}
```

今天它返回一个 fixture 分数（88），明天把函数体换成一次链上 `ReputationRegistry` 读取，网关其余逻辑一行不改。**这就是“信誉可插拔”落到代码里的样子。**

## 10.3 网关的决策链闸门

网关把发现拆成两道闸，任一不过就返回 `null`（触发 fallback 或拒绝），看 `discoverAndVerify`：

```ts
const SUPPORTED_VERSIONS = ["0.3.0", "1.0"]; // SDK 实现 0.3.x；同时声明能协商到 1.0 概念

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
```

验签复用 `client.ts` 的 `verifySignedCard`——它的核心是**去掉 `signatures` 后用当前卡重算 JCS**，所以篡改任何字段都会让 JWS 校验失败：

```ts
// 关键：验签时用【当前卡】去掉 signatures 后重算 JCS —— 篡改任何字段都会失败。
const { signatures: _omit, ...rest } = card as AgentCard & { signatures?: any[] };
const payload = Buffer.from(jcs(rest)).toString("base64url");
const signingBytes = Buffer.from(`${sig.protected}.${payload}`);
const valid = nodeVerify(null, signingBytes, createPublicKey(pem), Buffer.from(sig.signature, "base64url"));
```

两道闸都过，才轮到目录撮合，才轮到派任务——**顺序是硬的：版本 → 验签 → 撮合 → 派发。**

## 10.4 端到端剧本（gateway.ts 实测输出）

网关的 `main()` 跑两幕：正常交接 + 错误回放。这是 `pnpm start:gateway` 的真实控制台输出（已实测，余额/区块随链上活动变化）：

```text
========== Agent Protocol Gateway：端到端 + 错误回放 ==========

① 正常交接：发现 → 验签 → 目录撮合 → 派任务
[gateway] ✅ chain-reader-agent 验签通过、版本 0.3.0 可协商
[gateway] 目录撮合命中：chain-reader-agent（能力=onchain-read 链=base-sepolia 信誉=88）
[a2a-agent] 收到任务："查一下 0x0000...0000 在 Base Sepolia 的余额" → 调 MCP 工具 getBalance({"address":"0x00...00"})
[gateway] 任务结果：getBalance 结果：{"address":"0x00...00","balanceWei":"...","balanceEth":"..."}

② 错误回放：一张被篡改的 Agent Card 必须被拒绝
[gateway] 篡改 url 后验签：⛔ 拒绝 —— JWS 校验不通过（卡被篡改或非该公钥所签）
[gateway] 决策：拒绝该卡，不把任务派给可能是伪造端点的 agent。

网关把 A2A 发现+验签、版本协商、目录撮合、错误回放串成了一条可审计的决策链。
```

把这两幕画成时序图，看清每一跳发生了什么：

```text
  gateway            a2a-agent(B)          mcp-server            Base Sepolia RPC
    │                    │                     │                       │
 ①  │  GET /.well-known/agent-card.json        │                       │
    │───────────────────>│                     │                       │
    │  <── Signed Card (protocolVersion=0.3.0, signatures[])           │
    │                    │                     │                       │
    │ 闸1 版本 0.3.0 ∈ {0.3.0,1.0} ✅          │                       │
    │ 闸2 去 signatures 重算 JCS → JWS 验签 ✅  │                       │
    │ 撮合：能力=onchain-read 链=base-sepolia 信誉=88(ERC-8004 口)      │
    │                    │                     │                       │
 ②  │ message/send "查 0x… 的余额"             │                       │
    │───────────────────>│                     │                       │
    │                    │ MCP callTool getBalance                     │
    │                    │────────────────────>│  eth_getBalance       │
    │                    │                     │──────────────────────>│
    │                    │                     │  <── wei（真实链上值） │
    │                    │  <── {balanceEth}   │                       │
    │  <── message: "getBalance 结果：{…真实余额…}"                     │
    │                    │                     │                       │
 ③  │ 篡改卡 url=http://attacker.example/a2a → 重算 JCS 不匹配 → JWS ⛔  │
    │  决策：拒绝，不派任务                    │                       │
```

第 ① 幕，网关走两道闸放行；第 ② 幕，任务落到 agent B，B 用 MCP Client 调 `getBalance`，`mcp-tools.ts` 里 viem 真发 `eth_getBalance` 到 Base Sepolia，回来的是**当前区块的真实余额**；第 ③ 幕，把卡的 `url` 改成攻击者地址，重算 JCS 与签名对不上，JWS 直接 ⛔。

【学习提示】错误回放用的是 `{ ...good, url: "http://attacker.example/a2a" }`——只改一个字段。这恰恰演示了 JWS+JCS 的价值：签名覆盖**整张卡的规范化字节**，改任何一个字段（哪怕只是 endpoint URL）都会让验签失败。攻击者没法“保留签名、只换 endpoint 把你导向假 agent”。

## 10.5 三进程编排 + 里程碑网关

网关本身不重造 MCP/A2A 进程，它**复用**已经跑起来的三进程，自己只当第四个入口。启动顺序（依赖从底向上）：

```text
终端1  pnpm start:mcp      进程①  MCP server 上线（Base Sepolia 只读工具，端口 41241）
终端2  pnpm start:agent    进程②  A2A agent 发布 Signed Card、连上游 MCP（端口 41242）
终端3  pnpm start:client   进程③  一次朴素交接：发现→验签→派任务（可选，验证链路）
终端3  pnpm start:gateway  里程碑  正常交接 + 错误回放（需要 ①② 已在跑）
```

`start:client` 和 `start:gateway` 都是“请求方”，区别在：`client.ts` 演示**一次朴素交接**（发现→验签→派任务），`gateway.ts` 在它之上加了**版本协商闸、目录撮合、ERC-8004 信誉口、错误回放**——网关是 client 的“加了决策链的升级版”。二者共用 `fetchAgentCard` / `verifySignedCard`，所以你先跑通 `start:client`，再跑 `start:gateway` 就顺理成章。

对照大纲（`01-course-outline.md`）的**安全验收清单**，逐条看是哪个进程/闸门在强制它：

| 安全验收条目 | 由谁强制 | 体现在哪 |
| --- | --- | --- |
| 未签名 / 验签失败的卡必须拒绝 | 网关闸 2 `verifySignedCard` | `discoverAndVerify` 返回 `null`，不派任务 |
| 版本不兼容必须拒绝 | 网关闸 1 `SUPPORTED_VERSIONS` | `protocolVersion` 不在集合内 → fallback/拒绝 |
| 伪造 endpoint 的卡必须拒绝 | JWS+JCS（改 `url` 即验签失败） | 错误回放第 ③ 幕 |
| 派任务前必做：结构校验→验签→版本协商 | 网关决策链顺序 | 闸 1 → 闸 2 → 撮合 → `dispatch` |
| 目录 endpoint 与验证结果一致 | 撮合只对**验签通过**的卡建目录项 | 先 `discoverAndVerify` 才 `DirectoryEntry` |
| MCP 工具只读、不写链、不碰私钥 | `mcp-tools.ts` 只用 `createPublicClient` | 无 `WalletClient`、无私钥 |
| A2A agent 不代持资金 | agent B 只调只读工具回文本 | `ChainReaderExecutor` 无转账逻辑 |
| 信誉来源要标注（fixture / 可插拔） | `getReputation` 注释显式标注 | 返回 fixture 88，留链上口 |
| 协议降级要显式可见可审计 | fallback 分支打印日志 | 闸 1 未过时打印 `→ 尝试 HTTP fallback` |

【学习提示】这张表就是里程碑的验收标准。每一条都能指到**具体的代码位置**——这正是“可审计”的含义：不是“我觉得安全”，而是“这条约束由这行代码强制，日志里看得见”。

## 10.6 实测数据：这不是 mock

网关派的任务落到 agent B，B 用 `a2a-agent.ts` 里的 MCP Client 调 `getBalance`，最终由 `mcp-tools.ts` 真发 RPC：

```ts
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

export async function getBalance(address: string) {
  if (!isAddress(address)) throw new Error(`不是合法地址: ${address}`);
  const wei = await publicClient.getBalance({ address }); // 真实 eth_getBalance
  return { address, balanceWei: wei.toString(), balanceEth: formatEther(wei) };
}
```

`RPC_URL` 默认 `https://sepolia.base.org`（Base Sepolia 公共 RPC，只读、无 API key）。怎么证明它不是 mock？

- 换一个 `DEMO_ADDRESS`（`.env` 里改），余额随查询地址变化——mock 不会。
- `getBlockNumber` 每隔几秒再跑一次，区块号在**递增**——它跟着 Base Sepolia 真实出块。
- 断网重跑，`getBalance` 直接抛 RPC 连接错误——它真的在打网络。

这三点就是“真连链、非 mock”的证据。整条链路上**没有一处伪造数据**：网关的信誉分是显式标注的 fixture（并留了链上口），其余全是真实协议调用 + 真实链上读取。

## 10.7 边界与诚实标注：签名/ERC-8004 是开关，v0.3.0 与 v1.0 的差距在此集中

里程碑必须把本层所有“可选”和“落差”一次说清，别让读者误以为 demo 就是生产。

**（1）签名是可选开关。** `config.ts` 的 `SIGN_AGENT_CARD` 默认开；设 `SIGN_AGENT_CARD=false` 重跑，agent 发的就是**未签名卡**，网关闸 2 会打 `⛔ 未签名卡（没有 signatures）` 并拒绝。这条开关本身就是安全验收“未签名卡必须拒绝”的现场演示。

**（2）ERC-8004 信誉是可插拔模块，当前是 fixture。** `getReputation()` 返回写死的 88，注释明确标注“未来换成链上 Reputation 注册表查询”。本层只做到“留好可插拔口”，真正落链留到 Capstone——不要把这个 88 当成真实链上信誉。

**（3）签名与验签是教学手写版。** `a2a-agent-card.ts` / `client.ts` 里的 JCS（RFC 8785）和 JWS（RFC 7515）是用 Node 内置 `crypto` 手写的 Ed25519 演示，公钥内联在 `signatures[].header.publicKeyPem` 里省掉了 JWKS/DID 解析。**生产要用成熟的 JOSE 库 + 独立的公钥信任链（DID/JWKS）**，不要用这个教学版。

**（4）本层最重要的诚实标注——SDK v0.3.0 vs 协议 v1.0。** 这是网关代码里最需要盯住的落差，集中在这里说：

- `@a2a-js/sdk` 实测版本 **0.3.14**，实现的是 A2A **spec v0.3.0**；但 A2A 协议本身已经发布 **v1.0**。所以本层**讲概念按 v1.0，写代码按 SDK 的 v0.3.x API**——卡里 `protocolVersion` 就是 `"0.3.0"`（见 `a2a-agent-card.ts`），这不是笔误，是 SDK 当前实现的真实版本。
- 网关的 `SUPPORTED_VERSIONS = ["0.3.0", "1.0"]` 同时声明这两个值：`"0.3.0"` 是 SDK 实测能跑的，`"1.0"` 是概念上要能协商到的目标。真实升级时，v1.0 的**破坏性变更**要落到代码：任务状态枚举从 kebab-case 变 SCREAMING_SNAKE_CASE、`TaskStatusUpdateEvent` 去掉 `final` 字段、pushNotification 操作重命名、security scheme 变判别联合、OAuth 加 Device Code(RFC 8628)/PKCE 去掉 implicit/password。
- 用到的 SDK v0.3.x API（本章都真实调用过，动手前仍以当前 npm 包为准）：`ClientFactory` + `createFromUrl`、`AgentExecutor`(`execute`/`cancelTask`)、`RequestContext`(`.userMessage`/`.taskId`/`.contextId`)、`ExecutionEventBus`(`.publish`/`.finished`)、`DefaultRequestHandler(agentCard, taskStore, executor)`、`A2AExpressApp(handler).setupRoutes(app)`、`InMemoryTaskStore`，Agent Card 默认路径 `/.well-known/agent-card.json`。
- MCP 侧：`@modelcontextprotocol/sdk` 实测 **1.29.0**（v1.x 生产支持版，v2 拆包演进中但 v1 至少再维护 6 个月）。传输用 **StreamableHTTP**（SSE 已废弃）；导入路径带 `.js` 后缀（`.../server/mcp.js`、`.../server/streamableHttp.js`、`.../client/index.js`、`.../client/streamableHttp.js`）；`McpServer.registerTool(name, { description, inputSchema }, cb)`，peer 依赖 `zod`。

## 本模块小结

- 网关不是新协议，是**把本层安全约束串成一条决策链的编排层**：版本 → 验签 → 撮合 → 派发，顺序是硬的，任一不过就 fallback 或拒绝。
- 四块硬能力：MCP 只读工具 + A2A discovery(含 JWS 验签) + 版本协商 + 轻量服务目录；一块可插拔模块：ERC-8004 信誉（`getReputation` 留链上口，当前 fixture）。
- 端到端两幕：正常交接（发现→验签→撮合信誉=88→派任务→agent 内部调 MCP 查真链→回真实余额）+ 错误回放（篡改 `url` 的卡 JWS ⛔ 拒绝）。
- 三进程编排：`start:mcp`(①) → `start:agent`(②) → `start:client`/`start:gateway`(③)；网关复用三进程，是 client 加了决策链的升级版。
- 安全验收清单每一条都能指到具体代码位置，这就是“可审计”——不是感觉安全，是日志里看得见。
- 真连 Base Sepolia、余额随链上活动变化证明非 mock；签名/ERC-8004 是可选开关；SDK v0.3.0 与协议 v1.0 的落差在本模块集中标注。

## 复习题

1. 网关的四块硬能力分别是什么？各来自本层哪个模块？
2. 网关的决策链顺序是“版本 → 验签 → 撮合 → 派发”，为什么这个顺序不能乱？把验签放到派任务之后会有什么后果？
3. `verifySignedCard` 为什么要“去掉 `signatures` 后重算 JCS”？如果直接验原卡（含 signatures）会怎样？
4. 错误回放只改了卡的一个 `url` 字段，为什么 JWS 验签就失败了？这说明签名覆盖了什么？
5. `getReputation()` 现在返回写死的 88。它体现了“信誉可插拔”的哪个设计？未来要落链，改哪里、不改哪里？
6. `SIGN_AGENT_CARD=false` 重跑，网关会在哪一道闸、打什么日志、做什么决策？这对应安全验收的哪一条？
7. 怎么证明网关拿到的余额不是 mock？至少给出两条可操作的验证方法。
8. 卡里的 `protocolVersion` 是 `"0.3.0"`，但我们讲概念按 v1.0。这个落差的根因是什么？升级到 v1.0 时，哪些破坏性变更要落到代码？
9. 网关的 MCP 工具为什么只用 `createPublicClient` 而没有 `WalletClient`？这对应安全验收的哪一条？
10. `start:client` 和 `start:gateway` 都是请求方，网关比 client 多做了哪几件事？

至此，Layer 6 的能力全部收敛到了一个可审计的网关里。下一步（后续层 / Capstone）会在这之上加支付（x402 / AP2 让 agent 自主付款）、把 ERC-8004 信誉真正落到链上，并给高金额动作引入人工审批 mandate——网络从“能协作”走向“能交易”。

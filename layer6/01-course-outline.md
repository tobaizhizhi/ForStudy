# Layer 6 课程大纲 — Agent 通信协议

目标：把 Layer 5 里「一个 agent 自己有大脑、有工具」，升级成「多个 agent 能通过开放标准互相发现、验证、协作、交接任务」。

这一层是「agent-to-agent」这个名字真正落地的地方。前面几层铺好了地基：

- Layer 4：给 agent 一把受限 session key 钱包（能自主花钱，但花得住手）。
- Layer 5：给 agent 大脑和工具——用 MCP 把链上能力封装成工具，用 workflow 编排决策。
- Layer 6（本层）：让 agent 走出孤岛——**A2A** 负责发现和协作，**MCP** 负责工具接入，**ERC-8004** 负责身份和信誉。

Layer 6 要回答一个很具体的问题：

```text
Agent A 怎么找到 Agent B、确认 B 不是冒充的、把一个任务安全地交给它？
```

答案是三件套：**A2A**（发现 + 任务）、**MCP**（工具接入）、**ERC-8004**（链上身份 + 信誉）。其中 MCP + A2A 是本层必学核心；ERC-8004 本层只讲概念和接入点，真正落地留到 Capstone。

## 一句话讲清这一层

```text
Layer 5：一个 agent 有大脑、有工具（MCP 造工具）
Layer 6：多个 agent 能互相发现、验签、协商、交接任务（A2A + MCP 深化 + ERC-8004 可插拔）
```

## 学习原则

- **协议优先用官方 SDK，不手搓**：MCP 用 `@modelcontextprotocol/sdk`，A2A 用 `@a2a-js/sdk`。自己写的只有「发现闸门 / 路由 / 目录」这层业务逻辑。
- **发现必须验签 + 协商版本**：拿到一张 Agent Card，先验 JWS 签名、再协商版本，才谈派任务。不验签 = 任何人都能冒充 agent。
- **MCP 接工具，A2A 接 agent**：两个协议各司其职，一起用。别拿 A2A 当工具协议，也别拿 MCP 当 agent 发现协议。
- **坏卡一律拒绝**：未签名 / 验签失败 / 错版本 / 过期 / 伪造 endpoint 的 Agent Card，全部拒绝。这是安全灵魂。
- **身份信誉可插拔**：ERC-8004 作为可插拔的身份/信誉层，别把项目核心逻辑焊死在它当前的注册表接口上。
- **概念领先、实现追赶要标注**：A2A 协议已 v1.0，SDK 还在 v0.3.x。讲概念按 v1.0，写代码按 SDK 当前版本，落差处诚实说明。

## 推荐技术栈

| 关注点 | 推荐工具 | 用来做什么 | 不要做什么 |
| --- | --- | --- | --- |
| agent↔工具 | `@modelcontextprotocol/sdk`（v1.x） | MCP server/client、tools/resources/prompts | 不手写 MCP 传输、不手搓 JSON-RPC 帧 |
| MCP 传输 | StreamableHTTP | 远程、多客户端、可鉴权 | 不用已废弃的 SSE 传输 |
| agent↔agent | `@a2a-js/sdk`（spec v0.3.0） | Agent Card 发现、任务/消息、Signed Card | 不手写 Agent Card 解析 / 任务状态机 |
| 签名验证 | Node 内置 crypto / JOSE 库 | JWS 验签、JCS 规范化 | 生产不用教学手写版，用 JOSE / rfc8785 |
| 链交互（工具后端） | viem | 只读连 Base Sepolia | 工具后端不写链、不碰私钥 |
| HTTP 框架 | express | 挂 MCP / A2A 端点 | —— |
| 身份/信誉 | ERC-8004（draft，可插拔） | 链上身份 + 可携带信誉 | 不把核心架构押在它当前接口上 |

> A2A v1.0 还是 SDK v0.3.0？**讲概念按 v1.0**（Signed Agent Card、11 方法、三 binding、破坏性变更都是 v1.0 的），**写代码按 `@a2a-js/sdk` 当前实现的 v0.3.0**。这个落差在本层多处出现，动手前以当前 npm 包为准。

## 里程碑项目：Agent Protocol Gateway

做一个 **Agent Protocol Gateway**——把本层能力收敛成一个网关：

```text
同时支持 MCP server（链上只读工具）
  + A2A v1.0 discovery（含 JWS 验签）
  + HTTP fallback
  + 轻量服务目录（能力/链/收费/信誉/健康）
  两个 agent 互相发现，完成一次有签名、有版本协商、有错误回放的任务交接
  ERC-8004 信誉作为可插拔模块接入
```

并把它接回北极星业务：Agent A（请求方）通过 A2A 发现 Agent B（提供方），验签、撮合、派任务；B 用 MCP 暴露链上工具，内部调工具查真链，把结果安全地交回给 A。这样就把 Layer 5 的工具、Layer 6 的协议、后续的支付层串成一个可协作的 agent 网络。

## 本层目录

课程大纲先定义学习顺序；真正写代码时，`layer6/` 里已经放好两套可运行脚手架：

```text
layer6/
  00-先跑起来：Layer6学习导读.md      推荐入口：先跑本地 lab，再跑真实三进程 demo
  01-course-outline.md                本文件
  02-为什么Agent需要通信协议.md        模块 1：MCP vs A2A 的心智
  03-MCP深化：Server-Client与三原语.md 模块 2：tools/resources/prompts + 封装链上工具
  04-MCP传输层：stdio与StreamableHTTP.md 模块 3：传输选型，SSE 废弃，接到远程
  05-A2A协议导论与AgentCard.md         模块 4：Agent Card 字段 + 发现 + MCP↔A2A 边界
  06-A2A签名与验证：JWS+JCS.md         模块 5（核心）：Signed Card + 拒绝矩阵
  07-A2A任务与消息：JSON-RPC方法.md    模块 6：任务/消息 + 三 binding + 版本协商 + v1.0 破坏性变更
  08-协议适配层与发现路由.md           模块 7：统一 adapter + health check + 能力匹配 + 路由
  09-服务目录与互操作测试.md           模块 8：轻量 registry + 喂坏 Card 拒绝矩阵
  10-ERC-8004：可携带的链上身份与信誉.md 模块 9（轻量）：三注册表 + agent=NFT→AgentCard + 可插拔
  11-里程碑：AgentProtocolGateway.md    模块 10：网关串 MCP+A2A+HTTP+目录+ERC-8004 + 安全验收
  总结与复习.md                        分模块回顾 + 概念对照表 + 综合自测 + 产物清单

  protocol-lab/                        本地可运行练习（不联网 / 无 SDK 网络调用 / 无 API key）
    src/shared.ts                      Agent Card fixtures / JCS+JWS 工具 / printKV / runIfMain
    src/01-agent-card.ts               本地构造 + 解析 Agent Card（✅全字段 / ⛔缺字段）
    src/02-jws-jcs.ts                  JCS 规范化 + JWS 签名/验签；篡改字段后 ⛔
    src/03-version-negotiation.ts      A2A-Version 协商 + v1.0 枚举迁移映射
    src/04-protocol-router.ts          协议路由闸门：按目标+支持协议选 MCP/A2A/HTTP
    src/05-service-directory.ts        内存 registry：按能力/链/收费/信誉/健康匹配
    src/06-interop-rejection.ts        拒绝矩阵：坏卡全 ⛔（带 8 条自断言）

  agent-network/                       真实三进程 demo（单包多入口，pnpm 起真进程）
    src/config.ts                      RPC / 端口 / 签名开关
    src/mcp-tools.ts                   getBalance/getBlockNumber/getTxCount（viem 真连公共 RPC）
    src/mcp-server.ts                  进程①：MCP server（StreamableHTTP + Express）
    src/a2a-agent-card.ts              组装 Agent Card，签名开时 JCS+JWS 产 Signed Card
    src/a2a-agent.ts                   进程②：A2A agent（executor 内部调 MCP 工具）
    src/client.ts                      进程③：发现→验签→派任务
    src/gateway.ts                     里程碑网关：发现+验签+版本协商+目录撮合+错误回放
```

## 模块地图

| 模块 | 主题 | 产出 |
| --- | --- | --- |
| 1 | 为什么需要通信协议 | 能说清 MCP vs A2A 的分工、为什么 agent 之间要标准协议 |
| 2 | MCP 深化：三原语 | 能用 `@modelcontextprotocol/sdk` 把链上能力封装成 tool，理解 tools/resources/prompts |
| 3 | MCP 传输层 | 能用 StreamableHTTP 起一个远程可调的 MCP server，知道 SSE 为什么废弃 |
| 4 | A2A 导论 + Agent Card | 能解析一张 Agent Card，说清它每个字段、和 MCP 的边界 |
| 5（核心） | A2A 签名验证 | 能验一张 Signed Agent Card 的 JWS，能列出坏卡拒绝矩阵 |
| 6 | A2A 任务与消息 | 能用 SDK 发一次任务、收结果，知道 11 方法、三 binding、v1.0 破坏性变更 |
| 7 | 协议适配层与路由 | 能设计统一 adapter，按目标+协议路由到 MCP/A2A/HTTP |
| 8 | 服务目录与互操作测试 | 能做一个按能力/链/信誉撮合的目录，喂坏卡全部拒绝 |
| 9（轻量） | ERC-8004 | 能说清三注册表、agent=NFT→AgentCard、信誉可携带，知道怎么可插拔接入 |
| 10 | 里程碑网关 | 交付 Agent Protocol Gateway，两个 agent 完成一次可审计交接 |

## 安全验收（贯穿全层）

- 未签名 / JWS 验签失败 / 版本不兼容 / 过期 / 伪造 endpoint 的 Agent Card **必须拒绝**。
- 派任务前必做：**Card 结构校验 → JWS 验签 → 公钥可信 → 版本协商 →（过期检查）**。
- 服务目录里显示的 endpoint 与实际验证结果**要一致**。
- 协议适配层**不能绕过**认证、额度、计费和日志。
- MCP 工具**只读、不写链、不碰私钥**；A2A agent **不代持资金**。
- 目录信誉来源要标注（教学 fixture / 可插拔 ERC-8004）；协议降级（A2A→HTTP fallback）要**显式、可见、可审计**。

## 前置条件

- 已完成 Layer 4（session key 钱包）和 Layer 5（MCP 工具、agent workflow）。
- Node 20+、pnpm。
- 真实三进程 demo 需能联网到公共 Base Sepolia RPC（只读，无需 API key / 私钥）。

## 下一步怎么接

Layer 6 交付后，agent 已经能「互相发现、验证、协作」。后面的层会在此之上加：

```text
Layer 6：A2A 发现 + MCP 工具 + ERC-8004 身份（agent 能互相找到、信任、协作）
后续  ：x402 / AP2 让 agent 之间能自主付款；把 ERC-8004 信誉真正落到链上（Capstone）
```

高金额、高风险动作再引入 AP2 mandate 之类的人工审批；普通协作继续走 A2A + 签名验证的自动路径。

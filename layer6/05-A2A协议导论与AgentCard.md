# 模块 4：A2A 协议导论与 Agent Card

前三个模块，我们把 **MCP** 讲透了：一个 agent 怎么把链上能力封装成工具、用什么传输暴露出去。但 MCP 解决的是「**一个 agent 怎么用工具**」。本层真正的问题是上一档：

```text
Agent A 怎么找到 Agent B、确认 B 不是冒充的、把一个任务交给它？
```

这需要另一套协议 —— **A2A（Agent-to-Agent）**。而 A2A 的一切都从一张卡开始：**Agent Card**。这一模块就讲清楚这张卡是什么、有哪些字段、client 怎么拿到它，以及它和 MCP 到底谁管谁。

> 目标：能读懂一张 Agent Card 的每个字段，说清 client 发现一个 agent 的第一步（`GET /.well-known/agent-card.json`），并讲清 MCP↔A2A 的分工边界。

## 4.1 为什么先讲 Agent Card：它是名片 + 电话簿 + 工单系统的入口

A2A 要让 agent 之间「互相发现、协作、交接任务」。这三件事拆开看：

```text
名片    —— 我是谁、我能干什么、我在哪、怎么找我鉴权   → Agent Card
电话簿  —— 一堆 agent 的卡汇总起来，按能力检索         → 服务目录（模块 8）
工单系统 —— 把一个任务派过去、跟踪状态、拿回结果         → 任务/消息（模块 6）
```

**一切的起点是 Agent Card。** 你连对方是谁、能干什么、端点在哪都不知道，谈不上派任务。所以 A2A 的发现链路第一步永远是：**把对方的 Agent Card 拉下来、解析、校验**。这一模块只讲这第一步的前半段（拿到卡、读懂卡）；「这张卡是不是本人签发的」要靠下一模块（模块 5）的 JWS 验签。

## 4.2 类比：Agent Card = 企业名片

把 Agent Card 想成一张**企业名片**，它回答别人找你合作前想知道的每件事：

| 名片上的信息 | Agent Card 字段 | 作用 |
| --- | --- | --- |
| 公司名 / 一句话简介 | `name` / `description` | 我是谁、干哪行 |
| 办公地址 / 电话 | `url` | 到哪发任务（A2A 服务端点） |
| 版本号（这版名片） | `version` | agent 自己的迭代版本 |
| 遵循的行业标准 | `protocolVersion` | 用于版本协商（模块 6） |
| 业务清单 / 服务项目 | `skills` | 我具体能做哪些事 |
| 支持的沟通方式 | `capabilities` / `defaultInputModes` / `defaultOutputModes` | 支不支持流式、收发什么格式 |
| 收费标准 | `pricing`（教学字段） | 免费还是按次收费 |
| 防伪印章 / 签名 | `signatures`（Signed Card 才有） | 证明这张卡是本人签发、没被篡改（模块 5） |

名片本身是**公开的、不需要鉴权就能拿**（不然别人怎么找你）。但名片能被伪造 —— 所以真正落地时这张卡要带**防伪签名**（Signed Agent Card），这是本层的安全灵魂，模块 5 专门讲。本模块先把「一张卡长什么样」看清楚。

## 4.3 Agent Card 的真实字段

本课程有两处真实的 Agent Card 定义，字段一致，用途不同：

- `protocol-lab/src/shared.ts` 里的 `AgentCard` **类型**（本地练习用，教学精简版）；
- `agent-network/src/a2a-agent-card.ts` 里 `buildAgentCard()` **真产**的卡（喂给 `@a2a-js/sdk`，字段跟着 SDK 走）。

先看 `protocol-lab/src/shared.ts` 里的类型定义（这是教学基底，字段带注释最清楚）：

```ts
export interface AgentCard {
  /** 协议版本，用于版本协商。A2A v1.0 用 "1.0"。 */
  protocolVersion: string;
  name: string;
  description: string;
  /** A2A 服务端点（JSON-RPC / REST）。 */
  url: string;
  /** agent 自己的版本（和 protocolVersion 不是一回事）。 */
  version: string;
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
  };
  skills: Skill[];
  /** 收费提示（教学字段）：null=免费。 */
  pricing?: { unit: string; amount: string; token: string } | null;
  /** 支持的链（教学字段），如 ["base-sepolia"]。 */
  chains?: string[];
  /** 只有 Signed Agent Card 才有：JWS 分离签名 + 签名者公钥。 */
  signature?: CardSignature;
}
```

其中一项能力（skill）长这样：

```ts
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** 用来做能力匹配的标签，如 "onchain-read"、"base-sepolia"。 */
  tags: string[];
}
```

再看真实产出的卡 —— `agent-network/src/a2a-agent-card.ts` 的 `buildBaseCard()`（这张卡由 A2A agent 进程对外暴露，被 client 发现）：

```ts
export function buildBaseCard(): AgentCard {
  return {
    protocolVersion: "0.3.0", // ⚠️ SDK 实现 spec v0.3.0；协议已 v1.0（见 4.7 版本核验）
    name: "chain-reader-agent",
    description: "查 Base Sepolia 链上只读数据（余额 / 区块号 / nonce）",
    url: `${A2A_BASE_URL}/`,
    version: "0.1.0",
    capabilities: { streaming: true, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "get-balance",
        name: "getBalance",
        description: "查询某地址在 Base Sepolia 的原生余额",
        tags: ["onchain-read", CHAIN, "balance"],
      },
    ],
  };
}
```

逐字段过一遍关键点：

| 字段 | 含义 | 容易踩的点 |
| --- | --- | --- |
| `protocolVersion` | 这张卡遵循的 **A2A 协议**版本 | 和 `version` 不是一回事！这个决定版本协商能不能谈拢 |
| `name` / `description` | agent 身份与一句话简介 | 用于目录检索与人读 |
| `url` | agent 的 **A2A 服务端点**（派任务打这里） | 必须是合法 http(s)；伪造 endpoint 是攻击面（模块 8 拒绝矩阵会拦） |
| `version` | **agent 自己**的迭代版本 | 别和 `protocolVersion` 混：一个是「产品版本」，一个是「标准版本」 |
| `capabilities` | 支不支持流式（`streaming`）、推送通知（`pushNotifications`） | client 据此决定用 `message/send` 还是 `message/stream` |
| `skills` | 能力清单（每项有 id/name/description/tags） | **空 skills 直接判非法**——不知道它能干嘛 |
| `defaultInputModes` / `defaultOutputModes` | 默认收 / 发的内容类型（如 `text/plain`） | SDK 卡里的必填项；`protocol-lab` 精简版省了它 |

【学习提示】两处卡字段**几乎一样，但不完全一样**。`protocol-lab` 的精简类型多了 `pricing` / `chains` 两个**教学字段**（方便后面讲目录撮合），省了 `defaultInputModes/OutputModes`；`agent-network` 的卡形状**跟着 `@a2a-js/sdk` 的 `AgentCard` 走**，所以有 `defaultInputModes/OutputModes`、签名字段叫 `signatures`（数组）而不是 `signature`。真实项目里以 SDK 的类型为准；本地练习用精简版是为了把注释写透。

### Agent Card 的默认发现路径

A2A 约定：一个 agent 的卡挂在它域名下的固定路径 —— **`/.well-known/agent-card.json`**。这跟 `robots.txt`、`/.well-known/openid-configuration` 是同一种思路：**约定优于配置**，client 不需要事先知道确切 URL，拼一下就能拿到。

`agent-network/src/client.ts` 里的发现就是直接抓这个路径：

```ts
/** 直接抓 well-known Agent Card（保留我们内联的 signatures.header 公钥）。 */
export async function fetchAgentCard(baseUrl: string): Promise<AgentCard> {
  const res = await fetch(`${baseUrl}/.well-known/agent-card.json`);
  if (!res.ok) throw new Error(`拉取 Agent Card 失败：HTTP ${res.status}`);
  return (await res.json()) as AgentCard;
}
```

> 为什么这里手写 `fetch` 而不用 SDK？`@a2a-js/sdk` 的 `ClientFactory.createFromUrl()` 内部也会去拉这张卡，但它在解析时**可能丢掉我们内联在 `signatures[].header.publicKeyPem` 里的教学公钥**。为了模块 5 能自己验签，`client.ts` 先手抓一次原始 JSON 保住公钥，验签通过后再用 SDK 建 client 派任务。生产里公钥走 DID / JWKS 发布，就不需要这一手了。

## 4.4 MCP ↔ A2A 边界：再强调一次

这是本层最容易混的地方，值得单独一张表钉死：

| 维度 | MCP（模块 2–3） | A2A（本模块起） |
| --- | --- | --- |
| 连接对象 | agent ↔ **工具 / 数据源** | agent ↔ **另一个 agent** |
| 一句话 | 给 agent **装工具** | 让 agent **互相协作** |
| 核心原语 | tools / resources / prompts | Agent Card / 任务 / 消息 |
| 发现方式 | client 连 server，`tools/list` 列工具 | 拉 `/.well-known/agent-card.json` 读能力 |
| 「对方」是谁 | 一个被动的工具服务（无自主性） | 一个有大脑、能自己决策的 agent |
| 本课程里谁在用 | A2A agent 内部**调 MCP** 查链 | client **用 A2A** 发现并派任务给 agent |
| 类比 | 电钻、扳手（工具箱） | 打电话找承包商谈项目（协作） |

一句话记牢本层学习原则里那条：**MCP 接工具，A2A 接 agent。** 在我们的 `agent-network` demo 里两者同时用、各司其职 —— client 用 **A2A** 发现并派任务给 `chain-reader-agent`；这个 agent 收到任务后，**内部用 MCP client** 去调 mcp-server 的 `getBalance` 工具查真链，再把结果通过 A2A 交回 client。别拿 A2A 当工具协议，也别拿 MCP 当 agent 发现协议。

## 4.5 发现链路：client → GET well-known → agent

把「发现一个 agent」这一步画成图（本模块只覆盖到「读卡」，验签在模块 5）：

```text
   client（请求方）                              agent（提供方）
        │                                              │
        │  1. GET https://agent-b.example              │
        │        /.well-known/agent-card.json          │
        │ ───────────────────────────────────────────▶ │
        │                                              │  返回 Agent Card（JSON）
        │  2. 200 OK  { protocolVersion, name, url,    │
        │              version, capabilities, skills,  │
        │ ◀─────────────────────────────────────────── │   signatures? ... }
        │                                              │
        │  3. validateCardShape() 结构校验              │   ← 本模块（长得像卡？）
        │  4. verifySignedCard() JWS 验签               │   ← 模块 5（是本人签的？）
        │  5. negotiateVersion() 版本协商               │   ← 模块 6（版本谈得拢？）
        │  6. 撮合 → message/send 派任务                │   ← 模块 6/8
        │                                              │
        ▼                                              ▼
   第 3 步就是本模块的落点：拿到卡、解析、结构校验。
   第 4/5/6 步是后面模块，但发现的顺序不能乱：先有卡，才谈其他。
```

结构校验（第 3 步）在 `protocol-lab/src/shared.ts` 的 `validateCardShape()` 里 —— 它是「长得像不像一张卡」的第一道闸，只查必填字段、skills 非空、url 是合法 http(s)：

```ts
const REQUIRED_FIELDS: (keyof AgentCard)[] = [
  "protocolVersion", "name", "url", "version", "capabilities", "skills",
];

export function validateCardShape(card: Partial<AgentCard>): VerifyResult {
  for (const f of REQUIRED_FIELDS) {
    if (card[f] === undefined) return { ok: false, reason: `Agent Card 缺字段: ${f}` };
  }
  if (!Array.isArray(card.skills) || card.skills.length === 0) {
    return { ok: false, reason: "Agent Card 的 skills 为空" };
  }
  if (!/^https?:\/\//.test(card.url ?? "")) {
    return { ok: false, reason: `Agent Card 的 url 不是合法 http(s) 端点: ${card.url}` };
  }
  return { ok: true };
}
```

**核心心智：结构校验只保证「长得像一张卡」，不保证「这张卡是真的」。** 缺字段、空 skills、`ftp://` 端点，这些一眼假的会被这一步拦掉；但一张字段齐全、endpoint 却是伪造的卡，结构校验会**放过** —— 拦它得靠模块 5 的验签。发现链路必须按顺序走完，缺一步都是安全洞。

## 4.6 动手：跑 protocol-lab 的 demo:card

本模块对应 `protocol-lab` 的第一个练习。它全本地、不联网、不需要任何 key：手动构造一张合法卡，再造几张坏卡，看结构校验怎么逐一判定。

```bash
cd layer6/protocol-lab
pnpm demo:card
```

`src/01-agent-card.ts` 里喂给校验器的用例是这几张卡：

```ts
const cases = [
  { label: "合法卡：字段齐全", card: good },
  { label: "缺 url：无法定位 agent 端点", card: { ...good, url: undefined } },
  { label: "缺 skills：不知道它能干什么", card: { ...good, skills: [] } },
  { label: "url 不是 http(s)：可能是伪造/内网穿透", card: { ...good, url: "ftp://evil.example/a2a" } },
  { label: "缺 protocolVersion：无法做版本协商", card: { ...good, protocolVersion: undefined } },
];
```

预期输出：第一张 `✅ 通过`，后面四张全 `⛔ 拒绝`，各自打印被拒原因。这印证了 4.5 那句话：**结构校验拦得住「不像卡」，拦不住「假卡」。**

想看真实三进程里这张卡怎么被拉取、验签、派任务，去 `agent-network`（模块 5、6 会带你跑）：

```bash
# 三个终端分别起（真连 Base Sepolia 公共 RPC，只读）
pnpm start:mcp     # MCP server（链上只读工具）
pnpm start:agent   # A2A agent（内部调 MCP 查链）
pnpm start:client  # client：拉卡 → 验签 → 派任务 → 收结果
```

## 4.7 版本核验（本层最重要的诚实标注）

这是整个 Layer 6 你必须记住的一条落差，它会在多个模块反复出现：

> **A2A 协议本身已经发布到 v1.0，但 `@a2a-js/sdk` 当前实现的还是 spec v0.3.0。**

具体到实测（截至 2026-07）：

- `@a2a-js/sdk` 实测版本 **0.3.14**，实现的是 **A2A spec v0.3.0**。所以我们 `agent-network` 真产出的卡里，`protocolVersion` 写的是 **`"0.3.0"`**，不是 `"1.0"`。
- 而 `protocol-lab` 是**纯本地、不依赖 SDK** 的教学演示，那里的 `baseCard()` 用 `protocolVersion: "1.0"`，是为了让你**按 v1.0 的概念**理解字段。
- 两处不同不是笔误，是刻意的：**讲概念按 v1.0，写代码（真连 SDK）按 SDK 当前实现的 v0.3.x。**

为什么会有这个落差、我们怎么处理：

| 维度 | A2A v1.0（概念，本层讲） | `@a2a-js/sdk` v0.3.x（代码，本层跑） |
| --- | --- | --- |
| 卡里 `protocolVersion` | `"1.0"`（`protocol-lab` 用） | `"0.3.0"`（`agent-network` 真产用） |
| Agent Card 默认路径 | `/.well-known/agent-card.json` | 同上（SDK 默认也是这个路径） |
| 签名字段 | Signed Agent Card（JWS + JCS） | `signatures: AgentCardSignature[]` |
| 后续差异 | 任务状态枚举 SCREAMING_SNAKE_CASE、11 个 JSON-RPC 方法、三种 binding | kebab-case 旧枚举、API 以 SDK 为准 |

模块 6 会把 v1.0 相对 v0.3.0 的**破坏性变更**列全（任务状态枚举改大写下划线、`TaskStatusUpdateEvent` 去掉 `final` 字段、pushNotification 操作重命名、security scheme 变判别联合、OAuth 加 Device Code / 去掉 implicit）。**你现在只需记住：看到卡里 `protocolVersion="0.3.0"` 不是 bug，是 SDK 现状；概念上我们按 v1.0 讲。动手前永远以当前 npm 包为准。**

## 本模块小结

- A2A 让 agent 互相「发现 + 协作 + 交接任务」，一切从 **Agent Card** 这张「数字名片」开始。
- Agent Card = 企业名片：`name`/`description`（我是谁）、`url`（到哪派任务）、`version`（我的版本）、`protocolVersion`（遵循的协议版本）、`skills`（能干什么）、`capabilities`（支不支持流式）、`defaultInputModes/OutputModes`（收发格式）、`signatures`（防伪，模块 5）。
- **`version` ≠ `protocolVersion`**：一个是 agent 产品版本，一个是 A2A 标准版本，别混。
- 默认发现路径固定：**`GET /.well-known/agent-card.json`**（约定优于配置）。
- **MCP 接工具，A2A 接 agent**：本课程里 A2A agent 内部用 MCP 调链，两者同时用、各管一段。
- 发现链路顺序不能乱：**结构校验 → JWS 验签 → 版本协商 → 派任务**；结构校验只保证「像卡」，不保证「真卡」。
- 版本落差（本层最重要标注）：**协议已 v1.0，SDK 还在 v0.3.x**，所以真卡里 `protocolVersion="0.3.0"`；概念按 v1.0，代码按 SDK。

## 复习题

1. A2A 要解决的核心问题是什么？为什么它的第一步永远是「拿到 Agent Card」，而不是直接派任务？
2. 用「名片 + 电话簿 + 工单系统」的类比，说清 Agent Card、服务目录、任务系统三者的关系。
3. `version` 和 `protocolVersion` 分别是什么？把它们搞混会导致什么问题？
4. Agent Card 的默认发现路径是什么？这种「well-known 路径」的设计好处是什么？
5. `validateCardShape()` 会拦下哪几类坏卡？它**拦不住**哪一类坏卡，要靠后面哪个模块补？
6. MCP 和 A2A 的分工是什么？在 `agent-network` 的 demo 里，谁在用 MCP、谁在用 A2A，各调了什么？
7. 为什么 `agent-network` 的卡里 `protocolVersion` 是 `"0.3.0"`，而 `protocol-lab` 的是 `"1.0"`？这个不一致是 bug 吗？
8. 发现链路的完整顺序是「结构校验 → 验签 → 版本协商 → 派任务」。如果跳过验签直接派任务，会有什么安全后果？

下一模块（核心）我们补上发现链路最关键的一步：**怎么给 Agent Card 签名、client 怎么验签，以及一张坏卡凭什么被拒绝** —— JWS + JCS 与拒绝矩阵。

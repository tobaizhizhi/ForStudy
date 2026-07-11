# 模块 6：A2A 任务与消息 —— JSON-RPC 方法

上一模块解决了"发现之后先验签"。验签只是信任的第一步——**验完签，你得真的把活派出去。** 本模块讲 A2A 的"干活"层：一个任务从提交到完成，中间走哪些 JSON-RPC 方法、状态怎么流转、client 和 server 各写哪几行代码。

> 目标：能用 SDK 发一次任务、收一次结果；能背出 A2A 的 11 个 JSON-RPC 方法和任务状态机；知道三种 binding 什么时候用哪个；能列出 A2A v1.0 相对旧版的破坏性变更，动手时不踩坑。

## 6.1 为什么派任务要用 JSON-RPC，而不是随便发个 HTTP

发现（模块 4/5）解决的是"这是谁、可不可信"。派任务解决的是"把一件**有生命周期**的事交给它"。

一次链上查询可能一秒返回；但"帮我跑一个回测""等这笔跨链到账再告诉我"这类任务，**天然是异步、长跑、可能中途要补输入、可能失败、可能取消**的。你不能只发一个 HTTP POST 就完事——你需要一套约定，能表达：

```text
任务现在到哪一步了？   -> 状态机（submitted / working / completed …）
中途要我补个参数？     -> input-required 状态 + 再发一条 message
我想取消它。           -> tasks/cancel
任务好了通知我，别轮询。 -> push notification 配置
断线重连后接着听。     -> tasks/resubscribe
```

A2A 把这套约定定义成一组 **JSON-RPC 2.0 方法**。JSON-RPC 是一个极薄的远程调用约定：请求里有 `method`（调哪个方法）、`params`（参数）、`id`（配对请求和响应）。A2A 在它之上定义了任务/消息这套语义，所以两个陌生 agent 只要都实现这套方法，就能互相派活——**这正是"开放协议"的意义：不是我调你的私有 API，是我们都说同一种任务语言。**

## 6.2 11 个 JSON-RPC 方法一览

A2A v1.0 的 JSON-RPC binding 定义了这些方法。按"发任务 / 查任务 / 推送配置 / 重订阅"分组记：

| 方法 | 作用 | 返回 | 分组 |
| --- | --- | --- | --- |
| `message/send` | 发一条消息，触发/推进一个任务（同步拿结果或最终态） | Message 或 Task | 发任务 |
| `message/stream` | 发消息并**流式**订阅事件（SSE，实时看状态变化） | 事件流 | 发任务 |
| `tasks/get` | 按 taskId 查任务当前状态和产物 | Task | 查任务 |
| `tasks/cancel` | 请求取消一个任务 | Task | 查任务 |
| `tasks/resubscribe` | 断线后重新订阅一个已存在任务的事件流 | 事件流 | 重订阅 |
| `tasks/pushNotificationConfig/set` | 为任务登记 webhook（任务变化时 server 回调你） | 配置 | 推送配置 |
| `tasks/pushNotificationConfig/get` | 查某条推送配置 | 配置 | 推送配置 |
| `tasks/pushNotificationConfig/list` | 列出某任务的所有推送配置 | 配置数组 | 推送配置 |
| `tasks/pushNotificationConfig/delete` | 删除一条推送配置 | 空 | 推送配置 |
| `agent/getAuthenticatedExtendedCard` | 鉴权后拿"扩展 Agent Card"（含仅授权方可见的技能） | AgentCard | 卡 |

数一下是 10 个具名方法；A2A 规范里 `message/send` 与 `message/stream` 常被算作一对"发送"入口，加上早期版本把扩展卡获取与 `agent/*` 命名空间的演进算进去，社区常说"11 个方法"。**别死记数字，记住这四组语义就够用了**——考试要点是分组，不是背 11 这个数。

【学习提示】`message/send` 和 `message/stream` 的区别只在"要不要实时看过程"。短任务用 `send` 一把梭；长任务用 `stream` 边跑边看状态。本课程脚手架用的是 `send`（`client.sendMessage`），因为链上只读查询是秒回的短任务。

## 6.3 任务状态机

一个 Task 有 `id`、`contextId`（把多轮对话归到一个会话）、`status.state`（当前状态）、`artifacts`（产出物）。状态在这几个值之间流转：

```text
                      ┌──────────────► completed  （成功，有 artifacts）
                      │
  submitted ──► working ──► input-required ──┐
   (刚收到)     (在干活)      (要你补输入)     │  你补一条 message
                      │           ▲──────────┘  又回到 working
                      ├──────────────► failed     （执行出错）
                      │
                      └──────────────► canceled   （被 tasks/cancel）

  另有 rejected（agent 直接拒收任务）作为提交后的终态之一。
```

- **submitted → working**：agent 接了任务、开始处理。
- **working → input-required**：agent 需要更多信息（比如"你要查哪条链？"），把球踢回给 client；client 再发一条 `message/send` 补充，任务回到 working。
- **终态**：`completed` / `failed` / `canceled` / `rejected`。到终态后任务不再流转，只能 `tasks/get` 回看。

**关键心智：任务是有身份的（taskId）、有状态的、可回查的。** 这和"发个 HTTP 请求等 200"完全不同——它是一个你能持续追踪、能取消、能补输入的长活对象。

⚠️ 上面这些状态名 **写的是概念（spec）层的 kebab-case（`input-required`）**。到了 v1.0，枚举值改成了 SCREAMING_SNAKE_CASE（`INPUT_REQUIRED`）——这是本模块最重要的破坏性变更，6.6 专门讲。

## 6.4 三种 binding：同一套语义，三种传输

A2A 的方法语义是一套，但可以走三种不同的传输"binding"。选哪个取决于部署形态：

| Binding | 传输/编码 | 什么时候用 | 代价 |
| --- | --- | --- | --- |
| **JSON-RPC 2.0**（over HTTP） | JSON over HTTP(S) | **最常见的公开部署**：跨组织、跨语言、要人类可读、要好调试 | 编码略重，无原生流控 |
| **gRPC** | Protobuf over HTTP/2 | **低延迟内部服务**：同一集群内高频 agent 互调，要强类型 + 双向流 | 要 proto 工具链，跨组织门槛高 |
| **HTTP + REST** | 资源风格 REST + JSON | 想用现成 API 网关/REST 生态、给不熟 JSON-RPC 的团队接入 | 语义要映射成资源路径，表达力略弱 |

选型口诀：

```text
对外开放、要互操作、要好调试   -> JSON-RPC 2.0     （默认选它，本课程用的就是这个）
内部集群、高频、低延迟、强类型  -> gRPC
已有 REST 网关 / 团队只吃 REST -> HTTP + REST
```

三种 binding 表达的是**同一套任务/消息语义**——`message/send` 在 JSON-RPC 里是一个 method，在 gRPC 里是一个 rpc，在 REST 里是一个 `POST /v1/message:send` 之类的端点。**换 binding 不换语义**，这是 A2A "一套协议、多种落地"的设计。本课程脚手架统一用 **JSON-RPC 2.0**，因为它是公开 agent 网络的最大公约数。

## 6.5 版本协商：A2A-Version header + 不兼容用新 URI

client 和 server 得先就"说哪个版本的 A2A"达成一致，否则字段名、枚举值对不上（比如老 client 发 `input-required`、新 server 只认 `INPUT_REQUIRED`）。A2A 的规则是：

1. **兼容范围内**：用 HTTP 请求头 `A2A-Version` 声明想说哪个版本，server 在能力范围内响应。
2. **不兼容**：破坏性版本用**不同的 URI**区分——不是靠 header 猜，而是新版本挂在新地址上，老 client 打老地址、新 client 打新地址，井水不犯河水。

本地 lab 把这套逻辑做成了可跑的 demo，见 `protocol-lab/src/03-version-negotiation.ts`：

```ts
// server 支持的版本：1.0
const cases = [
  { requested: "1.0", label: "client 请求 1.0（匹配）" },
  { requested: "0.3", label: "client 请求 0.3（server 不支持 → 拒绝或降级）" },
  { requested: "2.0", label: "client 请求 2.0（未来版本 → 拒绝）" },
];
for (const c of cases) {
  const r = negotiateVersion(c.requested);   // 来自 shared.ts
  verdict(r.ok, c.label, r.ok ? undefined : r.reason);
}
```

跑 `pnpm demo:version` 会看到：请求 1.0 ✅、请求 0.3 / 2.0 ⛔。这个 demo 还顺手演示了下一节的枚举迁移映射（`migrateTaskState`）。

**协商放在派任务之前。** 完整的发现闸门是：`Card 结构校验 → JWS 验签 → 公钥可信 → 版本协商 →（过期检查）→ 才派任务`。版本对不上，和验签失败一样，是拒绝派任务的理由。

## 6.6 A2A v1.0 破坏性变更表（必背）

这是本层最需要诚实标注的地方：**A2A 协议已发 v1.0，但我们用的 `@a2a-js/sdk`（实测 0.3.14）实现的还是 spec v0.3.0。** 概念按 v1.0 讲，代码按 SDK v0.3.x 写。下面这张表列出 v1.0 相对旧版改了什么——**看旧教程、旧 SDK 时，这些就是坑**：

| 变更点 | 旧版（v0.3.x / SDK 现状） | v1.0（概念） | 影响 |
| --- | --- | --- | --- |
| **任务状态枚举** | kebab-case：`input-required`、`completed` | SCREAMING_SNAKE_CASE：`INPUT_REQUIRED`、`COMPLETED` | 老 client 发的枚举值新 server 认不出，必须做迁移映射 |
| **TaskStatusUpdateEvent** | 带 `final` 字段标记是不是最后一个事件 | **去掉 `final` 字段**，用状态是否终态判断 | 依赖 `final` 判流结束的代码要改 |
| **pushNotification 操作命名** | `tasks/pushNotificationConfig/set` 等 | 操作重命名（如 `CreateTaskPushNotificationConfig`） | 推送配置的方法名对不上 |
| **security scheme** | 普通对象 | 改成**判别联合**（discriminated union，按 `type` 分支） | 解析安全声明的代码要按判别字段分支 |
| **OAuth 流程** | 含 implicit / password 授权 | **去掉 implicit / password**；**加 Device Code（RFC 8628）+ PKCE** | 用旧 OAuth 流的接入要迁移到 Device Code / PKCE |

枚举迁移在 lab 里是可跑的（`03-version-negotiation.ts` 的 `ENUM_MIGRATION`）：

```ts
const ENUM_MIGRATION: Record<string, string> = {
  submitted: "SUBMITTED",
  working: "WORKING",
  "input-required": "INPUT_REQUIRED",
  completed: "COMPLETED",
  canceled: "CANCELED",
  failed: "FAILED",
  rejected: "REJECTED",
};
// 兜底：没在表里的，统一 toUpperCase + 把 '-' 换成 '_'
function migrateTaskState(old: string): string {
  return ENUM_MIGRATION[old] ?? old.toUpperCase().replace(/-/g, "_");
}
```

**为什么要专门记这个：** agent 网络是长期演进的，你写的 client 明天可能对接一个升到 v1.0 的 server。不知道这张表，你会在"枚举对不上、`final` 字段没了、OAuth 流被拒"这些地方莫名其妙地失败。

## 6.7 真实代码：server 侧接任务、client 侧发任务

现在把"派任务 → 收结果"这条链路用脚手架的真实代码走一遍。**注意：概念是 v1.0，代码是 `@a2a-js/sdk` v0.3.14 的 API**，逐处标注差异。

### server 侧：实现 AgentExecutor

A2A agent 的核心是一个 **executor**——实现 `AgentExecutor` 接口，SDK 帮你把 JSON-RPC 方法、任务存储、事件总线都接好，你只写"收到消息干什么"。见 `agent-network/src/a2a-agent.ts`：

```ts
import type { AgentExecutor, ExecutionEventBus, RequestContext } from "@a2a-js/sdk/server";
import { DefaultRequestHandler, InMemoryTaskStore } from "@a2a-js/sdk/server";
import { A2AExpressApp } from "@a2a-js/sdk/server/express";
import type { Message } from "@a2a-js/sdk";

class ChainReaderExecutor implements AgentExecutor {
  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    // 1) 从请求上下文取用户消息文本（RequestContext.userMessage）
    const text = textOf(requestContext.userMessage);
    const { tool, args } = parseIntent(text);   // 极简意图解析：找 0x 地址、选工具

    // 2) 内部用 MCP Client 调 mcp-server 的链上只读工具（A2A 接 agent、MCP 接工具）
    let replyText: string;
    try {
      const toolResult = await callMcpTool(tool, args);
      replyText = `${tool} 结果：${toolResult}`;
    } catch (e) {
      replyText = `工具调用失败：${(e as Error).message}`;
    }

    // 3) 把回复作为一条 message 发到事件总线，再宣告任务结束
    const reply: Message = {
      kind: "message",
      messageId: uuidv4(),
      role: "agent",
      parts: [{ kind: "text", text: replyText }],
      taskId: requestContext.taskId,       // 关联同一个任务
      contextId: requestContext.contextId, // 关联同一次会话
    };
    eventBus.publish(reply);   // 相当于推进任务状态 / 产出结果
    eventBus.finished();       // 相当于把任务推到终态
  }

  async cancelTask(): Promise<void> {
    // 本 demo 任务即时完成，无需取消逻辑；长任务在这里响应 tasks/cancel
  }
}
```

把 executor 挂上 Express，Agent Card 默认发布在 `/.well-known/agent-card.json`：

```ts
const requestHandler = new DefaultRequestHandler(
  buildAgentCard(),        // 上一模块的 Signed Agent Card
  new InMemoryTaskStore(), // 任务存储（生产换持久化）
  new ChainReaderExecutor(),
);
const app = express();
new A2AExpressApp(requestHandler).setupRoutes(app); // 自动挂上 JSON-RPC 端点 + well-known 卡
app.listen(A2A_PORT, "0.0.0.0", () => { /* ... */ });
```

**v0.3.x ↔ v1.0 差异标注：**
- `execute(requestContext, eventBus)` 的 `RequestContext.userMessage / taskId / contextId`、`ExecutionEventBus.publish / finished` 是 **SDK v0.3.x 的 API 形状**，v1.0 概念层用状态机 + 事件描述同一件事。
- `eventBus.finished()` 在 v0.3.x 里宣告事件流结束；v1.0 去掉了 `TaskStatusUpdateEvent.final` 字段，改由状态是否终态判断（见 6.6）。写代码用 SDK 的 `finished()`，理解概念记住"终态"。

### client 侧：sendMessage 派任务

client 侧发现、验签（模块 5）之后，用 `ClientFactory` 建客户端、`sendMessage` 派任务。见 `agent-network/src/client.ts`：

```ts
import { ClientFactory, JsonRpcTransportFactory } from "@a2a-js/sdk/client";

// 1) 选 JSON-RPC 2.0 binding，从 URL 建 client（内部会拉 well-known 卡）
const factory = new ClientFactory({ transports: [new JsonRpcTransportFactory()] });
const client = await factory.createFromUrl(A2A_BASE_URL);

// 2) 派任务：底层就是 JSON-RPC 的 message/send
const result = await client.sendMessage({
  message: {
    kind: "message",
    messageId: uuidv4(),
    role: "user",
    parts: [{ kind: "text", text: `查一下 ${DEMO_ADDRESS} 在 Base Sepolia 的余额` }],
  },
});

// 3) 收结果（短任务直接拿到 agent 回的 message）
const reply = result as { parts?: { kind: string; text?: string }[] };
const text = (reply.parts ?? []).filter((p) => p.kind === "text").map((p) => p.text).join("");
console.log(`agent 回复：${text}`);
```

**v0.3.x ↔ v1.0 差异标注：**
- `ClientFactory({ transports: [new JsonRpcTransportFactory()] })` 里显式挑 **JSON-RPC binding**——对应 6.4 的三选一。要走别的 binding 就换 transport factory。
- `client.sendMessage(...)` 是 SDK 对 `message/send` 方法的封装；`message.parts` 用 `kind: "text"` 的分片。这些是 v0.3.x API，v1.0 语义一致但字段/枚举命名可能变（见破坏性变更表）。

三进程跑起来（三个终端）：

```bash
pnpm start:mcp      # 进程①：MCP server（链上只读工具）
pnpm start:agent    # 进程②：A2A agent（executor 内部调 MCP）
pnpm start:client   # 进程③：发现 → 验签 → 派任务 → 收结果
```

实测：client 发现 agent、验签 ✅ 通过、派任务；agent 收到后内部调 MCP 查到 **Base Sepolia 真实余额**并作为 message 回给 client。这就是一次完整的、有签名、有真实链上数据的 agent-to-agent 任务交接。

## 6.8 一个容易混的边界：A2A 接 agent、MCP 接工具

看上面的 executor 你会发现一件事：**A2A agent 内部又当了 MCP client**。这不是绕——这正是两个协议各司其职：

```text
client ──A2A(message/send)──► a2a-agent ──MCP(callTool)──► mcp-server ──viem──► Base Sepolia
        "把任务派给 agent"            "把链上能力当工具调"        "只读查真链"
```

别拿 A2A 当工具协议（它是给 agent 之间派任务的），也别拿 MCP 当 agent 发现协议（它是给一个 agent 接工具的）。**A2A 的 message/task 语义 + MCP 的 tool 语义组合起来**，才是本层"多 agent 协作"的完整形态。

## 本模块小结

- 发现完要**真派任务**；A2A 用 JSON-RPC 2.0 定义任务/消息的完整生命周期，任务是有身份（taskId）、有状态、可回查、可取消、可补输入的长活对象。
- **方法四组**：发任务（`message/send` / `message/stream`）、查任务（`tasks/get` / `tasks/cancel` / `tasks/resubscribe`）、推送配置（`tasks/pushNotificationConfig/*` 四个）、扩展卡（`agent/getAuthenticatedExtendedCard`）。记语义分组，别死记"11"这个数。
- **状态机**：`submitted → working → (input-required ↺) → completed / failed / canceled`，外加 `rejected`；到终态不再流转。
- **三 binding**同一套语义：JSON-RPC 2.0（公开部署默认）、gRPC（内部低延迟）、HTTP+REST（接 REST 生态）；换 binding 不换语义。
- **版本协商**：兼容范围用 `A2A-Version` header，不兼容用**新 URI**；协商放在派任务之前，和验签一样是拒绝的理由。
- **v1.0 破坏性变更**（诚实标注）：枚举 kebab→SCREAMING_SNAKE_CASE、`TaskStatusUpdateEvent` 去 `final`、pushNotification 操作重命名、security scheme 变判别联合、OAuth 去 implicit/password 加 Device Code+PKCE。
- **概念按 v1.0、代码按 SDK v0.3.14**：`AgentExecutor.execute(requestContext, eventBus)` + `eventBus.publish/finished`（server）、`ClientFactory + createFromUrl + sendMessage`（client），逐处标注了差异。
- **A2A 接 agent、MCP 接工具**：a2a-agent 内部又当 MCP client，两协议组合才是完整协作形态。

## 复习题

1. 派任务为什么要用 JSON-RPC 这套"任务/消息"语义，而不是发一个普通 HTTP POST 就完事？举两个"长活任务"才需要的能力。
2. 把 A2A 的方法按语义分成四组，各写出组内的方法名。为什么说"11"这个数不用死记？
3. 画出任务状态机。`working → input-required → working` 这个回环在什么场景下发生？
4. 三种 binding 分别在什么部署形态下选用？为什么本课程脚手架用 JSON-RPC 2.0？
5. 版本协商的两条规则是什么（兼容时 / 不兼容时各怎么做）？它应该放在派任务链路的哪一步？
6. 列出 A2A v1.0 相对 v0.3.x 的至少四项破坏性变更。其中"枚举命名"具体怎么变，为什么老 client 会失败？
7. `@a2a-js/sdk` 实测是哪个版本、实现的是 spec 哪个版本？这个落差对"讲概念"和"写代码"分别意味着什么？
8. server 侧 `execute(requestContext, eventBus)` 里，`requestContext.userMessage` 和 `eventBus.publish / finished` 各对应任务生命周期的什么？
9. client 侧 `ClientFactory({ transports: [new JsonRpcTransportFactory()] })` 里挑 transport factory 对应本模块哪个概念？想换成 gRPC 该改哪里？
10. 为什么说"A2A agent 内部又当 MCP client"不是绕，而是设计？用一句话说清 A2A 和 MCP 的分工。

下一模块，我们把发现、验签、协商、路由这些散在各处的判断收敛成一个**统一协议适配层**：按目标 + 支持的协议，把请求路由到 MCP / A2A / HTTP，并加上健康检查和能力匹配。

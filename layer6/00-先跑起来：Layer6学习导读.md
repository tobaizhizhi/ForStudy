# Layer 6 学习导读 —— 先把 agent 之间的通信跑出感觉

哈喽，进入 agent 通信协议这一层。Layer 4 给了 agent 一只「受限的手」（session key 钱包），Layer 5 给了它「大脑和工具」（MCP + agent workflow）。但到现在为止，你的 agent 还是**一座孤岛**：它能自己干活，却不会跟**别的 agent** 打交道。

Layer 6 就是把孤岛连成网络：让 agent 之间能**互相发现、验证身份、协商版本、交接任务**。

这一层最容易卡住的还是名词密度：MCP 三原语、StreamableHTTP、Agent Card、Signed Agent Card、JWS、JCS、JSON-RPC binding、版本协商、服务目录、ERC-8004……一上来直接读协议规范，很容易在「这些词到底指什么」上迷路。

所以这一层沿用 Layer 4 的自学方式：

```text
先讲清楚为什么
  -> 本地最小代码跑出数据（不联网、✅/⛔ 打印）
  -> 再看真实 SDK 三进程互相调用
  -> 最后把发现/验签/路由/目录收敛成一个网关
```

## 0.1 本层怎么学

建议按这个顺序走，不要跳：

1. 读 `01-course-outline.md`，知道 Layer 6 要交付什么。
2. 读 `02-为什么Agent需要通信协议.md`，先建立 MCP vs A2A 的心智。
3. 进入 `protocol-lab/`，跑本地 demo，看见 Agent Card / JWS 验签 / 版本协商 / 路由 / 目录长什么样。
4. 读 `03`、`04`，深化 MCP（三原语 + 传输层），并动手起 `agent-network` 里的 MCP server。
5. 读 `05`、`06`、`07`，学 A2A 的 Agent Card、签名验证（本层核心）、任务/消息，起 A2A agent。
6. 读 `08`、`09`，把发现/路由/服务目录串起来，跑通 client 三进程交接。
7. 读 `10`（ERC-8004，轻量）、`11`（里程碑网关），最后读 `总结与复习.md`。

## 0.2 第一组可运行代码：不联网、不用 SDK、✅/⛔ 打印

先跑这个。本地 lab 不需要 `.env`、不需要任何 SDK 的网络调用、不需要 API key：

```bash
cd /home/lenovo/solidity-course/ata/layer6/protocol-lab
pnpm install
pnpm demo:all
```

你会依次看到：

| 脚本 | 学什么 | 对应章节 |
| --- | --- | --- |
| `01-agent-card.ts` | Agent Card 有哪些字段、结构校验拦什么 | 模块 4 |
| `02-jws-jcs.ts` | Signed Agent Card 怎么签、怎么验、篡改为什么会失败 | 模块 5（核心） |
| `03-version-negotiation.ts` | `A2A-Version` 协商、v1.0 枚举 kebab→SCREAMING_SNAKE | 模块 6 |
| `04-protocol-router.ts` | 一个目标多种触达时怎么选 MCP/A2A/HTTP | 模块 7 |
| `05-service-directory.ts` | 按能力/链/预算/健康/信誉撮合 agent | 模块 8 |
| `06-interop-rejection.ts` | 坏 Card 全拒绝（安全灵魂，带 8 条自断言） | 模块 8 |

单独跑某个也行：

```bash
pnpm demo:jws       # 看 JWS+JCS 签名验签
pnpm demo:interop   # 看发现链路的完整拒绝矩阵
```

## 0.3 第二组可运行代码：真实 SDK 三进程互相调用

本地概念跑通后，跑真实的 MCP + A2A 双 agent 链路。这组用**真实** `@modelcontextprotocol/sdk` 和 `@a2a-js/sdk`，MCP 工具**真连 Base Sepolia 公共 RPC**（只读，无需私钥 / API key）：

```bash
cd /home/lenovo/solidity-course/ata/layer6/agent-network
pnpm install
```

开三个终端，按顺序起：

```bash
# 终端 1：MCP server —— 把 Base Sepolia 只读能力封装成工具
pnpm start:mcp

# 终端 2：A2A agent —— 发布 Signed Agent Card，接任务、内部调 MCP 工具
pnpm start:agent

# 终端 3：client —— 发现 agent → 验签 → 派任务 → 收真实链上数据
pnpm start:client
```

这一步会真实地做：

```text
client
  -> GET /.well-known/agent-card.json 发现 A2A agent
  -> 验证 Agent Card 的 JWS 签名
  -> sendMessage 派任务「查某地址在 Base Sepolia 的余额」
  -> A2A agent 的 executor 接到任务
  -> executor 内部用 MCP 调 mcp-server 的 getBalance 工具
  -> mcp-server 用 viem 连公共 RPC 查真实余额
  -> 结果原路返回，client 打印真实链上余额
```

里程碑网关（正常交接 + 目录撮合 + 篡改卡的错误回放）：

```bash
pnpm start:gateway
```

## 0.4 这一层的主线心智

把所有名词压成一句：

```text
MCP 接工具，A2A 接 agent；
发现一个 agent，先验它 Agent Card 的签名（JWS+JCS）；
版本要协商（A2A-Version），坏卡一律拒绝；
服务目录做撮合（能力/链/预算/信誉）；
ERC-8004 让身份和信誉可携带、可验证。
```

一次完整的 agent-to-agent 交接长这样：

```text
A2A 发现对方（读 Agent Card）
  -> 验签（JWS + JCS，挡住伪造）
  -> 版本协商（A2A-Version）
  -> 服务目录撮合（选一个能干活、信得过的）
  -> 派任务（JSON-RPC message/send）
  -> 对方内部用 MCP 调工具干活
  -> 回结果，全程可审计
```

先把这句话和这条链路跑通，再去读每个模块，脑子会轻很多。

## 0.5 一个贯穿本层的诚实边界（重要）

**A2A 协议已经发布 v1.0，但官方 JS SDK（`@a2a-js/sdk`）当前实现的还是 spec v0.3.0。**

这意味着：本层正文讲 A2A **概念**时按 v1.0（Signed Agent Card、11 个 JSON-RPC 方法、三种 binding、破坏性变更），但 `agent-network` 里的**可运行代码**用的是 SDK v0.3.x 的 API，卡里的 `protocolVersion` 也是 `0.3.0`。这不是 bug，是这个领域「协议跑在 SDK 前面」的真实状态。每章涉及处都会标注，你动手前以当前 npm 包为准。这种「概念领先、实现追赶」的落差，本身就是 2026 年做 agent 协议要有的心理准备。

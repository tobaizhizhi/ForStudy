# Layer 7 课程大纲 — Agentic 支付

目标：把 Layer 6 里"agent 能互相发现、协作、交接任务"，升级成"agent 之间能**自主、可审计、安全地转移价值**"——用 x402 结算稳定币，用 AP2 授权高风险支付。

这一层是 Web3 A2A 区别于普通多 agent 系统的**根本**。前面几层铺好了地基：

- Layer 4：给 agent 一把受限 session key 钱包（能自主花，但花得住手）。
- Layer 5：给 agent 大脑和工具。
- Layer 6：让 agent 互相发现、验证身份、交接任务（A2A + MCP + ERC-8004）。
- Layer 7（本层）：让协作中的 agent **能自主付款/收款**——这是"agent 经济"真正跑起来的一层。

Layer 7 要回答一个很具体的问题：

```text
Agent A 用了 Agent B 的服务，怎么自主、可审计、安全地把钱付给 B？
```

答案是两层：**x402** 负责结算（钱真的付了），**AP2** 负责授权（这笔钱被批准了）。其中 x402 是本层核心（代码密集、真跑）；AP2 授权层本课轻量处理（概念 + 本地 mandate 演示）。

## 一句话讲清这一层

```text
Layer 6：agent 能互相发现、协作、交接任务
Layer 7：agent 能自主付款/收款（x402 结算 + AP2 授权 + 完整支付闭环）
```

## 学习原则

- **优先用官方 SDK / 中间件，不手写 402**：x402 用 `@x402/*` v2 的中间件（`@x402/express` / `@x402/fetch`），不手写 402 握手、proof 解析、结算撮合。
- **验证再放行**：服务端必须先验证付款（金额/链/币/收款方/时间窗/防重放），再释放付费资源。
- **授权和结算绑定**：AP2 mandate 和 x402 结算必须绑定同一 task id、金额、币种、链、收款方——任一不符就拒绝。
- **支付是状态机，不是"付没付"**：每个状态要能映射到日志和 UI，能回答"卡在哪、为什么、能不能重试/退款"。
- **高风险回到人工**：小额走 session key + x402 自动路径；高金额/高风险必须先拿到签过的 AP2 mandate。
- **测试网优先、公共 facilitator 不自建**：全程 Base Sepolia + 测网 USDC，用公共 facilitator。

## 推荐技术栈

| 关注点 | 推荐工具 | 用来做什么 | 不要做什么 |
| --- | --- | --- | --- |
| 结算（server） | `@x402/express`（v2.17） | `paymentMiddleware` 把 API 变付费资源 | 不手写 402 握手 / proof 解析 |
| 结算（client） | `@x402/fetch`（v2.17） | `wrapFetchWithPayment` 自动付款 | 不手写签名重试逻辑 |
| 结算方案 | `@x402/evm` 的 `ExactEvmScheme` | Base Sepolia 上的 exact-evm 定价结算 | —— |
| facilitator | 公共 `x402.org/facilitator` | 验证付款 + 上链结算 | MVP 不自建 facilitator |
| 稳定币 | USDC（EIP-3009 gasless） | Base Sepolia 测网结算币 | —— |
| 授权（轻量） | 本地 mandate 演示（P-256） | 高风险支付的签名授权 | 本课不接真实 AP2 SDK |
| 链交互 | viem | 账户 / publicClient | —— |

> x402 用 V2 的 scoped 包（`@x402/core`·`@x402/evm`·`@x402/express`·`@x402/fetch`，实测 v2.17.0），不是旧的扁平 `x402-express` v1.x。network 用 **CAIP-2**（`eip155:84532` = Base Sepolia）。动手前以当前 npm 包为准。

## 里程碑项目：Paywalled Agent Service

做一个 **Paywalled Agent Service** —— 把一个 agent 服务变成付费资源：

```text
A 请求 B 的服务 → B 回 402 报价
  → (高风险) A 先拿一个签过的 AP2 mandate
  → A 签 EIP-3009 USDC 授权、带 proof 重试
  → facilitator 验证并结算 → B 返回结果
  → 前端展示支付状态、交易 hash、回执、对账信息
  → 失败支付能重试或标记退款
```

并把它接回北极星业务：Agent A 通过 Layer 6 发现 Agent B，通过 Layer 7 为 B 的服务付 USDC；高风险金额走 AP2 mandate 人工审批，全链路可审计。

## 本层目录

```text
layer7/
  00-先跑起来：Layer7学习导读.md        推荐入口：先跑本地 lab，再跑真实 x402 付费服务
  01-course-outline.md                  本文件
  02-为什么Agent需要自主支付.md          模块1：AP2=谁批准 / x402=钱真付了
  03-x402协议与HTTP402握手.md            模块2：402 握手全流程 + PaymentRequirements/proof
  04-EIP-3009与稳定币gasless结算.md      模块3：transferWithAuthorization、USDC、facilitator
  05-用x402-SDK做付费服务.md             模块4（核心）：@x402 server 中间件 + client wrapFetch，真跑
  06-支付状态机与对账.md                 模块5：状态机 + 幂等 + 对账 + 失败恢复/退款
  07-AP2授权层：Mandate与a2a-x402.md     模块6（轻量）：三 mandate + VC 签名 + 高风险审批
  08-里程碑：Paywalled-Agent-Service.md   模块7：报价→授权→结算→回执→对账 全闭环 + 安全验收
  总结与复习.md                          分模块回顾 + 概念对照表 + 综合自测 + 产物清单

  payment-lab/                          本地可运行练习（不联网 / 不花钱 / 无私钥）
    src/01-x402-handshake.ts            402 握手：构造 requirements、拼 payment
    src/02-payment-verify.ts            校验 payment：金额/币/链/收款方/时间窗/防重放
    src/03-state-machine.ts            支付状态机流转 + 非法跃迁被拒
    src/04-reconciliation.ts           对账：task/mandate/tx/金额 串起来，重复通知幂等
    src/05-ap2-mandate.ts              本地签/验 AP2 风格 mandate(P-256)，高风险审批
    src/06-interop-rejection.ts        拒绝矩阵：伪造 proof/金额不足/错收款方/过期/重复/挪用(带自断言)

  paywalled-service/                    真实 x402 付费服务（单包多入口，真连公共 facilitator）
    src/config.ts                       RPC / facilitator / 收款地址 / 价格 / 客户端私钥(可选)
    src/server.ts                       进程①：@x402/express 把 /premium 设为 $0.001 付费资源
    src/client.ts                       进程②：@x402/fetch wrapFetchWithPayment 自动付款
    src/inspect-402.ts                  进程③(无需私钥)：裸 fetch 看 402 + payment-required header
```

## 模块地图

| 模块 | 主题 | 产出 |
| --- | --- | --- |
| 1 | 为什么需要自主支付 | 能说清 AP2=授权 / x402=结算 的分工，和为什么 agent 支付 ≠ 转一次账 |
| 2 | x402 协议与 402 握手 | 能讲清 402 握手全流程、PaymentRequirements 和 proof |
| 3 | EIP-3009 与 gasless 结算 | 能说清 transferWithAuthorization、USDC、facilitator 怎么结算 |
| 4（核心） | 用 x402 SDK 做付费服务 | 用 `@x402` 中间件起一个真付费服务、看 402、（填钱包后）真付一笔 |
| 5 | 支付状态机与对账 | 能设计支付状态机、对账簿、幂等回执、失败恢复 |
| 6（轻量） | AP2 授权层 | 能说清三 mandate、VC 签名、高风险人工审批，本地演示 mandate 签/验 |
| 7 | 里程碑 | 交付 Paywalled Agent Service，跑通报价→授权→结算→回执→对账全闭环 |

## 安全验收（贯穿全层）

- 授权和结算必须**绑定同一** task id、金额、币种、链和收款方。
- **伪造 proof / 重复提交 / 过期 quote / 金额不足 / 错误收款地址**都要被拒绝。
- 服务端必须**先验证付款再释放**付费资源。
- 支付状态变化必须**可审计**，不能只看最后一笔 tx；重复通知要幂等，迷失/迟到回执要能识别。
- 高风险金额必须先拿到**签过的 AP2 mandate**（人工审批）才能结算。
- 私钥**只进 `.env`**（.gitignore 排除），不进前端/日志/仓库，只用测试网私钥。

## 前置条件

- 已完成 Layer 4（session key 钱包）、Layer 6（A2A + MCP）。
- Node 20+、pnpm。
- 真付款需要：一个 Base Sepolia 测试钱包 + 测网 USDC（<https://faucet.circle.com>）。只看 402 握手则不需要钱包。

## 下一步怎么接

Layer 7 交付后，agent 已经能"自主付款/收款"。后面：

```text
Layer 7：x402 结算 + AP2 授权（agent 能自主、可审计地付钱）
后续  ：Layer 8 安全加固（支付重复提交测试、伪造 proof 测试进 CI）；
        Capstone 把 A2A 发现 + ERC-8004 信誉 + x402 支付串成完整 agent 服务市场
```

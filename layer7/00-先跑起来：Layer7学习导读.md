# Layer 7 学习导读 —— 先把"agent 自主付一笔钱"跑出感觉

哈喽，进入 Agentic 支付这一层。到 Layer 6 为止，你的 agent 已经能**互相发现、验证身份、交接任务**了。但还差最后一块，也是 Web3 A2A 区别于普通多 agent 系统的**根本**那一块：

> Agent A 用了 Agent B 的服务，怎么**自主地、可审计地、安全地**把钱付给 B？

Layer 7 就是回答这个问题：用 **x402** 做稳定币结算（钱真的付了），用 **AP2** 做支付授权（这笔钱被批准了）。

这一层最容易踩的坑是"以为支付就是转一次账"。真实的 agent 支付是一整套**产品级闭环**：报价 → 授权 → 结算 → 回执 → 对账 → 失败恢复/退款。所以这一层沿用 layer4/layer6 的自学方式：

```text
先讲清楚为什么
  -> 本地最小代码跑出数据（不联网、不花钱、✅/⛔ 打印）
  -> 再用真实 x402 SDK 起一个付费服务
  -> 最后把授权/结算/对账收敛成一个付费闭环
```

## 0.1 本层怎么学

建议按这个顺序走，不要跳：

1. 读 `01-course-outline.md`，知道 Layer 7 要交付什么。
2. 读 `02-为什么Agent需要自主支付.md`，建立 AP2=谁批准 / x402=钱真付了 的心智。
3. 进入 `payment-lab/`，跑本地 demo，看见 402 握手、payment 校验、状态机、对账、mandate 长什么样。
4. 读 `03`、`04`，理解 x402 握手和 EIP-3009 gasless 结算。
5. 读 `05`，进入 `paywalled-service/`，用真实 `@x402` SDK 起一个付费服务、看 402、（填测试钱包后）真付一笔。
6. 读 `06`、`07`，把支付状态机、对账、AP2 授权补齐。
7. 读 `08` 里程碑，把整个付费闭环串起来，最后读 `总结与复习.md`。

## 0.2 第一组可运行代码：不联网、不花钱、✅/⛔ 打印

先跑这个。本地 lab 不需要 `.env`、不联网、不付真钱、不需要私钥：

```bash
cd /home/lenovo/solidity-course/ata/layer7/payment-lab
pnpm install
pnpm demo:all
```

你会依次看到：

| 脚本 | 学什么 | 对应章节 |
| --- | --- | --- |
| `01-x402-handshake.ts` | 402 响应的 PaymentRequirements、client 怎么拼 payment | 模块 2 |
| `02-payment-verify.ts` | facilitator 怎么验金额/链/币/收款方/时间窗/防重放 | 模块 2/5 |
| `03-state-machine.ts` | 支付不是"付没付"，是一串可审计状态 | 模块 5 |
| `04-reconciliation.ts` | 对账 + 重复通知幂等 + 迷失回执 | 模块 5 |
| `05-ap2-mandate.ts` | AP2 mandate 签/验（ECDSA P-256），高风险审批 | 模块 6 |
| `06-interop-rejection.ts` | 坏支付全拒绝（安全灵魂，带 10 条自断言） | 模块 7 |

## 0.3 第二组可运行代码：真实 x402 付费服务

本地概念跑通后，用**真实** `@x402/*` v2 SDK 起一个付费服务。这组真连 **Base Sepolia + 测网 USDC**：

```bash
cd /home/lenovo/solidity-course/ata/layer7/paywalled-service
pnpm install
cp .env.example .env
```

**先看 402 握手（不花钱、不需要私钥）**：

```bash
pnpm start:server    # 终端 1：起付费服务
pnpm inspect         # 终端 2：裸 fetch 看真实 402 + payment-required header
```

`inspect` 会打印真实的 `402 Payment Required` 和 server 给的付款要求——这是 x402 握手的第一步，无需钱包即可验证。

**真付一笔（需要测试钱包 + 测网 USDC）**：在 `.env` 填 `PAY_TO`（收款）和 `CLIENT_PRIVATE_KEY`（付款钱包），领测网 USDC（<https://faucet.circle.com>，选 Base Sepolia），然后：

```bash
pnpm start:server    # 终端 1
pnpm start:client    # 终端 2：自动完成 402 → 签名 → 结算 → 拿到付费内容
```

## 0.4 这一层的主线心智

把所有名词压成一句：

```text
x402 = 钱真的付了（HTTP 402 + 稳定币链上结算）
AP2  = 这笔钱被批准了（签名 mandate）
一次 HTTP 往返完成机器对机器支付；facilitator 验证再放行；
支付是一串可审计状态，不是"付没付"；
授权和结算必须绑定同一任务/金额/币/链/收款方。
```

一次完整的付费调用长这样：

```text
client 请求付费资源
  -> server 回 402 Payment Required + PaymentRequirements（怎么付）
  -> (高风险) 先拿一个签过的 AP2 mandate
  -> client 签 EIP-3009 USDC 授权，带 proof 重试
  -> facilitator 验证、上链结算 USDC（gasless）
  -> server 放行返回资源
  -> 回执入对账簿，task/mandate/tx/金额 串起来
```

先把这句话和这条链路跑通，再去读每个模块，脑子会轻很多。

## 0.5 两个贯穿本层的诚实边界（重要）

1. **x402 用 V2 的 scoped 包 `@x402/*`（实测 v2.17.0）**，不是旧的扁平 `x402-express` v1.x。network 用 CAIP-2（`eip155:84532` = Base Sepolia）。正文代码都按 v2 API 写。
2. **真付款需要测试钱包 + 测网 USDC**。脚手架实测到"server 真实返回 402"（`pnpm inspect`，无需私钥）；签名付款并结算那半段由你填 `.env` 后自己跑——和 layer4 真实链脚本一样。本地 `payment-lab` 则 100% 不联网、不花钱可跑。

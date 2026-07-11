# 模块 7：里程碑 —— Paywalled Agent Service

到这里，Layer 7 的每块拼图都齐了：x402 结算（模块 2–4）、支付状态机与对账（模块 5）、AP2 授权（模块 6）。本模块把它们收敛成一个完整的 **Paywalled Agent Service**——一个 agent 把自己的服务变成付费资源，另一个 agent 自主付款调用，全程可审计。

> 目标：跑通"报价 → 授权 → 结算 → 回执 → 对账"的完整付费闭环，并逐条对照安全验收。

## 8.1 里程碑长什么样

```text
Agent A（请求方）                         Agent B（提供方 = Paywalled Service）
    │                                          │
    │──────── GET /premium ───────────────────▶│
    │◀─── 402 Payment Required + 报价 ──────────│   ① 报价
    │                                          │
    │  (金额超阈值) 先拿一个签过的 AP2 mandate   │   ② 授权（高风险才要）
    │                                          │
    │── 签 EIP-3009 USDC 授权，带 proof 重试 ──▶│   ③ 结算
    │                          facilitator 验证+上链结算 USDC（gasless）
    │◀─── 200 + 付费内容 ───────────────────────│   ④ 回执
    │                                          │
    │  task ↔ mandate ↔ tx ↔ 金额 入对账簿      │   ⑤ 对账
```

这正是开篇北极星项目的支付环：Agent A 通过 Layer 6 发现 Agent B，通过 Layer 7 为 B 的服务付 USDC。

## 8.2 组成与文件对应

| 能力 | 由谁实现 | 脚手架文件 |
| --- | --- | --- |
| 付费资源（报价 + 402） | x402 server 中间件 | `paywalled-service/src/server.ts` |
| 自动付款（结算） | x402 client `wrapFetchWithPayment` | `paywalled-service/src/client.ts` |
| 看握手（无需私钥） | 裸 fetch | `paywalled-service/src/inspect-402.ts` |
| 高风险授权 | AP2 mandate（P-256） | `payment-lab/src/05-ap2-mandate.ts` |
| 状态机 + 对账 | 状态机 + 对账簿 | `payment-lab/src/03/04-*.ts` |
| 坏支付拒绝 | 拒绝矩阵（自断言） | `payment-lab/src/06-interop-rejection.ts` |

## 8.3 跑起来

**先看握手（不花钱、不需要私钥）——这一半已实测：**

```bash
cd paywalled-service
pnpm start:server    # 终端 1
pnpm inspect         # 终端 2
```

实测输出：

```text
HTTP 状态：402 Payment Required
✅ 如预期返回 402 Payment Required —— 这就是 x402 握手的第一步。
  payment-required: eyJ4NDAyVmVyc2lvbiI6Miwi...
```

**真实付款（需要测试钱包 + 测网 USDC）——这一半读者自己跑：**

```bash
cp .env.example .env
# 填 PAY_TO（收款）和 CLIENT_PRIVATE_KEY（付款钱包）
# 领测网 USDC：https://faucet.circle.com（选 Base Sepolia）
pnpm start:server    # 终端 1
pnpm start:client    # 终端 2 → 自动完成 402 → 签名 → 结算 → 拿到付费内容
```

**本地支付逻辑全景（不联网）：**

```bash
cd payment-lab && pnpm demo:all   # 握手→验证→状态机→对账→mandate→拒绝矩阵
```

## 8.4 高风险分流：什么时候要 AP2

里程碑要体现"小额自动、大额审批"的分流：

```text
金额/风险分数 ≤ 阈值  → 走 session key + x402 自动路径（模块 4）
金额/风险分数 > 阈值  → 状态机进入 awaiting_mandate，先拿签过的 AP2 mandate（模块 6），
                        且 mandate 必须绑定这次结算的 task/金额/币/链/收款方，才继续 x402 结算
```

## 8.5 安全验收（逐条对照）

Layer 7 的安全验收，每条都能落到脚手架的某个 demo/进程：

| 安全验收 | 由谁保证 | 怎么验 |
| --- | --- | --- |
| 授权和结算绑定同一 task/金额/币/链/收款方 | `verifyMandate` 绑定校验 + `verifyPayment` | `demo:mandate` / `demo:verify` |
| 伪造 proof 被拒 | `verifyPayment`（签名为空 ⛔） | `demo:interop` |
| 金额不足 / 错收款方被拒 | `verifyPayment` | `demo:verify` / `demo:interop` |
| 过期 quote 被拒 | `verifyPayment`（validBefore） | `demo:verify` |
| 重复提交被拒 | `verifyPayment`（nonce 去重） | `demo:interop` |
| 先验证再放行 | x402 中间件 + facilitator | `pnpm inspect`（付款前只给 402） |
| 支付状态可审计 | 状态机 + 对账簿 | `demo:state` / `demo:recon` |
| 高风险走人工审批 | AP2 mandate 阈值 | `demo:mandate` |
| 私钥不进仓库 | `.env` + `.gitignore` | 检查 `.gitignore` 含 `.env` |

`pnpm demo:interop` 的 10 条自断言全过，就是"坏支付一律拒绝"这条安全底线的可运行证明。

## 8.6 诚实边界（本层集中说明）

- **x402 用 `@x402/*` v2 scoped 包（v2.17）**，不是旧 `x402-express` v1.x；network 用 CAIP-2；公共 facilitator `x402.org/facilitator`。
- **真实付款需读者填 `.env`**（测试钱包 + 测网 USDC）。脚手架实测到"server 真实返回 402"（`pnpm inspect`，无需私钥这半段已验证）；签名结算半段读者自己跑——和 Layer 4 真实链脚本一致。
- **AP2 是本地 P-256 演示**，不接真实 AP2 SDK；`payment-lab` 的 mandate/proof 是教学手写演示原理，非生产密码库。

## 8.7 接回北极星 & 下一步

至此，北极星项目的支付环打通了：

```text
Layer 4：受限 session key 钱包（能自主花、花得住手）
Layer 6：A2A 发现 + MCP 工具 + ERC-8004 身份（能互相找到、信任、协作）
Layer 7：x402 结算 + AP2 授权（能自主、可审计地付钱）  ← 你在这
后续  ：Layer 8 把支付重复提交、伪造 proof 这些测试放进 CI；
        Capstone 把发现 + 信誉 + 支付串成完整 agent 服务市场
```

## 本模块小结

- Paywalled Agent Service 把 x402 结算、AP2 授权、状态机、对账收敛成一个可审计付费闭环。
- 完整链路：报价（402）→（高风险）授权（mandate）→ 结算（EIP-3009 + facilitator）→ 回执 → 对账。
- 小额走 x402 自动路径，大额进 `awaiting_mandate` 走 AP2 审批。
- 安全验收每条都能落到某个 demo/进程；`demo:interop` 的自断言是"坏支付全拒绝"的可运行证明。
- 边界：x402 v2 包、真实付款需读者钱包、AP2 本地演示——都已诚实标注。

## 复习题

1. 画出 Paywalled Agent Service 的完整闭环（报价→授权→结算→回执→对账）。
2. 小额和大额支付在状态机上走的路径有什么不同？分流的依据是什么？
3. "授权和结算绑定同一 task/金额/币/链/收款方"这条验收，由脚手架里哪两个函数保证？
4. `pnpm inspect` 无需私钥能验证哪条安全验收？为什么它只给 402、不给内容？
5. `demo:interop` 的自断言证明了哪条安全底线？
6. 本里程碑有哪三条诚实边界？真实付款还缺什么前置条件？
7. Layer 7 交付后，北极星项目还差哪些环节（提示：安全 CI、Capstone）？

Layer 7 的模块到此结束，接下来是总结与复习。

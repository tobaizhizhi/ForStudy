# payment-lab —— Layer 7 本地可运行练习

不联网、不付真钱、无私钥文件。用纯本地 TypeScript 把 x402 402 握手、payment 校验、支付状态机、对账、AP2 mandate、互操作拒绝跑出数据（`✅通过 / ⛔拒绝`）。

## 跑起来

```bash
pnpm install
pnpm demo:all      # 依次跑 01–06
```

单独跑：

```bash
pnpm demo:handshake  # 01 x402 的 402 握手（server 报价 → client 拼 payment）
pnpm demo:verify     # 02 facilitator 校验 payment（验证再放行）
pnpm demo:state      # 03 支付状态机（合法路径 vs 非法跃迁）
pnpm demo:recon      # 04 结算对账（task↔mandate↔tx↔金额 串起来）
pnpm demo:mandate    # 05 AP2 mandate（P-256 签名，高风险审批）
pnpm demo:interop    # 06 互操作拒绝矩阵（带 10 条自断言）
pnpm check           # tsc --noEmit
```

## 每个 demo 学什么

| 脚本 | 学什么 | 对应正文 |
| --- | --- | --- |
| `01-x402-handshake.ts` | 402 响应的 PaymentRequirements、client 怎么拼 payment | 模块 2 |
| `02-payment-verify.ts` | 金额/链/币/收款方/时间窗/防重放怎么验 | 模块 2/5 |
| `03-state-machine.ts` | 支付不是"付没付"，是一串可审计状态 | 模块 5 |
| `04-reconciliation.ts` | 对账 + 重复通知幂等 + 迷失回执 | 模块 5 |
| `05-ap2-mandate.ts` | AP2 mandate 签/验（ECDSA P-256），高风险审批 | 模块 6 |
| `06-interop-rejection.ts` | 坏支付全拒绝（安全灵魂，带自断言） | 模块 7 |

## 边界（诚实标注）

- x402 的 PaymentRequirements/EIP-3009 授权、AP2 mandate 都是**本地类型 + Node 内置 crypto 手写演示原理**（AP2 用 P-256 对应真实 ECDSA），不是真实 SDK、不签真交易。
- 真实 `@x402/*` v2 SDK 的端到端付费服务在隔壁 `../paywalled-service/`（真连公共 facilitator + Base Sepolia USDC）。

# paywalled-service —— Layer 7 真实 x402 付费服务

用**真实** `@x402/*` v2 官方中间件，把一个 API 变成付费资源：client 请求 → server 回 `402 Payment Required` → client 自动签 EIP-3009 USDC 授权 → 带 proof 重试 → 公共 facilitator 结算 → 返回结果。真连 **Base Sepolia + 测网 USDC**。

```
client ──GET /premium──▶ server(@x402/express)
   │                        │ 402 + PaymentRequirements
   │◀───────────────────────┘
   │ wrapFetchWithPayment 自动签 EIP-3009、带 proof 重试
   ▼
facilitator(公共) 验证并结算 USDC ──▶ server 放行返回付费内容
```

## 跑起来

```bash
pnpm install
cp .env.example .env    # 按需填
```

### 1) 先看 402 握手（不花钱、不需要私钥）

```bash
pnpm start:server       # 终端 1：起付费服务
pnpm inspect            # 终端 2：裸 fetch 看 402 + payment-required header
```

`inspect` 会打印真实的 `402 Payment Required` 和 server 给的付款要求——这是 x402 握手的第一步，无需任何钱包即可验证。

### 2) 真实付款（需要测试钱包 + 测网 USDC）

在 `.env` 填：

```env
PAY_TO=0x你的测试收款钱包
CLIENT_PRIVATE_KEY=0x有BaseSepoliaUSDC的测试钱包私钥
```

领测网 USDC：<https://faucet.circle.com>（选 Base Sepolia）。然后：

```bash
pnpm start:server       # 终端 1
pnpm start:client       # 终端 2：自动完成 402 → 签名 → 结算 → 拿到付费内容
```

`pnpm typecheck` 做类型检查。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `config.ts` | RPC / facilitator / 端口 / 收款地址 / 价格 / 客户端私钥（可选） |
| `server.ts` | `paymentMiddleware` + `x402ResourceServer` + `ExactEvmScheme`，把 `/premium` 设为 $0.001 付费资源 |
| `client.ts` | `wrapFetchWithPayment` + `x402Client`，自动付款调用（需私钥） |
| `inspect-402.ts` | 裸 fetch 看 402 握手（无需私钥） |

## 边界（诚实标注，2026-07）

- 用 **`@x402/*` v2 scoped 包（实测 v2.17.0）**：`@x402/express`、`@x402/core`、`@x402/evm`、`@x402/fetch`——不是旧的扁平 `x402-express` v1.x。network 用 **CAIP-2**（`eip155:84532` = Base Sepolia）。
- facilitator 用公共 `https://x402.org/facilitator`（Base Sepolia + Solana devnet），不自建。
- **实测到"server 真实返回 402 + payment-required header"**（`pnpm inspect`，无需私钥）；签名付款并结算那半段需要你在 `.env` 填测试钱包 + 领测网 USDC 后自己跑（和 layer4 真实链脚本一致）。
- 本地不联网、不花钱的支付逻辑演示在隔壁 `../payment-lab/`。

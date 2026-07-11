# 模块 3：EIP-3009 与稳定币 gasless 结算

上一模块讲清了 402 握手：client 请求 → server 回 `402 Payment Required` + 一张 `PaymentRequirements` → client 选一个 requirement、签个 proof、带着重试 → facilitator 验证并结算 → server 放行。

握手的骨架有了，但中间藏着一个没交代的黑盒：

> client 那个"proof"到底是什么？facilitator 拿它去"结算"，钱**具体是怎么从 client 的账户流到 server 的**？谁付上链的 gas？

这一模块就是把这个黑盒打开。答案是一个具体的以太坊标准：**EIP-3009 `transferWithAuthorization`**。x402 结算的钱能真的动、还能让付款方**不用持有 ETH 付 gas**，靠的就是它。USDC、EURC 这些主流稳定币走的都是这条底层。

> 目标：能说清 x402 的钱靠 EIP-3009 gasless 转账真的动；能讲清 `from/to/value/validAfter/validBefore/nonce` 六个字段各管什么、EIP-712 签名为什么让付款方 gasless；能对照说清 facilitator 在"验证 + 结算"里的角色；能报出 USDC 6 位小数 / Base Sepolia USDC 地址 / 领测网币的入口。

## 3.1 先讲清楚：x402 的钱，凭什么"不花 gas"就动了？

普通的链上转账，付款方必须自己发交易、自己付 gas：你要转 USDC，就得钱包里**先有 ETH**，签一笔 `transfer` 交易、上链、扣 gas。

放到 agent 支付场景，这有两个致命的别扭：

- **付款方得备 gas 币**：一个只想付 $0.001 USDC 的 agent，得先给自己充 ETH 付 gas。为了付一分钱，先准备一份 gas 预算——这不合理。
- **付款方得会发交易、等确认**：x402 的付款方是 HTTP client，它想做的只是"在一个 HTTP 请求里附一张付款凭证"，不想变成一个要管 nonce、管 gas price、等区块确认的链上钱包。

EIP-3009 正好把这两件事拆开：

```text
传统转账：  付款方   签交易 + 付 gas + 上链          →  一个人干完所有事，必须有 ETH
EIP-3009 ： 付款方   只【签一张授权】（离线、不上链、不花 gas）
            兑现方   拿这张授权去链上执行 transfer、【付 gas】
```

付款方只**签一张授权消息**（一段离线的 EIP-712 签名，不上链、零 gas）；真正把交易发上链、付 gas 的，是**另一个人**——在 x402 里就是 **facilitator**。付款方于是"gasless"：它不需要 ETH，也不需要发交易。这正是 x402 能让 agent"在一个 HTTP 请求里顺手把钱付了"的底层原因。

## 3.2 类比：签一张授权支票，让别人去兑现并垫手续费

把 EIP-3009 想成一张**特殊的支票**：

> 你写一张支票，上面写清楚：**从我的账户（from）、付给某人（to）、金额（value）、这张支票在某个时间段内有效（validAfter ~ validBefore）、并且盖一个一次性防伪编号（nonce）**。你签上名，把支票交给收款方（或代理人）。
>
> 关键在于：**你不用亲自跑一趟银行**。收款方拿着这张签好的支票去银行柜台兑现，**跑腿的手续费（gas）由去兑现的那个人垫付**。银行只认支票上的签名、金额、有效期和那个一次性编号——编号用过一次就作废，别人捡到这张支票的复印件也兑不出第二次。

对照到 EIP-3009：

- **你签的支票** = 一段 EIP-712 结构化签名，离线生成、不花 gas。
- **拿去兑现的人** = facilitator，它发起链上交易、付 gas，把 USDC 从 `from` 转到 `to`。
- **一次性防伪编号** = `nonce`，链上合约记住"这个 nonce 用过了"，**天然防重放**——同一张授权提交两次，第二次被合约拒。
- **有效时间段** = `validAfter` / `validBefore`，让这张授权**会过期**，也不能提前生效。

这个类比里有一句要刻进脑子的话：**签授权 ≠ 转账**。你签支票的那一刻，钱**没动**；钱是在**别人拿去兑现、上链成功**那一刻才动的。这个"签 vs 兑现"的分离，就是 gasless 的全部秘密，也是后面 facilitator 角色的由来。

## 3.3 EIP-3009 机制：六个字段 + EIP-712 签名

`transferWithAuthorization` 是 EIP-3009 的核心方法。付款方要签的授权，就是下面这**六个字段**。我们的脚手架 `payment-lab/src/shared.ts` 把它落成了一个类型，字段一一对应：

```ts
// payment-lab/src/shared.ts
export interface Eip3009Authorization {
  from: string;        // 付款方地址（授权从这个账户扣钱）
  to: string;          // 收款方地址（钱转给谁 —— 必须 == requirements.payTo）
  value: string;       // 金额，原子单位（USDC 6 位：1000 = $0.001）
  validAfter: number;  // 在此时间之前，授权还没生效
  validBefore: number; // 在此时间之后，授权过期（quote 的时间窗）
  nonce: string;       // 32 字节随机，一次性，链上合约记账防重放
}
```

六个字段各自挡住一类问题，记住它们**不是随便凑的**：

| 字段 | 管什么 | 少了它 / 用错会怎样 |
| --- | --- | --- |
| `from` | 钱从哪个账户扣 | —— 授权必须由 `from` 的私钥签，别人签不了 |
| `to` | 钱转给谁 | 必须 == `requirements.payTo`，否则就是"改单"把钱转给攻击者 |
| `value` | 转多少（原子单位） | 少于报价 = 金额不足，被拒 |
| `validAfter` | 何时开始生效 | 挡住"提前使用" |
| `validBefore` | 何时过期 | 让 quote 会过期，超时的授权作废 |
| `nonce` | 一次性防伪编号 | 链上合约记账；**天然防重放**，同一 nonce 兑第二次被合约拒 |

这六个字段被打包成一个 **EIP-712 结构化数据**（`TransferWithAuthorization` 类型），连同稳定币合约的 **domain（合约地址、chainId、名称、版本）** 一起做哈希，付款方用私钥对这个哈希签名。EIP-712 的意义是：签的不是一串看不懂的十六进制，而是**结构化、可读、绑定到具体合约和链**的数据——钱包能弹出"你正在授权从 A 转 X USDC 到 B"给人看，且这个签名**只对那一个合约、那一条链有效**，换条链、换个币都对不上。

签完之后，付款方把 `{ 六个字段 + 签名 }` 交出去。谁拿到它，就能调那个稳定币合约的 `transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, signature)`——**这一步是调用方付 gas 的**，付款方全程零 gas。

### server / facilitator 侧的校验

拿到这笔 payment，结算前必须**先验证**。脚手架 `payment-lab/src/shared.ts` 里的 `verifyPayment()` 就是把"验证再放行"落成代码，逐条对齐 requirements：

```ts
// payment-lab/src/shared.ts —— facilitator/server 侧"验证再放行"的核心
export function verifyPayment(
  pay: PaymentPayload,
  req: PaymentRequirements,
  ctx: { now: number; usedNonces: Set<string> },
): Result {
  if (pay.scheme !== req.scheme)   return { ok: false, reason: `scheme 不符：${pay.scheme} ≠ ${req.scheme}` };
  if (pay.network !== req.network) return { ok: false, reason: `链不符：${pay.network} ≠ ${req.network}` };
  if (pay.asset.toLowerCase() !== req.asset.toLowerCase())
    return { ok: false, reason: "结算币种不符" };

  const a = pay.authorization;
  if (a.to.toLowerCase() !== req.payTo.toLowerCase())
    return { ok: false, reason: "收款地址不是要求的 payTo（可能被改单）" }; // ← to 字段
  if (BigInt(a.value) < BigInt(req.amount))
    return { ok: false, reason: `金额不足：${a.value} < ${req.amount}` };    // ← value 字段
  if (ctx.now < a.validAfter)  return { ok: false, reason: "授权还没生效" };  // ← validAfter
  if (ctx.now > a.validBefore) return { ok: false, reason: "授权已过期（quote 过期）" }; // ← validBefore
  if (ctx.usedNonces.has(a.nonce))
    return { ok: false, reason: "nonce 已用过（重复提交/重放）" };            // ← nonce 防重放

  if (!pay.signature || pay.signature === "0x")
    return { ok: false, reason: "缺少支付签名（伪造 proof）" };

  ctx.usedNonces.add(a.nonce);
  return { ok: true };
}
```

把这段和上面六个字段的表格对照着看：**每一条校验，都对应授权里的一个字段**。`to` 对不上 = 改单；`value` 小于报价 = 金额不足；`validBefore` 早于 now = quote 过期；`nonce` 见过 = 重放。这就是 x402 "验证再放行"的底线——脚手架 `payment-lab/src/02-payment-verify.ts` 把合法、金额不足、错收款方、过期、伪造 proof、错链、重放七种情况跑成一个可断言的用例集：

```bash
pnpm demo:verify
```

> 诚实标注：`Eip3009Authorization` 和 `verifyPayment()` 是**本地教学结构**，用来讲透"授权里有哪些字段、facilitator 校验哪些东西"。真实的 EIP-3009 签名要算 EIP-712 的 domain / typeHash 并用私钥签、真实的结算要调稳定币合约上链——那部分在隔壁 `paywalled-service/`（真连公共 facilitator + Base Sepolia USDC）跑，本 lab 不上链、不花钱、不需要私钥。

## 3.4 ASCII：一笔 gasless 结算的数据流

```text
─────────────────── 付款方（client / agent）：只签，不上链 ───────────────────
  收到 402 里的 PaymentRequirements  { payTo, amount, asset, network, maxTimeoutSeconds }
        │  按 requirements 填授权：to=payTo, value≥amount, validBefore=now+timeout, nonce=随机
        ▼
  Eip3009Authorization  { from, to, value, validAfter, validBefore, nonce }
        │  连同稳定币合约 domain(合约地址/chainId/名称/版本) 打包成 EIP-712
        ▼
  privateKey 签  ──EIP-712──▶  signature      ← 离线、不上链、【零 gas】
        │
        ▼
  proof = { authorization 六字段, signature }  ── 附在 HTTP 请求里，带着重试 ──┐
                                                                             │
─────────────────── facilitator：验证 + 兑现（付 gas 的人） ─────────────────│──
        ┌────────────────────────────────────────────────────────────────────┘
        ▼
  verifyPayment：scheme/链/币/收款方(to==payTo)/金额(value≥amount)/时间窗/nonce 防重放
        │
        ├── 任一不过 ──▶  ⛔ 拒绝，不结算、不放行
        ▼ 全过
  调 USDC.transferWithAuthorization(from,to,value,validAfter,validBefore,nonce,sig)
        │  ← 【facilitator 发这笔交易、付这笔 gas】；链上合约核 EIP-712 签名 + 记 nonce
        ▼
  USDC 从 from 转到 to（payTo）  →  返回 tx hash  →  server 放行付费资源  ✅
```

一句话读这张图：**付款方在上半区只做"签"，一步都不上链、不花 gas；facilitator 在下半区做"验 + 兑现"，它才是发交易、付 gas 的人。** 钱是在最后 `transferWithAuthorization` 上链成功那一刻才真的动。

## 3.5 facilitator 角色对照表：它到底替你干了什么

facilitator 是 x402 里最容易被含糊过去的角色。把它和 server、client 摆在一起，职责就清楚了：

| 角色 | 在结算里干什么 | 有没有私钥 / 付不付 gas |
| --- | --- | --- |
| client（付款方 / agent） | 按 requirements **签** EIP-3009 授权，带 proof 重试 | 有付款方私钥；**不付 gas**（只签，不上链） |
| server（资源服务方） | 出 402 + requirements；把 client 的 proof 转给 facilitator；验过才放行资源 | 一般不碰付款私钥；不直接上链结算 |
| **facilitator** | **验证** payment（金额/链/币/收款方/时间窗/防重放）+ **上链结算**（调 `transferWithAuthorization`）+ 回 tx hash | **付上链 gas**；替 server 抹平"怎么验、怎么结算"的复杂度 |

facilitator 的价值就一句话：**它把"验证付款"和"上链结算并垫 gas"这两件麻烦事从 server 身上抽走**，server 只管出报价、放行资源，不用自己写链上结算逻辑、不用自己囤 gas。

**MVP 阶段不要自建 facilitator，直接用公共的**——脚手架里就是这么定的：

```ts
// payment-lab/src/shared.ts
/** 公共测试 facilitator（Base Sepolia + Solana devnet）。 */
export const PUBLIC_FACILITATOR = "https://x402.org/facilitator";
```

`paywalled-service/` 的真实 server 也是连这个公共 facilitator（`FACILITATOR_URL="https://x402.org/facilitator"`），不自建。facilitator 是一个**多方生态**，不止一家：

| facilitator | 覆盖 / 特点 | 适合 |
| --- | --- | --- |
| `x402.org/facilitator`（公共测试） | Base Sepolia + Solana devnet，开箱即用 | 学习 / MVP，本课主线 |
| Coinbase CDP | 生产级，宣传免费额度（约 1000 笔/月量级） | 上主网、要稳定 SLA |
| RelAI、Stellar 等 | 覆盖不同链 / 生态的 facilitator | 按目标链选 |

> 诚实标注：各家 facilitator 的免费额度、覆盖链、费率会随时间变，本表是方向性介绍，**接入前以各自官方文档当前条款为准**。本课全程只用公共测试 facilitator + 测试网，不涉及主网、不产生真实费用。

## 3.6 USDC 的小数、地址与领测网币

结算币的两个"数值坑"必须先说清，不然金额永远对不上：

- **USDC 是 6 位小数**（不是 18 位）。链上金额都用**原子单位**（最小单位）表示：
  - `$1 USDC = 1_000_000`（10^6）个原子单位；
  - `$0.001 = 1000` 个原子单位——脚手架里 `makeRequirements()` 的 `amount: "1000"` 就是 $0.001，注释写得很清楚。
  - 把 18 位小数的心智（ETH 那套）套到 USDC 上，会差 12 个数量级，是新手最常见的对账错误。

```ts
// payment-lab/src/shared.ts
amount: "1000", // $0.001（USDC 6 位）
```

- **Base Sepolia 测试网 USDC 合约地址**（结算主力币，脚手架常量）：

```ts
// payment-lab/src/shared.ts
export const NETWORK_BASE_SEPOLIA = "eip155:84532"; // CAIP-2：Base Sepolia
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
```

注意 `network` 用的是 **CAIP-2** 格式 `eip155:84532`（`eip155` = EVM 系，`84532` = Base Sepolia 的 chainId），这是 x402 v2 的写法，不是裸的 chainId 数字。

- **领测网 USDC**：真要跑通"付一笔"，需要一个 Base Sepolia 测试钱包 + 一点测网 USDC，去 Circle 官方水龙头领：**<https://faucet.circle.com>**。gas 用的 Base Sepolia ETH 从对应测试网水龙头领。

> 诚实标注：只看 402 握手、只跑本 lab **不需要钱包也不需要测网币**（`pnpm inspect` 无需私钥就能看到真实 402）。真正"签授权 + 结算"这半段要读者自己填 `.env` 里的测试钱包私钥、领测网 USDC，和 Layer 4 的做法一致——私钥只进 `.env`（`.gitignore` 排除），绝不进前端 / 日志 / 仓库，且只用测试网私钥。

## 3.7 Permit2：把 gasless 扩展到任意 ERC-20（一句带过）

EIP-3009 是**稳定币自己内置**的 gasless 授权能力——USDC、EURC 这类币在合约里实现了 `transferWithAuthorization`，所以能直接走这条路。但**不是所有 ERC-20 都实现了 EIP-3009**。

对于那些没内置 EIP-3009 的普通 ERC-20，业界的通用做法是 **Permit2**（Uniswap 的通用授权合约）：token 先一次性授权给 Permit2 合约，之后就能用**签名授权**的方式做 gasless 转账 / 花费，把"签授权、别人代付 gas 上链"的模式推广到任意 ERC-20。x402 的结算方案也可以在这类 rails 上扩展。本课不展开 Permit2，只需记住定位：

```text
EIP-3009 ：稳定币【自带】的 gasless 授权（USDC/EURC 直接可用）—— 本课主线
Permit2  ：给【没有 EIP-3009 的任意 ERC-20】补上 gasless 授权的通用合约 —— 了解即可
```

## 版本核验与边界（务必读）

- **EIP-3009 `transferWithAuthorization` 是 x402 结算的底层**：主流稳定币 **USDC / EURC** 的 gasless 结算走的就是它。付款方签一张 EIP-712 授权（六字段 + 签名），facilitator 拿去调稳定币合约上链，**gas 由 facilitator 付**，付款方零 gas。
- **network 用 CAIP-2**：`eip155:84532` = Base Sepolia（x402 v2 的写法），不是裸 chainId。Base Sepolia USDC = `0x036CbD53842c5426634e7929541eC2318f3dCF7e`。
- **USDC 是 6 位小数**：链上金额用原子单位，`1000` = $0.001，`1_000_000` = $1。别套 18 位小数的心智。
- **facilitator 公共不自建**：MVP 用 `https://x402.org/facilitator`（Base Sepolia + Solana devnet）。Coinbase CDP / RelAI / Stellar 等是生态里的其他 facilitator，条款以各自官方文档当前版本为准。
- **本 lab 是本地教学结构，不上链、不花钱**：`Eip3009Authorization` / `verifyPayment()` 讲透"授权字段 + facilitator 校验哪些东西"，真实的 EIP-712 签名与上链结算在 `paywalled-service/`（真连公共 facilitator）跑。真付一笔需读者自填测试钱包私钥、领测网 USDC（<https://faucet.circle.com>），只用测试网。
- **Permit2 只是了解**：本课主线是 EIP-3009 + USDC；Permit2 是给"没有 EIP-3009 的任意 ERC-20"补 gasless 的通用方案，本课不实现。

## 本模块小结

- x402 的钱靠 **EIP-3009 `transferWithAuthorization`** 真的动：付款方**只签一张离线授权**（EIP-712，零 gas），facilitator 拿去上链兑现、**付 gas**——这就是"gasless"的全部秘密。
- 类比：签一张授权支票，让别人去银行兑现并**垫手续费**；`nonce` 是一次性防伪编号，天然防重放。**签授权 ≠ 转账**，钱在"上链兑现成功"那刻才动。
- 授权六字段：`from`（从哪扣）/ `to`（转给谁，必须 == payTo）/ `value`（多少，原子单位）/ `validAfter`（何时生效）/ `validBefore`（何时过期）/ `nonce`（一次性防重放）。打包成 **EIP-712** 结构化签名，绑定具体合约和链。
- `verifyPayment()` 逐条对齐 requirements：链 / 币 / 收款方 / 金额 / 时间窗 / nonce 防重放，**任一不过就拒绝、先验证再放行**。
- **facilitator = 验证付款 + 上链结算 + 垫 gas**，把结算复杂度从 server 抽走；MVP 用公共 `x402.org/facilitator` 不自建，生态里还有 Coinbase CDP / RelAI / Stellar 等。
- **USDC 6 位小数**：`1000` = $0.001；Base Sepolia USDC = `0x036CbD53842c5426634e7929541eC2318f3dCF7e`；测网币领取 <https://faucet.circle.com>。
- **Permit2** 给没有 EIP-3009 的任意 ERC-20 补 gasless 授权，本课只需了解定位。

## 复习题

1. 用一句话说清：x402 的付款方为什么可以"不持有 ETH、不付 gas"就完成一次 USDC 支付？"签授权"和"上链兑现"这两件事分别由谁做？
2. EIP-3009 授权里的六个字段是哪些？分别各挡住哪一类问题？其中哪一个字段专门用来**防重放**、机制是什么？
3. 为什么授权里的 `to` 必须等于 `requirements.payTo`？如果不校验这一条，会发生什么攻击？在 `verifyPayment()` 里对应哪一行？
4. EIP-712 签名相比"签一串裸十六进制"好在哪？为什么说这个签名"换条链、换个币就对不上"？
5. "签授权"的那一刻，链上的余额变了吗？钱到底在**哪一步**才真的从 `from` 流到 `to`？谁在那一步付了 gas？
6. facilitator 在一次结算里承担了哪两件核心事？为什么 MVP 阶段推荐用公共 facilitator 而不自建？公共测试 facilitator 的地址是什么？
7. USDC 是几位小数？`$0.001` 对应多少个原子单位？如果误用 18 位小数的心智去算金额，会差多少个数量级？
8. `network` 字段为什么写成 `eip155:84532` 而不是 `84532`？这个格式叫什么、两段分别代表什么？
9. Base Sepolia 的 USDC 合约地址是什么？只跑 402 握手 / 本 lab，需不需要钱包和测网币？真正"付一笔"需要准备什么、去哪领测网 USDC？
10. EIP-3009 和 Permit2 分别解决什么、适用范围有什么不同？为什么 USDC 能直接走 EIP-3009，而一个普通 ERC-20 可能要走 Permit2？

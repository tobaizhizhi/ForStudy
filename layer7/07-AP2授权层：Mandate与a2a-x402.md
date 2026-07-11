# 模块 6（轻量）：AP2 授权层 —— Mandate 与 a2a-x402

到这里，小额自动付款已经能跑通了。但有一类动作不能"自动付了就算"：**大额、高风险、或需要人类点头的支付**。这就是 AP2（Agent Payments Protocol）授权层要解决的问题。

> 目标：说清 AP2 的三种 mandate、它和 x402 的分工，并能本地演示"签一个授权、验一个授权"。**本模块是轻量章**——概念 + 本地 P-256 演示为主，不接真实 AP2 SDK。

## 7.1 先讲清楚：x402 能付了，为什么还要 AP2

x402 解决的是"钱怎么真的付出去"。但它不解决一个正交的问题：**这笔钱，谁批准的？**

```text
小额（$0.001 查一次数据）：agent 自己按 session key 策略付了就付了，没问题
大额（$800 买一批算力）  ：agent 被 prompt injection 诱导、或判断失误，就是真实损失
```

对高风险动作，你需要一个**人类（或管理员）签过字的授权凭证**，agent 拿着它才能去结算。这个凭证就是 AP2 的 **mandate**。一句话分工：

- **AP2 = 谁批准了这笔钱**（签名授权，不动钱）
- **x402 = 钱真的付了**（链上结算）

## 7.2 类比：信用卡授权 vs 刷卡

> AP2 mandate 像**信用卡的预授权**（或"老板在报销单上签字"）：它本身不转账，只产出一份"这笔消费被批准了、额度是多少、批给谁"的可验证凭证。x402 才是真正**刷卡扣款**那一下。两者分开：先有签字批准（mandate），再有实际扣款（x402 结算）。

## 7.3 三种 Mandate

AP2 定义了三种 mandate，对应授权链条的不同阶段：

| Mandate | 含义 | 类比 |
| --- | --- | --- |
| **Intent（意图）** | agent 被允许在什么**条件**下购买 | "可以买机票，预算 5000 以内" |
| **Cart（购物车）** | 对**具体项目和价格**的明确授权 | "就买这张 3200 的票" |
| **Payment（付款）** | 分享给支付网络、标示 agent 参与的付款凭证 | 递给收银台的那张签好字的单 |

## 7.4 技术形态：W3C VC + ECDSA P-256

mandate 不是随便一个 JSON——它是 **JSON-LD 的 W3C Verifiable Credential**，用 **ECDSA over P-256（或更强曲线）+ SHA-256** 签名。每条 mandate 带 payload、时间戳、nonce、签名者公钥引用和签名。

这和你 **Layer 6 学的 JWS/JCS 是同一类心智**：用密码学证明"这份授权是本人签的、没被改过"。区别只是曲线（AP2 用 P-256）和封装（W3C VC）。

## 7.5 本地演示：签一个 mandate、验一个 mandate

脚手架 `payment-lab/src/05-ap2-mandate.ts` 用 Node 内置 P-256 演示原理（实测跑通）。先看 `shared.ts` 里的工具：

```ts
/** P-256 (prime256v1) 密钥对，对应 AP2 的 ECDSA over P-256。 */
export function generateP256(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(), privateKey };
}

/** 规范化 mandate（key 排序），作为签名输入——和 Layer 6 的 JCS 同一个心智。 */
export function canonical(m: Mandate): string {
  const keys = Object.keys(m).sort() as (keyof Mandate)[];
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, m[k]])));
}

/** 用户/管理员签一个 mandate（ECDSA P-256 + SHA-256）。 */
export function signMandate(m: Mandate, key: KeyPair): SignedMandate {
  const sig = nodeSign("sha256", Buffer.from(canonical(m)), key.privateKey);
  return { mandate: m, signature: sig.toString("base64"), publicKeyPem: key.publicKeyPem };
}
```

验证时**必须做绑定校验**——mandate 授权的金额/收款方/任务，要和实际结算的一致：

```ts
export function verifyMandate(sm, ctx): Result {
  // 1) 签名对不对（被篡改 / 非该私钥所签 → 挂）
  const valid = nodeVerify("sha256", Buffer.from(canonical(sm.mandate)), pub, sig);
  if (!valid) return { ok: false, reason: "mandate 签名校验不通过" };

  // 2) 公钥可信吗（挡住"攻击者用自己 key 自签"）
  if (ctx.trustedKeys && !ctx.trustedKeys.has(sm.publicKeyPem))
    return { ok: false, reason: "签名公钥不在可信名单（自签 mandate）" };

  // 3) 过期了吗
  if (sm.mandate.expiresAt < ctx.now) return { ok: false, reason: "mandate 已过期" };

  // 4) 绑定校验：授权的金额/收款方/任务 == 实际结算
  if (ctx.expect) {
    for (const [k, v] of Object.entries(ctx.expect))
      if (String(sm.mandate[k]).toLowerCase() !== String(v).toLowerCase())
        return { ok: false, reason: `mandate 与实际结算不符：${k}` };
  }
  return { ok: true };
}
```

## 7.6 高风险审批与拒绝矩阵

`pnpm demo:mandate` 演示阈值触发 + 各种攻击被拒：

```text
场景 A：小额 $0.001 —— 低于高风险阈值 → 自动放行，不需要 mandate
场景 B：大额 $80    —— 超过阈值 → 必须先有签过的 Payment Mandate

✅ 通过 | 实际结算 = 授权（$80 / 同收款方 / 同任务）
⛔ 拒绝 | 有人拿 $80 的 mandate 去结算 $800    （金额挪用）
⛔ 拒绝 | 有人把收款方换成攻击者                （改收款方）
⛔ 拒绝 | mandate 过期后还想用
⛔ 拒绝 | 攻击者用自己的 key 自签 mandate       （公钥不可信）
```

**核心心智：** mandate 必须**绑定** payer / payee / 金额 / 币 / 链 / 任务 / 过期。签名对不代表能用——拿一份 $80 的授权去结算 $800，签名是真的，但绑定校验会拒掉它。

## 7.7 a2a-x402 extension：把授权接到结算

AP2 只授权、不动钱；x402 只结算。把两者接起来的是 **a2a-x402 extension**——它让一个 AP2 mandate 去授权一笔 x402 USDC 结算，给 crypto 支付和刷卡同级的审计链。

- 仓库 `google-a2a/a2a-x402`，由 Google 联合 Coinbase、Ethereum Foundation、MetaMask 开发，**已 production-ready**。
- 流程：高风险动作 → 拿到签过的 AP2 mandate → mandate 授权一笔 x402 结算 → x402 在 Base 上用 USDC 结算 → 授权与结算绑定同一 task/金额/收款方。

## 7.8 诚实边界与一个关键限制

- **本课 AP2 是概念 + 本地 P-256 演示**，不接真实 AP2 SDK。真实 AP2 用 JSON-LD VC，成熟度/文档不如 x402；进入生产前以官方仓库为准。
- **AP2 mandate 绑定到用户，不绑定到 agent**。"这个 agent 是谁、可不可信"是**另一层**的事——那是 Layer 6 的 ERC-8004（或 Visa 的 Trusted Agent Protocol）负责的。别指望 AP2 替你做 agent 身份认证。

## 本模块小结

- AP2 = 谁批准了这笔钱（签名授权，不动钱）；x402 = 钱真的付了（链上结算）。
- 三种 mandate：Intent（条件）/ Cart（具体项目价格）/ Payment（付款凭证）。
- mandate 是 W3C VC，ECDSA P-256 + SHA-256 签名——和 Layer 6 的 JWS/JCS 同一类心智。
- 验证要做**绑定校验**：授权的金额/收款方/任务必须等于实际结算，否则拒绝；还要查公钥可信、未过期。
- a2a-x402 extension（已 production-ready）把 AP2 授权接到 x402 结算。
- 边界：本课 AP2 是本地演示非真实 SDK；AP2 绑定用户不绑定 agent，agent 身份靠 ERC-8004。

## 复习题

1. x402 已经能付钱了，为什么高风险动作还需要 AP2？小额和大额的路径差在哪？
2. 三种 mandate（Intent/Cart/Payment）各授权什么？用信用卡类比说明。
3. mandate 的技术形态是什么？和 Layer 6 的 JWS/JCS 有什么共同心智？
4. `verifyMandate` 做了哪四层校验？为什么"签名对"还不够？
5. 有人拿一份 $80 的 mandate 去结算 $800，签名是真的——为什么会被拒？
6. a2a-x402 extension 把什么和什么接起来？谁开发的、成熟度如何？
7. 为什么说"AP2 绑定用户不绑定 agent"？agent 身份该由哪一层负责？

下一模块（里程碑），我们把授权、结算、状态机、对账串成一个完整的 Paywalled Agent Service。

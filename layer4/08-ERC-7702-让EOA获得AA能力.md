# 模块 7：ERC-7702 —— 让现有 EOA 临时获得智能账户能力

前面我们走的是 ERC-4337：**新建**一个智能账户合约给 agent 用。这一模块讲另一条路 ERC-7702：不新建账户，而是让**你已有的 EOA 地址**临时挂上一份合约代码，从而获得智能账户的能力（批量、代付、受限执行）。

ERC-7702 由 2025 年 5 月的 Pectra 升级引入，到现在（2026 年）已经是主流方案之一，也是 agent 钱包的重要方向。这一模块让你理解它、会用它、知道它和 4337 怎么分工。

> 目标：能说清 7702 在做什么、和 4337 的区别、agent 场景怎么选，以及它的安全坑。

## 7.1 一句话讲清 7702

模块 1 说过 EOA 的天花板：一把私钥 = 全部权限，没有额度、没有白名单、不能批量。7702 的思路很巧：

> 让一个 EOA 通过一份**签名授权**，把自己的“代码”指向一份**智能账户实现合约**。此后这个 EOA 地址在执行时，就跑那份实现的逻辑——它**还是原来的地址、原来的私钥、原来的余额**，但获得了合约账户的能力。

类比：

> 4337 是**新开一张限额子卡**（新地址）。7702 是**给你现有的主卡刷上一层智能芯片**（还是那张卡、那个卡号），让它突然支持“限额、白名单、批量支付”这些新功能。

## 7.2 它在协议层怎么实现

Pectra 引入了一种新交易类型（type `0x04`），里面带一个 **authorization list**。每条授权是 EOA 签名的一个元组：

```text
authorization = 签名({ chainId, address(要委托到的实现合约), nonce })
```

当这笔交易上链，被授权的 EOA 地址的代码字段会被设成一个特殊指针 `0xef0100 || 实现合约地址`（EIP-7702 委托标记）。之后任何对这个 EOA 的调用，都会**委托执行**那份实现合约的代码，但 storage 用的是 EOA 自己的。

关键性质：

- **还是原地址**：不用迁移资产、不用换收款地址。
- **可开可关**：把授权指向 `address(0)` 就能取消委托，变回纯 EOA。
- **私钥仍在**：EOA 的私钥依然能直接签普通交易——这既是便利，也是安全考量点（见 7.5）。

## 7.3 用 viem 发一个 7702 授权（概念示例）

viem 已内置 7702 支持：`signAuthorization` 签授权，`sendTransaction` 带 `authorizationList` 发出。下面是概念示例（需要一份已部署的智能账户实现合约作为委托目标）：

```ts
import { createWalletClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const eoa = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as `0x${string}`);
const walletClient = createWalletClient({ account: eoa, chain: baseSepolia, transport: http() });

// 1) EOA 签一份授权：把自己的代码委托到 SMART_ACCOUNT_IMPL
const authorization = await walletClient.signAuthorization({
  account: eoa,
  contractAddress: SMART_ACCOUNT_IMPL, // 一份实现了批量执行 / 策略的账户实现
});

// 2) 发一笔带 authorizationList 的交易：这一笔里 EOA 就“变成”了智能账户
//    to 指向自己（现在跑的是委托实现的逻辑），data 可以是“批量执行多步”
const hash = await walletClient.sendTransaction({
  authorizationList: [authorization],
  to: eoa.address,
  data: encodeFunctionData({
    abi: smartAccountImplAbi,
    functionName: "executeBatch",
    args: [
      [
        { to: TOKEN, value: 0n, data: approveData },
        { to: ESCROW, value: 0n, data: fundTaskData },
      ],
    ],
  }),
});
```

这一笔交易就做到了 EOA 原本做不到的事：**在一笔里批量执行 approve + fundTask**，而且账户地址、余额都没变。

【学习提示】7702 授权是“对某个实现合约的委托”，所以**你委托到的那份实现合约必须可信、经过审计**——它拿到的是你 EOA 的全部执行权。这点在 7.5 再强调。

## 7.4 7702 + 4337：不是二选一，而是能合起来用

很多现代账户 SDK（ZeroDev、Safe 等）支持一种组合玩法：

```text
用 7702 把用户的 EOA 委托到一个“4337 兼容的账户实现”
  -> EOA 地址此后既能当普通钱包，又能作为 4337 智能账户接收 UserOperation
  -> 于是这个 EOA 也能挂 session key / policy / 走 paymaster
```

也就是说，7702 负责“把现有 EOA 升级成智能账户”，4337 那套 session key / paymaster 生态继续在上面用。两者是互补的。**选 SDK 前确认它当前对二者的支持度**，别为了用新特性牺牲成熟度。

## 7.5 安全坑（务必记住）

7702 很强，但有几个必须警惕的点：

1. **委托目标必须可信**：你把 EOA 的执行权交给了实现合约。委托到恶意 / 有 bug 的实现，等于把钱包交出去。只委托到审计过的实现。
2. **私钥依然有效**：7702 没有“收走”EOA 的私钥。EOA 私钥泄露，攻击者仍可直接签普通交易转走资产——7702 不解决“私钥泄露”。所以给 **agent** 用时，通常还是用 4337 的 session key 模型（agent 拿受限 key，而不是 EOA 主私钥）。
3. **storage 布局冲突**：委托实现用的是 EOA 自己的 storage 槽。如果之前用过别的实现、或实现升级导致布局变化，可能读到脏数据。用规范的账户实现和存储命名空间。
4. **已有 approve 不消失**：EOA 之前授权给各种合约的 allowance 仍然存在，7702 不会清理它们。升级后仍要审视历史授权。
5. **每链单独授权**：授权带 `chainId`；`chainId = 0` 的授权可跨链复用，风险更大，一般指定具体链。

## 7.6 agent 场景：到底选哪个

回到 Layer 4 的主题——给 agent 一把受限钥匙：

```text
从零给 agent 建一个受限钱包，要 session key / policy / paymaster 最成熟的一套
  -> ERC-4337 智能账户（本课程主线）

用户已经有一个 EOA，想让它临时获得批量 / 代付 / 受限能力，不想换地址
  -> ERC-7702（把 EOA 升级成 4337 兼容账户，再挂 session key）
```

对本课程的北极星项目（agent 替智能账户在 escrow 上花钱），**主线仍是 4337**：agent 拿 session key，owner 用 EIP-1271 签 TaskIntent。7702 是当“client 本身是个想复用现有 EOA 的用户”时的升级路径。

## 本模块小结

- 7702 让现有 EOA 通过一份签名授权，把代码委托到一份智能账户实现，从而获得 AA 能力，且地址 / 余额不变、可开可关。
- 协议上是 type `0x04` 交易 + authorization list；viem 用 `signAuthorization` + `authorizationList` 支持。
- 7702 和 4337 互补：可以用 7702 把 EOA 升级成 4337 账户，再用 session key / paymaster。
- 安全坑：委托目标必须可信、私钥仍有效（不解决泄露）、storage 冲突、历史 approve、每链授权。
- agent 受限钱包主线仍用 4337；7702 用于“升级现有 EOA”的场景。

## 复习题

1. 7702 和 4337 在“账户地址”上的最大区别是什么？
2. 7702 授权元组包含哪几项？为什么要带 `chainId`？
3. 用 7702 升级后，EOA 的私钥还有效吗？这对 agent 意味着什么风险？
4. 为什么“委托目标合约必须可信”这条这么关键？
5. 7702 和 4337 怎么组合使用？各负责什么？
6. 给一个纯新建的 agent 受限钱包，你会选哪条路？为什么？
7. 7702 升级后，为什么还要审视 EOA 的历史 approve？

下一模块把所有东西串起来：让一个 agent 用 session key，在权限边界内替智能账户跑通 Layer 2 escrow 的完整任务闭环。

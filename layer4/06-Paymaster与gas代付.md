# 模块 5：Paymaster 与 gas 代付 —— 让授权方无感付费，且不被当水龙头刷

模块 3 里，我们的智能账户一分 ETH 都没有却发成了交易，靠的就是 **Paymaster**。这一模块把“谁付 gas、付得对不对、会不会被滥用”讲清楚。

> 目标：理解 paymaster 的两种主流形态和它的安全边界；能在 Pimlico 里配一条 sponsorship policy，只赞助自己该赞助的操作。

## 5.1 为什么 agent 场景特别需要 paymaster

agent 要自主发交易，如果每个 agent 账户都得先囤 ETH 付 gas，运营会很痛：谁给这些账户充 ETH？充多少？用完了 agent 就卡住。

paymaster 把 gas 从“用户账户”解耦出来：

```text
没有 paymaster：智能账户必须自己有 ETH -> 每个 agent 账户都要囤 gas
有 paymaster：  gas 由一个统一的代付方出 -> agent 账户可以零余额运行
```

对用户 / agent 来说，这就是“无感 gas（gasless）”——他们只管签操作意图，gas 有人兜。

## 5.2 Paymaster 的两种主流形态

### 形态一：Verifying Paymaster（赞助型）

由一个链下服务（如 Pimlico）判断“这笔 op 我要不要赞助”，同意就给一段签名过的赞助数据，填进 `UserOperation.paymasterAndData`。链上 paymaster 合约在验证阶段核对这段签名，认可就替它垫 gas。

这就是模块 3 用的形态。判断逻辑（赞助谁、赞助什么、限额多少）放在链下 policy，灵活。

### 形态二：ERC-20 Paymaster（代币付 gas 型）

账户用 ERC-20（比如 USDC）付 gas，而不是 ETH。paymaster 先垫 ETH gas，`postOp` 阶段按汇率从账户扣等值 USDC。适合“用户只有稳定币、没有 ETH”的场景。

```text
Verifying：别人（项目方）替你付，你不花钱                -> 拉新、agent 运营
ERC-20   ：你用 USDC 付 gas，不需要 ETH                  -> 只持有稳定币的用户 / agent
```

本课程主用 Verifying（Pimlico sponsorship），ERC-20 paymaster 作为了解。

## 5.3 Paymaster 在链上也是两阶段

回忆模块 2：EntryPoint 对每个 op 跑验证 + 执行，paymaster 也嵌在这两阶段里。

```solidity
// 概念示意（真实合约请用官方 / SDK 的实现，别手写）
interface IPaymaster {
    // 验证阶段：我愿不愿意为这笔 op 付 gas？
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    // 执行之后：结算（比如按 context 里的汇率扣 ERC-20）
    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpGasPrice) external;
}
```

【学习提示】`validatePaymasterUserOp` 就是“赞助与否”的决策点。一个安全的赞助型 paymaster 在这里会检查：

- 这笔 op 的 `sender` 是不是我愿意赞助的账户 / 用户？
- 它要调的目标合约、函数在不在我的赞助白名单里？
- 赞助额度 / 频率有没有超？
- 链下签名对不对（防止别人伪造赞助授权）？

## 5.4 安全红线：paymaster 不能为任意 calldata 付 gas

这是 Layer 4 安全验收的硬指标之一，也是最容易被忽视的坑。

如果 paymaster 无脑为**任何** `UserOperation` 付 gas，那它就是一个**免费 gas 水龙头**：任何人都能构造 op 让你的 paymaster 掏钱，几小时就能把你的赞助额度 / 押金刷干。

正确做法是把赞助收窄：

```text
只赞助：
  - 白名单里的智能账户（比如你自己发出的 agent 账户）
  - 白名单里的目标合约（比如只赞助调 escrow 的操作）
  - 白名单里的函数选择器（比如只赞助 createTask / fundTask / completeTask）
  - 单账户 / 单位时间的额度上限
拒绝：
  - 调未知合约
  - 调未知函数
  - 超额度
```

在 Pimlico 里，这通过 **Sponsorship Policy** 配置：

```text
Pimlico dashboard -> Sponsorship Policies -> 新建
  - 选链：Base Sepolia
  - 限制：允许的合约地址 / 每个用户的赞助上限 / 时间窗额度
  - 拿到 policy id，SDK 里带上它，只有命中 policy 的 op 才被赞助
```

带 policy id 的调用（在模块 3 的 `pimlicoClient` 基础上）大致是：

```ts
// 把 sponsorshipPolicyId 传给 paymaster，让赞助只命中你配置的策略
const smartAccountClient = createSmartAccountClient({
  account,
  chain: CHAIN,
  bundlerTransport: http(PIMLICO_URL),
  paymaster: pimlicoClient,
  paymasterContext: { sponsorshipPolicyId: "sp_your_policy_id" },
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
});
```

【学习提示】“前端 / SDK 里选了 policy”不等于安全的全部——真正的赞助决策发生在**链下 paymaster 服务 + 链上 paymaster 合约**。你要在 Pimlico 侧把 policy 配严，而不是指望调用方“自觉只调白名单”。

## 5.5 押金与 stake：paymaster 的钱从哪来

paymaster 要能垫 gas，得先在 EntryPoint 里存押金（deposit），还常需要 stake（质押，供 bundler 信任其验证行为）。

```text
deposit：paymaster 在 EntryPoint 的余额，实际用来垫 gas，会被消耗，要及时补。
stake  ：一笔时间锁定的质押，让 bundler 愿意接受这个 paymaster 的 op（信誉/反女巫）。
```

用托管服务（Pimlico）时，这些由服务方管理，你只需保证账户 / 项目的赞助额度够用。自建 paymaster 才需要自己管 deposit / stake。**agent 运营时要监控押金余额**——押金耗尽，agent 的交易就会因“没人付 gas”而卡住（见模块 9 的故障恢复）。

## 5.6 和 session key 的关系：两道正交的闸

别把 paymaster 和 session key 搞混，它们管的是不同的事：

```text
session key policy：agent 能不能做这件事？（作用域 / 额度 / 过期）—— 保护你的资产
paymaster policy  ：这件事的 gas 我要不要出？（赞助白名单 / 额度）—— 保护你的 gas 预算
```

两道闸都要配严：session key 防的是“agent 乱花你的钱”，paymaster 防的是“别人乱花你的 gas”。一笔 agent 操作要成功，得**同时**过这两关。

## 常见问题

#### `AA31 paymaster deposit too low`

paymaster 在 EntryPoint 的押金不够。托管服务上通常是赞助额度用完，去 dashboard 充值 / 提额。

#### `AA33 reverted` / paymaster 拒绝

op 没命中 sponsorship policy（调了未白名单的合约 / 函数，或超额度）。检查 policy 配置和这笔 op 的目标。

#### 明明配了 paymaster，还是从账户扣了 ETH

可能没正确传 `paymaster` / `paymasterContext`，SDK 退回“账户自付”。确认 `createSmartAccountClient` 里 `paymaster` 传了、policy id 对。

#### 赞助额度莫名被刷光

大概率是赞助 policy 配得太宽（赞助了任意合约 / 任意用户）。收窄到白名单合约 + 单用户额度。

## 验收

- 能说清 Verifying paymaster 和 ERC-20 paymaster 的区别与适用场景。
- Pimlico 里配了一条 sponsorship policy，只赞助白名单合约 / 函数。
- 能演示：调白名单合约的 op 被赞助成功，调白名单外合约的 op 赞助被拒。
- 理解 paymaster 的 deposit / stake，知道押金耗尽会让 agent 卡住。
- 能说清 session key policy 和 paymaster policy 是两道正交的闸。

## 复习题

1. agent 场景为什么特别需要 paymaster？
2. Verifying paymaster 和 ERC-20 paymaster 分别怎么付 gas？各适合谁？
3. paymaster 的 `validatePaymasterUserOp` 和 `postOp` 各做什么？
4. 为什么“为任意 calldata 付 gas”是安全红线？会被怎么滥用？
5. 一个安全的赞助 paymaster 在验证阶段应该检查哪些东西？
6. deposit 和 stake 有什么区别？押金耗尽会发生什么？
7. session key policy 和 paymaster policy 分别保护什么？为什么说它们正交？
8. “SDK 里选了 policy”能否等同于“赞助是安全的”？真正的决策在哪一层？

下一模块是**选修**：我们亲手写一个最小智能账户 + session key 策略模块 + EIP-1271，把前面 SDK 底下强制的东西，用 Solidity 完整看一遍（这也是本仓库 `layer4/contracts` 已经跑通的 22 个测试）。

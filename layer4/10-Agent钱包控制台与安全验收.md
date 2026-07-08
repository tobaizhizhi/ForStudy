# 模块 9：Agent 钱包控制台与安全验收

最后一块，把前面所有能力做成一个**人类能看见、能操作、能兜底**的 Agent 钱包控制台，并给出完整的安全验收清单。这层的价值不是“跑一次 SDK demo”，而是把“谁能做什么、能做多久、最多花多少”变成一个可编程、可撤销、可审计的控制面。

> 目标：交付 Agent 钱包控制台里程碑；能对每一类故障给出可读处理；通过安全验收清单。

## 9.1 账户可视化：让权限“看得见”

agent 自主花钱最怕“黑箱”——人不知道 agent 现在有哪些权限、花了多少。控制台首先要把这些晒出来。它在 Layer 3 控制台基础上加一块 **Agent 钱包面板**，至少展示：

```text
Smart Account
  地址 / owner / 是否已部署 / 账户 token 余额 / paymaster 赞助状态

Session Keys（列表，每把 key）
  key 地址
  作用域：允许的目标合约 / 允许的函数
  额度：单笔上限 / 每日上限 / 今日已花
  时间：生效时间 / 过期时间 / 剩余有效期
  状态：active / expired / revoked
  操作：撤销 / 轮换

Recent Actions
  agent 最近发起的 UserOperation：动作 / 目标 / 金额 / 状态 / tx / 时间
```

用 wagmi 读账户策略（复用模块 6 合约的只读函数）：

```tsx
// 读一把 session key 的策略（Layer 3 的 useReadContract 心智）
import { useReadContract } from "wagmi";
import { agentSmartAccountAbi } from "@/abi/agentSmartAccount";

export function useSessionKey(account: `0x${string}`, key?: `0x${string}`) {
  return useReadContract({
    address: account,
    abi: agentSmartAccountAbi,
    functionName: "sessionKey",
    args: key ? [key] : undefined,
    query: { enabled: Boolean(account && key), staleTime: 5_000 },
  });
}
```

面板展示时把 `perCallCap` / `dailyCap` 按 token decimals 格式化、`validUntil` 转本地时间、`revoked` / 过期用醒目状态色——和 Layer 3 处理 bigint / 时间戳 / 状态枚举的做法完全一致。

## 9.2 权限生命周期的操作面

控制台要让人类能一键完成生命周期动作（都是对智能账户的交易，owner 签）：

| 操作 | 调用 | 什么时候用 |
| --- | --- | --- |
| 创建 | `registerSessionKey` + `setSessionKeyTarget/Selector/Erc20Cap` | 给 agent 开一把新钥匙 |
| 轮换 | 新 `registerSessionKey` + 旧 `revokeSessionKey` | 定期轮换 / 怀疑泄露 |
| 暂停 | `revokeSessionKey`（临时） | 观察到异常，先停 |
| 撤销 | `revokeSessionKey` | 任务结束 / 收回权限 |

每个动作前，沿用 Layer 3 的“确认摘要”习惯：清楚展示“你正在给这把 key 什么权限 / 收回什么权限”，再弹钱包。

## 9.3 执行链路的状态要全程可见

一笔 agent 操作从意图到上链，中间有多层可能失败。控制台要把状态摊开，别只给一个 spinner：

```text
idle
building userOp
  simulating（本地策略闸门 + 模拟）
  waiting paymaster（赞助中）
  waiting signature（session key 签名）
userOp submitted（进 bundler）
userOp pending（等打包上链）
confirmed（EntryPoint UserOperationEvent）
failed（分清是哪一层）
```

失败要能定位到层：

```text
验证层失败 -> 签名无效 / 策略拦截 / 押金不足（op 没被执行）
执行层失败 -> 业务合约 revert（execute 里的调用挂了）
paymaster  -> 拒绝赞助 / 押金不足
bundler    -> 限流 / gas 估计问题
```

## 9.4 故障恢复：出问题时怎么降级

agent 要长期无人值守跑，故障恢复是硬需求。常见故障和降级策略：

| 故障 | 现象 / 原因 | 降级策略 |
| --- | --- | --- |
| paymaster 拒付 | 未命中 sponsorship policy / 押金耗尽 | 提示充值或收窄 policy；临时切回账户自付 ETH；暂停 agent |
| session key 过期 | `validUntil` 已过 | 停止自动执行，请求 owner 轮换新 key |
| 权限不足 | 目标 / 函数 / 额度越界被拦 | 明确告诉人“agent 想做 X 但超出授权”，请求人工确认或调整 policy |
| nonce 冲突 | 并发 op / 2D nonce 处理不当 | 重取 nonce 重发；串行化关键操作 |
| 链不匹配 | 钱包 / 配置不在 Base Sepolia | 禁用所有写操作，提示切链（Layer 3 已有心智） |
| bundler 限流 | 请求过频 / 免费额度不足 | 退避重试；换自带 key 的 endpoint |
| 疑似被注入 | agent 行为异常 | **立刻 revoke session key**，转人工排查 |

核心原则：**任何高风险或超出授权的动作，都能降级到“请求人类确认”，而不是硬闯或静默失败。**

## 9.5 安全验收清单（本层硬指标）

对照路线图，这些必须逐条能验证、能演示：

- [ ] session key 的**作用域**（目标 / 函数）可见、可测：调白名单外的合约 / 函数会被链上拒。
- [ ] session key 的**额度**（单笔 / 每日）可见、可测：超额的 op 被判无效。
- [ ] session key 的**过期时间**可见、可测：过期后不能再用。
- [ ] session key 的**撤销状态**可见、可测：revoke 后旧 key 立刻失能。
- [ ] paymaster **不为任意 calldata / 未知目标合约付 gas**：调白名单外合约的 op 赞助被拒。
- [ ] 提交前校验 **chain ID、目标合约、调用函数**。
- [ ] 撤销后**旧 key 不能继续用**（链上强制，不只是前端置灰）。
- [ ] 所有高风险动作都能**回到人工确认**。
- [ ] 前端 / 配置里**没有**私钥、助记词、后端 secret、无限制的高权限 RPC / paymaster key。
- [ ] 智能账户能作为 escrow 的 client，通过 **EIP-1271** 完成 `completeTask` 闭环。

其中前四条“作用域 / 额度 / 过期 / 撤销”，在 `layer4/contracts` 的 22 个 Foundry 测试里已经逐条覆盖——这是链上强制的证据，不是口头承诺。

## 9.6 最小测试策略

| 层级 | 覆盖对象 | 工具 |
| --- | --- | --- |
| 合约单元/集成 | `validateUserOp` 各策略维度、EIP-1271、撤销、过期、日额度 | Foundry（已 22 个测试） |
| TS 纯函数 | 策略闸门 `policyGate`、金额格式化、错误分类 | Vitest |
| 脚本 / E2E 手工 | 建号、赞助交易、session key 注册 / 撤销、escrow 闭环 | 手工清单 + BaseScan 核对 |

合约层是重点，因为“权限边界”最终靠它强制。TS 纯函数其次。真实链路（bundler / paymaster / 钱包弹窗）先手工验收，稳定后再补自动化。

## 9.7 里程碑：Agent 钱包控制台

完成 Layer 4 时，你应该交付一个能跑的控制台：

```text
创建 / 导入 smart account
  -> 生成一把受限 session key（作用域 / 额度 / 过期）
  -> 模拟一笔受限操作（本地闸门 + simulate）
  -> 通过 bundler + paymaster 发送 UserOperation（gas 被赞助）
  -> 等待回执、展示 UserOperationEvent
  -> 展示 agent 最近动作、剩余额度
  -> 一键撤销 / 轮换 session key
  -> 接回 escrow：agent 跑 createTask/fundTask，client 用 EIP-1271 完成任务
```

推荐验收命令：

```bash
# 合约（选修核心，链上强制的证据）
cd /home/lenovo/solidity-course/ata/layer4/contracts
forge test -vv

# SDK 脚本
cd /home/lenovo/solidity-course/ata/layer4/agent-wallet
pnpm install
pnpm typecheck
pnpm create-account      # 建号 + 首个赞助交易
pnpm session-key         # owner 发受限 session key（需先部署 AgentSmartAccount）
pnpm run-task            # 智能账户在 escrow 上跑任务
pnpm agent               # 本地演示 agent 决策 + 策略闸门
```

手工验收：

1. 智能账户零 ETH 也能发交易（gas 被赞助）。
2. agent 用 session key 只能调白名单合约 / 函数，越界被链上拒。
3. 超单笔 / 每日额度的操作被拒。
4. 过期后 session key 不能用。
5. owner revoke 后，旧 key 立刻失能。
6. paymaster 只赞助白名单操作，调未知合约赞助被拒。
7. 智能账户作为 client，通过 EIP-1271 完成 escrow `completeTask`。
8. 控制台能看到每把 key 的作用域 / 额度 / 过期 / 状态，以及 agent 最近动作。

## 本模块小结

- 控制台把“agent 现在有哪些权限、花了多少、还剩多少”晒出来，让自主花钱不再是黑箱。
- 权限生命周期（创建 / 轮换 / 暂停 / 撤销）都有明确操作面，动作前有确认摘要。
- 执行链路状态全程可见，失败能定位到验证 / 执行 / paymaster / bundler 哪一层。
- 故障恢复的核心原则：高风险或越权动作能降级到人工确认，疑似被注入先 revoke。
- 安全验收十条硬指标，前四条已由 Foundry 测试逐条强制。
- 交付里程碑：一个能建号、发受限赞助交易、管理 session key、接回 escrow 闭环、可撤销的 Agent 钱包控制台。

## 复习题

1. 控制台为什么必须把 session key 的作用域 / 额度 / 过期 / 状态“晒”出来？
2. 一笔 agent 操作失败，怎么区分是验证层、执行层、paymaster 还是 bundler 的问题？
3. paymaster 押金耗尽时，控制台应该怎么降级？
4. session key 过期 / 权限不足时，正确的降级动作是什么？
5. 怀疑 agent 被 prompt injection，第一反应是什么？为什么 revoke 能兜底？
6. 安全验收里“撤销后旧 key 不能继续用”，为什么必须链上强制而不能只前端置灰？
7. 为什么说 Foundry 的 22 个测试是“权限边界的证据”？
8. 里程碑控制台至少要能完成哪几个动作？

恭喜，Layer 4 到此完成。继续看 `总结与复习.md` 做一次全层回顾，再往后就是把这套“受限自主花钱”的能力接到 x402 / AP2 支付授权和 A2A 协作上。

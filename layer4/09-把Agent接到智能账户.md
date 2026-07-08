# 模块 8：把 Agent 接到智能账户 —— 跑通受限自主的任务闭环

前面我们分别有了：会决策的 agent（chapter7 的 LangGraph）、受限的 session key（模块 4）、能赞助的 paymaster（模块 5）、能验合约签名的 EIP-1271 账户（模块 6）。这一模块把它们**串成一个闭环**：让 agent 用一把受限钥匙，替智能账户在 Layer 2 escrow 上跑完一整个任务，人类只在关键处兜底。

> 目标：跑通 “agent 决策 → 策略闸门 → 智能账户发赞助 UserOperation → escrow 任务 → EIP-1271 签 TaskIntent → completeTask” 的完整链路，并能一键 revoke 让 agent 失能。

## 8.1 先分清三个角色

这条链路里有三个身份，别混：

| 角色 | 是谁 | 拿什么 | 干什么 |
| --- | --- | --- | --- |
| **owner（人类）** | 你 | 智能账户主私钥 | 发 / 撤销 session key，兜底高风险动作 |
| **agent** | AI 编排器 | 一把受限 **session key** | 决策，并用 session key 让账户发交易 |
| **client** | **智能账户合约** | 无私钥，用 EIP-1271 | escrow 里任务的委托方，付款方 |
| **operator** | 执行服务方 | 自己的 key | 拿到 client 授权后提交 `completeTask`，收款 |

注意一个反直觉但关键的点：**agent 不是 client，智能账户才是 client**。agent 只是“持有 session key、替这个智能账户干活”的手。owner 是账户的 root，agent 是被授权的受限执行者。

## 8.2 完整闭环

```text
① owner 给 agent 发 session key（作用域=escrow/token，选择器=createTask/approve/fundTask，额度、7 天过期）
        │
② agent（大脑，LangGraph）决策：要委托一次调研任务，预算 5 USDC
        │  每个花钱动作前，先过本地策略闸门（第一道）
        ▼
③ agent 用 session key 让智能账户发赞助 UserOperation：
        createTask(operator, token, 5, "research", +7d)
        approve(escrow, 5)         ← 链上账户 validateUserOp 再强制一次策略（第二道）
        fundTask(taskId)           ← gas 由 paymaster 出
        │
④ client（智能账户）用 EIP-1271 签 TaskIntent（授权 operator 完成任务）
        │
⑤ operator 提交 completeTask(intent, signature, resultURI)
        escrow 通过 SignatureChecker 验 client 的合约签名（EIP-1271）
        任务变 Completed，5 USDC 转给 operator，nonce 消耗
        │
⑥ owner 随时 revoke(session key) → agent 立刻无法再动这个账户
```

两道策略闸门是重点：**本地闸门**（agent 代码里，快速失败、省 gas）和**链上闸门**（账户 `validateUserOp`，最终强制、不可绕过）。即使 agent 被 prompt injection 骗过了本地闸门，链上闸门仍会把越界的 op 判为签名无效。

## 8.3 大脑与手：LangGraph 决策 + 钱包执行

一个清晰的分工：

- **大脑**：chapter7 那套 LangGraph 多智能体 / 状态图，负责“决定做什么”。
- **手**：Layer 4 的 `agent-wallet` TS 脚本，负责“把决定变成受限的赞助交易”。

两者通过“一个受策略约束的钱包工具”连接。在 LangGraph 里，这就是给 agent 挂的一个 tool（chapter7 的风格）：

```python
# chapter7 风格：给决策 agent 挂一个“受限钱包工具”
from langgraph.graph import StateGraph, START, END
from typing import TypedDict, Optional

class WalletState(TypedDict):
    goal: str
    task_id: Optional[int]
    spent_today: float
    stage: str

# 这个工具内部会：先过策略闸门，再调用 agent-wallet 的执行（发赞助 UserOperation）
def spend_within_policy(action: str, target: str, amount: float) -> dict:
    # 1) 本地策略闸门（作用域 / 单笔 / 每日 / 过期）——和链上策略对齐
    if not policy_ok(action, target, amount):
        return {"ok": False, "reason": "被 session key 策略拦截"}
    # 2) 交给“手”执行：这里对接 agent-wallet 的 runEscrowTask 逻辑
    #    真实实现里可以是子进程调用、HTTP、或直接 TS 侧的等价函数
    return call_agent_wallet(action, target, amount)

def create_node(state: WalletState):
    res = spend_within_policy("createTask", "escrow", 5)
    return {"stage": "fund" if res["ok"] else "blocked", "task_id": res.get("task_id")}
```

【学习提示】关键不是用哪种语言把大脑和手连起来（子进程、HTTP、同进程都行），而是**每个花钱节点前都有策略闸门，且链上还有第二道**。agent 的“自主”永远被框在 session key 的边界里。

`agent-wallet/src/agent.ts` 就是一个纯本地、可直接跑的 LangGraph 风格编排器，把这个心智落成了 TS 状态机（`pnpm agent` 可运行）：

```ts
// 每个花钱节点前过策略闸门；链上账户 validateUserOp 还会再强制一次
function policyGate(state, action, target, amount) {
  if (Date.now() > POLICY.expiresAt) return { ok: false, reason: "session key 已过期" };
  if (!POLICY.allowedTargets.has(target)) return { ok: false, reason: `目标不在白名单: ${target}` };
  if (!POLICY.allowedActions.has(action)) return { ok: false, reason: `动作不在白名单: ${action}` };
  if (amount > POLICY.perCallCap) return { ok: false, reason: "超单笔额度" };
  if (state.spentToday + amount > POLICY.dailyCap) return { ok: false, reason: "超每日额度" };
  return { ok: true };
}
```

## 8.4 手的真实执行：智能账户在 escrow 上花钱

`agent-wallet/src/runEscrowTask.ts` 演示“手”怎么把决策变成三笔赞助 UserOperation（节选）：

```ts
const { account, smartAccountClient } = await buildSmartAccountClient(OWNER_PRIVATE_KEY);

// 1) createTask —— 赞助的 UserOp
const createHash = await smartAccountClient.sendTransaction({
  to: ESCROW_ADDRESS,
  data: encodeFunctionData({
    abi: escrowAbi, functionName: "createTask",
    args: [operator, TOKEN_ADDRESS, amount, "layer4-demo", refundAfter],
  }),
});
await publicClient.waitForTransactionReceipt({ hash: createHash });

// 2) approve escrow 花账户里的 token
const approveHash = await smartAccountClient.sendTransaction({
  to: TOKEN_ADDRESS,
  data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ESCROW_ADDRESS, amount] }),
});
await publicClient.waitForTransactionReceipt({ hash: approveHash });

// 3) fundTask —— 把 token 打进 escrow
const fundHash = await smartAccountClient.sendTransaction({
  to: ESCROW_ADDRESS,
  data: encodeFunctionData({ abi: escrowAbi, functionName: "fundTask", args: [taskId] }),
});
await publicClient.waitForTransactionReceipt({ hash: fundHash });
```

这里的 `smartAccountClient` 用的是模块 3 的 SimpleAccount + Pimlico。如果要让**链上 session key 策略**生效，就把它换成模块 6 部署的 `AgentSmartAccount`，并用 agent 的 session key 签名——那时 `validateUserOp` 会对每一笔做作用域 / 额度检查，越界直接被判无效。运行：

```bash
pnpm run-task
```

> 说明：`createTask` 的返回值（taskId）在真实交易里拿不到，脚本用读 `taskCount` 近似取最新 taskId（demo 简化）。生产应解析 `TaskCreated` 事件（见 Layer 3 模块 8）。

## 8.5 闭环那一刀：让 escrow 接受“智能账户当 client”

这是 Layer 3 特意留到 Layer 4 的尾巴。回看 Layer 2：

```solidity
// AgentTaskEscrowWithPermit.completeTask 里的验签（只认 EOA）
address signer = ECDSA.recover(hashIntent(intent), signature);
if (signer != intent.client) revert InvalidSigner();
```

`ECDSA.recover` 只能验 EOA 签名。当 client 是**智能账户**（合约，没有私钥）时，这行会失败。要支持它，得换成 OpenZeppelin 的 `SignatureChecker`，它对 EOA 走 `ecrecover`、对合约走 **EIP-1271**：

```solidity
import {SignatureChecker} from "openzeppelin-contracts/contracts/utils/cryptography/SignatureChecker.sol";

// 同时支持 EOA client 和智能账户 client
if (!SignatureChecker.isValidSignatureNow(intent.client, hashIntent(intent), signature)) {
    revert InvalidSigner();
}
```

这正是 Layer 2 `TaskIntentVerifier1271` 已经用的写法。改完后：

- client 是智能账户时，`isValidSignatureNow` 会调账户的 `isValidSignature`（模块 6 实现的 EIP-1271），由账户回答“这份签名对我有效吗”。
- client 是 EOA 时，行为和以前一致。

owner 对 `TaskIntent` 的 EIP-712 摘要签名（`signTypedData`），escrow 通过账户的 EIP-1271 验通过，`completeTask` 成功，token 转给 operator。**至此，Layer 2 合约 + Layer 3 控制台 + Layer 4 账户抽象的闭环真正合上。**

【学习提示】签 `TaskIntent` 的是 **owner 代表智能账户**（root 权限），不是 agent 的 session key。agent 的 session key 用来做 createTask / fundTask 这些**受限花钱**动作；“授权任务完成”这种关键动作可以要求 owner 亲签，或给 session key 单独开一个允许 EIP-1271 代签的权限（模块 6 的扩展练习）。**把“花小钱”和“授权关键动作”分权，是安全设计的好习惯。**

## 8.6 一键 revoke：agent 的紧急刹车

整条链路里，owner 始终握着刹车：

```ts
await ownerWallet.sendTransaction({
  to: AGENT_SMART_ACCOUNT_ADDRESS,
  data: encodeFunctionData({ abi: agentSmartAccountAbi, functionName: "revokeSessionKey", args: [agent.address] }),
});
```

撤销后，agent 用这把 key 再签任何 op，账户 `validateUserOp` 都判签名无效。**这是应对“agent 行为异常 / 疑似被注入”的第一反应：先 revoke，再排查。**

## 8.7 把它接回 Layer 3 控制台

Layer 3 的控制台已经能读 escrow、签 EIP-712、发交易、看事件。Layer 4 在它上面加一块 **Agent 钱包面板**（模块 9 详述）：展示智能账户地址、owner、session key 列表与额度 / 过期、paymaster 赞助状态、agent 最近动作，以及 revoke / rotate 按钮。这样人类能实时看见“agent 现在有哪些权限、花了多少、还剩多少”。

## 本模块小结

- 三角色：owner（root，人）、agent（持 session key 的手）、client（智能账户，付款方）、operator（执行方，收款）。agent ≠ client。
- 闭环：owner 发 key → agent 决策 → 过本地闸门 → 智能账户发赞助 UserOp 跑 escrow → client 用 EIP-1271 签 TaskIntent → operator completeTask → owner 可随时 revoke。
- 两道策略闸门：本地（快、省 gas）+ 链上（`validateUserOp`，不可绕过）。
- 大脑（LangGraph）与手（agent-wallet）通过“受策略约束的钱包工具”连接。
- 闭环那一刀：escrow 把 `ECDSA.recover` 换成 `SignatureChecker`，才能接受智能账户当 client。
- 分权：花小钱用 session key，授权关键动作让 owner 亲签。
- revoke 是紧急刹车。

## 复习题

1. 这条链路里 client 是 agent 还是智能账户？agent 扮演什么角色？
2. “两道策略闸门”分别在哪、各自作用是什么？为什么本地闸门挡不住的，链上还能挡？
3. 为什么现有的 `AgentTaskEscrowWithPermit.completeTask` 不能直接接受智能账户当 client？
4. 把 `ECDSA.recover` 换成 `SignatureChecker.isValidSignatureNow` 之后，EOA client 还能用吗？
5. 签 `TaskIntent` 的应该是 owner 还是 agent 的 session key？为什么建议这样分权？
6. agent 疑似被 prompt injection 时，owner 的第一反应应该是什么？
7. `createTask` 的 taskId 在真实交易里为什么拿不到？该怎么正确获取？
8. 大脑和手为什么可以用不同语言 / 进程实现，关键约束是什么？

下一模块（本层最后一块）把这一切做成一个可视、可操作、可验收的 **Agent 钱包控制台**，并给出完整的安全验收清单。

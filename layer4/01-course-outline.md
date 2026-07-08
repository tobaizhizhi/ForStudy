# Layer 4 课程大纲 — 账户抽象 & Agent 钱包

目标：把 Layer 3 里“每一步都由人手动点确认”的操作台，升级成“给 agent 一把受限的钥匙，让它在权限边界内自己动手，人只在关键处兜底”的 Agent 钱包。

这一层是整条 Web3-Agent 路线里最关键的新增能力。前面几层已经铺好了地基：

- Layer 1 / Layer 2：Solidity、EIP-712 结构化签名、**EIP-1271 智能账户验签**、ERC-20 / permit、访问控制、`AgentTaskEscrowWithPermit`。
- Layer 3：viem + wagmi 前端，把连接钱包、读链、签名、发交易、看事件做成一个人类能复核的控制台。Layer 3 特意把 EIP-1271 智能账户验签**留到了本层**。

Layer 4 要回答一个很具体的问题：

```text
agent 要自主花钱，私钥放哪、权限多大、能花多久、最多花多少？
```

答案不是“给 agent 一把主钱包私钥”——那等于把银行卡和密码一起交出去，一旦 prompt injection 得手就是资金清零。答案是**账户抽象**：把“谁能做什么、能做多久、最多花多少”变成可编程、可撤销、可审计的一层。

## 一句话讲清这一层

```text
Layer 3：人连接钱包、签名、发交易、看事件
Layer 4：智能账户 + session key + policy + paymaster，让 agent 在权限边界内执行
```

## 学习原则

- **不给 agent 主私钥**：agent 只拿受限 session key（有作用域、有额度、会过期、可撤销），主控制权始终在人类 owner 手里。
- **权限写进链上，别只靠前端拦**：额度、目标合约、过期时间要在账户 / 策略合约里强制，前端校验只是第一道闸，不是唯一一道。
- **优先用成熟 SDK，不手写底层**：`UserOperation` 组装、EntryPoint 交互、bundler、paymaster 一律用 SDK（本课程用 permissionless.js + Pimlico）。自己写的只有“业务账户逻辑 / 策略模块”这一层，且作为选修，用来看懂 SDK 底下在强制什么。
- **先模拟再上链**：任何花钱动作，先本地过策略闸门 + `simulate`，再发真实 UserOperation。
- **最小权限对冲 prompt injection**：即使 agent 被诱导，也只能在 session key 的作用域和额度内造成有限损失。
- **高风险动作能回到人工**：撤销、超额、换目标合约、换链，都要能降级到人类确认。

## 推荐技术栈

| 关注点 | 推荐工具 | 用来做什么 | 不要做什么 |
| --- | --- | --- | --- |
| 智能账户 SDK | permissionless.js（基于 viem） | 反事实推导账户地址、组装并发送 UserOperation | 不手写 `UserOperation` / 不手算 userOpHash |
| bundler + paymaster | Pimlico | 打包上链、赞助 gas、查 gas price | 不自建 bundler / 不手写 paymaster 交互 |
| 链交互 / 签名 | viem | 读链、`encodeFunctionData`、EIP-712、EIP-7702 授权 | 不手写 JSON-RPC |
| 账户 / 策略合约（选修） | Foundry + OpenZeppelin | 看懂 `validateUserOp`、session key policy、EIP-1271 | 生产别自己抄 EntryPoint / BaseAccount |
| 会话密钥体验（对照） | ZeroDev / Kernel、Rhinestone modules | 生产级 session key / policy 模块 | 不为了尝鲜牺牲成熟度 |
| 前端 | 复用 Layer 3 的 Next.js + wagmi | 账户可视化、session key 管理、赞助状态 | 不把权限判断只放前端 |
| 合约源 | Layer 2 escrow + 本层账户 | createTask / fundTask / completeTask / EIP-1271 | 不复制不明来源 ABI |

> 7702 还是 4337？本项目 agent 钱包**优先用 ERC-4337 智能账户**——session key / policy / paymaster 生态最成熟，最契合“受限自主花钱”。ERC-7702 更适合“让用户现有 EOA 临时获得 AA 能力”，作为进阶补充（模块 8），不作为起点。两者正在融合演进，选 SDK 前先确认它当前对二者各自的支持程度。

## 里程碑项目：Agent 钱包控制台

在 Layer 3 控制台的基础上，做出一个 **Agent 钱包控制台**：

```text
创建 / 导入 smart account
  -> 生成一把受限 session key
  -> 设置额度 / 过期 / 目标合约 / 目标函数
  -> 模拟一笔受限操作
  -> 通过 bundler + paymaster 发送 UserOperation
  -> 等待回执、展示事件
  -> 一键撤销或轮换 session key
```

并把它接回北极星业务：agent 用这把受限钥匙，替“智能账户 client”在 Layer 2 escrow 上跑 `createTask -> approve -> fundTask`；client（合约账户）用 **EIP-1271** 签 `TaskIntent`，operator 提交 `completeTask`。这样就把 Layer 2 的合约、Layer 3 的控制台、Layer 4 的账户抽象串成一个闭环。

## 本层目录

课程大纲先定义学习顺序；真正写代码时，`layer4/` 里已经放好两套可运行脚手架：

```text
layer4/
  01-course-outline.md            本文件
  02-账户抽象导论.md               模块 1：为什么 agent 需要 AA
  03-ERC-4337架构详解.md           模块 2：UserOperation 生命周期
  04-用SDK创建智能账户.md          模块 3：permissionless.js + Pimlico 建号 + 首个赞助交易
  05-会话密钥与权限策略.md         模块 4：session key + policy（本层核心）
  06-Paymaster与gas代付.md         模块 5：gas 赞助与安全边界
  07-最小智能账户合约(选修).md      模块 6（选修）：手写账户 + 策略模块 + EIP-1271
  08-ERC-7702-让EOA获得AA能力.md   模块 7：让现有 EOA 临时获得 AA 能力
  09-把Agent接到智能账户.md        模块 8：agent + session key 跑通 escrow 闭环
  10-Agent钱包控制台与安全验收.md   模块 9：前端控制面 + 故障恢复 + 安全验收
  总结与复习.md                    分模块回顾 + 复习题

  contracts/                      选修模块的 Foundry 工程（可 forge test）
    src/AgentSmartAccount.sol      最小 ERC-4337 账户 + EIP-1271
    src/SessionKeyPolicy.sol       session key + 权限策略模块
    test/                          22 个测试，覆盖各策略维度
    script/DeployAgentSmartAccount.s.sol

  agent-wallet/                   SDK 主线的 TS 脚本（permissionless.js + Pimlico）
    src/config.ts                  链 / Pimlico / 合约配置
    src/smartAccount.ts            构造智能账户客户端
    src/createAccount.ts           建号 + 首个赞助交易
    src/runEscrowTask.ts           智能账户跑 escrow createTask/approve/fundTask
    src/sessionKey.ts              owner 给 agent 发 / 撤销受限 session key
    src/agent.ts                   LangGraph 风格编排器（本地演示决策 + 策略闸门）
```

## 模块地图

| 模块 | 主题 | 产出 |
| --- | --- | --- |
| 1 | 账户抽象导论 | 能说清 EOA vs 智能账户、为什么 agent 必须用 AA、4337 vs 7702 怎么选 |
| 2 | ERC-4337 架构 | 能画出 `UserOperation -> Bundler -> EntryPoint -> Account/Paymaster` 全链路 |
| 3 | 用 SDK 创建智能账户 | 用 permissionless.js + Pimlico 建号，发出第一笔 gas 被赞助的交易 |
| 4 | 会话密钥与权限策略 | 给 agent 一把“只能调某合约、单笔≤X、每日≤Y、N 天过期”的 key，并能撤销 / 轮换 |
| 5 | Paymaster 与 gas 代付 | 让授权方无感付 gas，且 paymaster 不为任意 calldata / 未知合约付费 |
| 6（选修） | 最小智能账户合约 | 手写 `validateUserOp` + session policy + `isValidSignature`，看懂链上到底怎么拦 |
| 7 | ERC-7702 | 让用户现有 EOA 临时获得 AA 能力，理解它和 4337 的分工 |
| 8 | 把 agent 接到智能账户 | agent + session key 在 policy 内跑通 escrow；smart-account-as-client 用 EIP-1271 签 TaskIntent |
| 9 | 控制台与安全验收 | 账户可视化、故障恢复、安全清单，交付 Agent 钱包控制台 |

## 安全验收（贯穿全层）

- session key 的**作用域、额度、过期时间、撤销状态**都要可见、可测。
- paymaster **不能为任意 calldata 或未知目标合约付 gas**。
- 提交前校验 **chain ID、目标合约、调用函数**。
- 撤销后**旧 key 不能继续用**。
- 所有高风险动作都能**回到人工确认**。
- 前端不含私钥、助记词、后端 secret、无限制的高权限 RPC / paymaster key。

## 前置条件

- 已完成 Layer 2（`AgentTaskEscrowWithPermit`、EIP-712、EIP-1271）和 Layer 3（钱包连接、读写链、EIP-712 签名、事件流）。
- 一个只放测试网资产的钱包，Base Sepolia 上有少量 ETH。
- 一个 [Pimlico](https://dashboard.pimlico.io) 账号和 API key（做了额度 / 域名限制）。
- 本机装好 Foundry（`forge`）、Node 20+、pnpm。

## 下一步怎么接

Layer 4 交付后，agent 已经有了“受限的手”。后面的层会在此之上加：

```text
Layer 4：受限 session key + policy + paymaster（能自主花，但花得住手）
后续  ：x402 / AP2 支付授权、A2A 协作、可观测与安全加固
```

高金额、高风险动作再引入 AP2 mandate 之类的人工审批；普通小额调用继续走 session key 的自动路径。

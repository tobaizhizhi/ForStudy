# Layer 4 学习导读 —— 先把账户抽象跑出感觉

哈喽，进入账户抽象这一层，最容易卡住的不是代码，而是名词太密：`UserOperation`、EntryPoint、Bundler、Paymaster、session key、EIP-1271、ERC-7702……如果一开始就直接上真实测试网，任何一个 API key、RPC、gas、合约地址报错，都会让你分不清是“代码错了”还是“概念没懂”。

所以这一层按 `chapter7.md` 的自学方式来：

```text
先讲清楚为什么
  -> 本地最小代码跑出数据
  -> 再看真实链脚本
  -> 最后用 Foundry 测链上强制逻辑
```

## 0.1 本层怎么学

建议按这个顺序走，不要跳：

1. 读 `01-course-outline.md`，知道 Layer 4 要交付什么。
2. 读 `02-账户抽象导论.md`，先搞懂为什么不能把 EOA 主私钥交给 agent。
3. 进入 `agent-wallet-lab/`，跑本地 demo，看见 UserOperation / validationData / policy 长什么样。
4. 读 `03` 到 `06`，理解 ERC-4337、SDK、session key、paymaster。
5. 进入 `agent-wallet/`，用 Pimlico 在 Base Sepolia 发真实赞助交易。
6. 进入 `contracts/`，跑 Foundry 测试，看链上账户如何真正强制 session key policy。
7. 最后读 `08` 到 `10`，把 7702、agent 接入、控制台与安全验收串起来。

## 0.2 第一组可运行代码：不用私钥、不上链

先跑这个。本地 lab 不需要 `.env`，不需要 Pimlico，不需要测试币：

```bash
cd /home/lenovo/solidity-course/ata/layer4/agent-wallet-lab
pnpm install
pnpm demo:all
```

你会依次看到：

| 脚本 | 学什么 | 对应章节 |
| --- | --- | --- |
| `01-user-operation.ts` | `UserOperation` 和普通交易有什么不同；`sender` / `callData` / `signature` / `initCode` 各在哪 | 模块 2、3 |
| `02-validation-data.ts` | `validationData` 的低 160 位、`validUntil`、`validAfter` 怎么打包 | 模块 2、6 |
| `03-session-policy.ts` | session key 的目标白名单、函数白名单、额度、撤销怎么拦 | 模块 4 |
| `04-paymaster-simulation.ts` | Bundler 为什么先模拟；paymaster 为什么不能赞助任意 calldata | 模块 5 |
| `05-eip1271.ts` | 智能账户作为 escrow 的 `client` 时，为什么要 EIP-1271 | 模块 6、8 |
| `06-eip7702.ts` | `to = Alice` 为什么会执行 7702 委托代码；`from` 和 `to` 怎么区分 | 模块 7 |

单独跑某个脚本也可以：

```bash
pnpm demo:userop
pnpm demo:policy
pnpm demo:1271
```

## 0.3 第二组可运行代码：真实 AA 链路

本地概念跑通后，再跑真实链脚本：

```bash
cd /home/lenovo/solidity-course/ata/layer4/agent-wallet
pnpm install
cp .env.example .env
```

填好：

```env
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PIMLICO_API_KEY=你的_Pimlico_key
OWNER_PRIVATE_KEY=0x你的测试钱包私钥
```

然后：

```bash
pnpm create-account
```

这一步会做真实的：

```text
owner EOA
  -> SDK 推导 smart account 地址
  -> 构造 UserOperation
  -> Pimlico paymaster 赞助 gas
  -> Pimlico bundler 打包
  -> EntryPoint.handleOps 上链
  -> 首笔 UserOp 顺手部署智能账户
```

## 0.4 第三组可运行代码：链上策略测试

最后看 Solidity 账户怎么强制策略：

```bash
cd /home/lenovo/solidity-course/ata/layer4/contracts
forge test -vv
```

这组测试会验证：

- owner 签名可以通过。
- session key 只能走 `execute(target,value,data)`。
- 白名单外 target / selector 会失败。
- 单笔额度、每日额度、ERC-20 approve 上限会失败。
- approve calldata 长度异常会失败。
- 撤销后旧 key 立刻失效。
- EIP-1271 只接受 owner 代表智能账户签名。

## 0.5 这一层的主线心智

把所有名词压成一句：

```text
agent 不拿主私钥；
owner 给 agent 一把受限 session key；
agent 签 UserOperation；
Bundler 先模拟再打包；
EntryPoint 让智能账户 validateUserOp；
策略通过才 execute；
gas 可以由 paymaster 付；
合约账户要签业务意图时用 EIP-1271。
```

先把这句话跑通，再去读每个模块，脑子会轻很多。


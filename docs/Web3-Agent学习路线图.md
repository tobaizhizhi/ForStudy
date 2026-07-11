# Web3 × AI Agent-to-Agent 学习路线图

> 面向"从零新开一个 Web3 agent-to-agent 项目"的长期学习手册。
> 不依赖任何闭源钱包，全部走**开放标准**。
> 最后更新：2026-07。协议状态以当时公开信息为准；x402 / A2A / AP2 / ERC-8004 仍在快速演进，文中所有"现状数字"与"production-ready / 已上线"类断言都应在进入对应 Layer 前现场重新核实（见下方"协议成熟度风险"）。
>
> **2026-07 关键更新（相较早期版本）**：A2A 已发布 **v1.0 稳定版**（Signed Agent Card / 多 binding / 版本协商）；ERC-8004 已于 **2026-01-29 在以太坊主网部署参考实现**，并在 Base / Gnosis / BNB 等多链起量——它**仍是 draft ERC**（应用层标准，非硬分叉），但已从"能不能用"进入"用哪条链、哪个实现"的阶段。本文对 ERC-8004 的基调已相应从"最后再碰的早期草案"调整为"draft 但已多链落地、细节仍可能变，做可插拔"。

---

## 怎么用这份文档

**你的起点（已具备）🟢**
- Solidity / Foundry、智能合约基础
- TypeScript、ethers / viem 有基础（strict 工程实践需要补强）
- EIP-712 结构化签名（你已用过）
- MCP 入门（用过 `@modelcontextprotocol/sdk`）
- Next.js + Tailwind + shadcn 前端

**图例**
- 🟢 已掌握，只需巩固/加深
- 🔵 核心必学（本项目绕不开）
- 🟡 进阶/可选（做大才需要）
- ⭐ 本类型项目的关键技术，重点投入
- ◈ 推荐继续深化（非必学）：做作品集 / Capstone 时值得加厚，但不放进前期必学清单

**建议节奏**：每个 Layer 学到能做出对应的"里程碑产物"再往下走，不要只看不写。整条路线全程在**测试网**上做，永远不要在主网用真私钥试验 agent。

**技术栈决策（主线）**

本路线图采用 **TypeScript 主线 + Solidity 合约 + Python 可选扩展**：

- **前端 / 操作台**：Next.js + React + TypeScript，负责钱包连接、签名确认、交易状态、任务控制台和人工审批界面。
- **Agent / 后端应用层**：Node.js + TypeScript，负责 MCP/A2A 工具服务、链上读写、x402/AP2/AA SDK 集成、任务状态与日志。
- **链上合约**：Solidity + Foundry，负责任务意图校验、权限边界、支付/结算相关合约与测试。
- **Python**：暂不进入主线；只有出现 RAG、视频/音频处理、本地模型推理、训练/微调或 Python-only 成熟工具链时，再作为独立 FastAPI/worker 服务接入。

这不是排斥 Python，而是避免前期同时分散在两套后端栈里。第一阶段先把 Web3 agent 的签名、权限、支付、发现和工具调用闭环跑通；需要重 AI 能力时，再把 Python 服务作为可插拔模块接进来。

**成熟工具优先原则**：有官方 SDK、成熟库、公共基础设施或社区大量使用的实现时，优先使用它们；不要为了“掌握原理”而在主项目里手写协议、钱包、支付、索引、签名验证、agent loop、bundler、facilitator 等关键组件。学习时可以做最小 demo 帮助理解，但生产路径只保留经过验证的库和服务。

**协议成熟度风险（重要）**

本栈各层成熟度差异很大，押注前心里要有数：

- **基础层，优先投入**：EIP-712 / EIP-1271、ERC-4337、MCP；EIP-3009 在支持它的稳定币 / 链上优先使用 —— 标准相对稳定、库成熟、采用较广。
- **演进中（用，但别焊死）**：x402、AP2，以及 **A2A（已发 v1.0，方向明确、核心数据模型趋稳，但周边治理/注册表标准化仍在补）** —— 做可插拔设计。
- **draft 但已多链落地（可以用，但把它和核心架构解耦）**：ERC-8004 —— 已于 2026-01 主网部署参考实现，并在 Base / Gnosis / BNB 等多链起量；它仍是 **draft ERC**，细节可能继续变，所以放在最后作为**可插拔的身份/信誉层**接入，别把项目核心逻辑焊死在它当前的注册表接口上。

文中出现的交易量、活跃 agent 数、"已 production-ready""主网上线"等说法，请一律当作**需要进入对应 Layer 前现场核实的占位信息**，不要作为架构决策依据。

**MVP v1 最小可行路线（先跑通闭环）**

第一轮不要同时追求所有协议完整落地，先做一个能演示、能测试、能继续扩展的最小闭环：

```
EIP-712 任务意图签名（Task Intent）
  → ERC-4337 SDK 创建 session key 限制 agent 权限
  → MCP SDK 暴露链上工具
  → x402 SDK + 公共 facilitator 完成一次付费 API/服务调用
  → A2A SDK 发布简化 Agent Card 让两个 agent 能互相发现
```

第一轮先**暂缓**复杂 AP2 mandate、ERC-8004 信誉注册、跨链信誉迁移、完整服务市场撮合。等 MVP v1 跑通后，再把 AP2 用作高风险授权层，把 ERC-8004 用作公开身份与信誉层——注意这里"暂缓"是出于**范围控制**（先跑通闭环），不是因为 ERC-8004 不可用：它已在多链有参考实现，随时可以作为可插拔层接进来。

**北极星项目（从第一天就锁定）**

不要把每层的里程碑做成互不相干的小练习——那样最后会发现产物拼不到一起。开篇就选定**一个**贯穿全程的具体项目，之后每层的里程碑都是"给这个项目加一块"，最后自然长成 Capstone：

> **示例北极星：一个最小 "Agent 工具/API 服务市场"** —— Agent A 想购买 Agent B 提供的链上数据分析、风险检查或自动化执行服务。
> - **Layer 2**：写一个校验 EIP-712 任务意图的服务合约
> - **Layer 3**：前端能注资、查看任务结果、领取或结算
> - **Layer 4**：给 Agent A 发一把受限 session key（只能调服务/支付合约、有额度、会过期）
> - **Layer 5/6**：Agent B 用 MCP 暴露服务工具；A2A 让 A 发现 B 并发任务
> - **Layer 7**：A 用 x402 付 USDC；金额超阈值时走 AP2 审批
> - **Capstone**：接 ERC-8004 信誉，端到端跑通、可审计
>
> 你也可以换成自己更有动力的场景（数据 API 市场、自动化运维 agent……），但**全程只做这一个**，每个 Layer 的"里程碑"都直接落到它上面

---

## 第 0 部分：心智模型 —— 2026 年的 "Agentic Stack"

一个 Web3 agent-to-agent 项目，本质是让多个 agent 能**互相发现、互相通信、互相授权、互相付款、互相验证身份**。到 2026 年，这套能力正在形成 5 个互补的协议层，可以这样理解：

```
┌─────────────────────────────────────────────────────────────┐
│  身份与信誉   ERC-8004  (Identity / Reputation / Validation)   │  ← agent 是谁，可不可信
├─────────────────────────────────────────────────────────────┤
│  支付/结算    x402      (HTTP 402 + USDC 链上结算)              │  ← 钱怎么动
│  支付/授权    AP2       (Intent / Cart / Payment 签名授权)      │  ← 谁批准了这笔钱
├─────────────────────────────────────────────────────────────┤
│  agent↔agent  A2A       (Agent Card 发现 + 任务/消息)           │  ← agent 怎么找到彼此、协作
│  agent↔工具   MCP       (tools / resources / prompts)          │  ← agent 怎么用工具/读数据
├─────────────────────────────────────────────────────────────┤
│  执行层       ERC-4337 / 7702 账户抽象 + EIP-712/3009 签名      │  ← agent 的钱包与权限边界
│  底层         EVM / L2 (Base 等) / 智能合约 / 稳定币 USDC        │
└─────────────────────────────────────────────────────────────┘
```

**一句话记法：**
- **MCP** = agent 用工具（agent-to-tool）
- **A2A** = agent 找 agent、互相协作（agent-to-agent）
- **AP2** = 这笔交易"被授权了吗"（signed mandate）
- **x402** = 这笔钱"真的付了吗"（USDC 链上结算）
- **ERC-8004** = 这个 agent"是谁、靠不靠谱"（链上身份+信誉）

**一次完整的 agent 交易长这样：**
```
A2A 发现对方 agent (读 Agent Card)
  → MCP 调用工具/获取报价
  → AP2 生成 Payment Mandate（用户/agent 签名授权）
  → x402 用 USDC 在 Base 上结算（EIP-3009 gasless）
  → ERC-8004 更新双方信誉记录
```

> MCP 与 A2A 现在都归 **Linux Foundation 的 Agentic AI Foundation** 治理；AP2 也已捐给 Linux Foundation；x402 于 **2026-04 由 Coinbase 捐给 Linux Foundation 下的 x402 Foundation**，创始成员 20+（Google、Visa、Stripe、AWS、Mastercard、Circle、Microsoft、Shopify、American Express 等），是中立治理机构。（以上治理归属请核实，可能仍在变化。）这套栈是值得持续跟踪的一组候选协议，但**别把架构焊死在任一标准的当前形态上**——成熟度由高到低大致是：EIP-712/1271、ERC-4337、MCP（基础层，优先投入）> x402（V2，已多链）/ A2A（v1.0）/ AP2（演进中）> ERC-8004（draft，但已多链落地）。注意 A2A 已发 v1.0、x402 已发 V2、ERC-8004 已主网部署参考实现，相比早期版本都更"能用"了，但都仍在演进——用它们，同时保留可插拔 adapter。

---

## 开放标准能力映射

如果目标是把一个“受限权限 + 高风险审批 + 签名证明 + 代付执行 + 审计追踪”的系统迁移到开放栈，可以这样拆：

| 目标能力 | 开放标准组合 | 说明 |
|---|---|---|
| 受限权限，只能调指定合约/函数 | **ERC-4337 会话密钥（session key）+ 权限策略模块** | 给 agent 一把"有作用域、有额度、可撤销"的钥匙 |
| 高风险动作需要人类审批 | **AP2 Mandate + human-in-the-loop 签名** | 需要用户或管理员签过授权才放行 |
| 签名证明可验证 | **EIP-712** + 智能账户验签 **EIP-1271** | EOA 和 smart account 都能验签 |
| 额度超限拦截 | **ERC-4337 spending limit / policy 合约** | 把上限写进账户策略，链上强制 |
| gas 由系统代付 | **ERC-4337 paymaster（gasless）+ relayer** | 让授权方无感支付 gas |
| 资金池入账 | **普通钱包 / 多签（Safe）/ x402 入账** | 标准 ERC-20 transfer 或 x402 结算 |
| 审计与信誉记录 | **链上事件 + ERC-8004 信誉记录** | 保持可追溯性 |

**结论**：新项目里，"权限边界 + 额度 + 审批 + 代付" 这一整层，由 **ERC-4337 账户抽象 + AP2 授权 + EIP-712** 组合实现。所以 **Layer 4（账户抽象）是你这次最需要新补的一块**。

---

## 第 1 部分：分层学习路径

每层格式：**学什么 / 为什么 / 资源 / 里程碑**。

### Layer 0 — 工程基础 🔵（用成熟工具搭 agent 脚手架）

**学什么**
- **TypeScript strict 模式**：`unknown` vs `any`、类型收窄、联合类型/判别联合、泛型基础、`as const`、`satisfies`、`Record` / `Pick` / `Omit` 等常用工具类型
- **异步与错误处理**：`async/await`、`Promise.all`、超时/重试、错误分类、`Result` 风格返回值、避免吞掉异常
- **ESM 与 Node.js 运行时**：用 `tsx` 跑 TS 脚本，理解 `package.json` 的 `type: "module"`、`import/export`、路径与扩展名、Node 版本差异
- **CLI 与脚本入口**：优先用 `commander` / `cac` / `yargs` 这类成熟 CLI 库解析参数，不手写参数解析器
- **配置与环境变量**：优先用 Node `--env-file` / `dotenvx` / `dotenv` 加载 `.env`，再用 zod 做必填配置校验；不要把私钥/API key 写进代码或日志
- **zod / JSON Schema**：输入参数校验、LLM 结构化输出校验、MCP tool schema、错误信息格式化；schema 作为工具边界，不手写散落的 `if` 校验
- **项目脚手架与质量工具**：用 `pnpm`、`tsconfig`、`eslint`、`prettier`、`lint-staged`、`husky` 等成熟工具保持项目一致性，不手写格式化/检查脚本
- **项目结构**：`src/`、`scripts/`、`tests/`、`config/`、`tools/` 分层；把链上客户端、模型客户端、工具定义、业务流程拆开
- **测试与调试**：优先用 Vitest/Jest；HTTP mock 用 `msw` / `nock`；日志用 `pino` / `winston`；不要自己写测试 runner、mock 框架或日志框架
- **Git / GitHub 协作**：小步提交、分支、PR、`.gitignore` / secret scanning / pre-commit hooks，避免提交 `.env` / 私钥 / 生成物

**为什么**
后面会同时接 viem/ethers、MCP SDK、LangChain/LangGraph、x402 SDK、A2A SDK 和 AA SDK。TypeScript、运行时校验、环境配置和异步错误处理不稳，问题会很难定位，尤其是签名、支付和 agent 工具调用这种跨边界流程。工程基础层也遵守“成熟工具优先”：自己理解原理，但项目里优先用社区验证过的工具。

**资源**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) · [zod 文档](https://zod.dev)
- [Node.js ESM 文档](https://nodejs.org/api/esm.html) · [tsx](https://tsx.is) · [commander](https://github.com/tj/commander.js)
- [Vitest](https://vitest.dev) · [msw](https://mswjs.io) / [nock](https://github.com/nock/nock) · [pino](https://getpino.io)
- [ESLint](https://eslint.org) · [Prettier](https://prettier.io) · [lint-staged](https://github.com/lint-staged/lint-staged)

**里程碑**：用 `tsx + commander/cac + zod + pino + Vitest + msw/nock` 搭一个 TypeScript CLI 小工具：读取 `.env` 配置 → 用 zod 校验输入 → 调用一个 mock 链上/HTTP 工具 → 输出结构化 JSON → 用 Vitest 覆盖成功、参数错误、外部调用失败三种情况。

---

### Layer 1 — 区块链 & EVM 基础 🔵

**学什么**
- 区块链如何工作：区块、共识、最终性（finality）、mempool
- 账户模型：EOA（外部账户）vs 合约账户；nonce、余额
- 交易与 gas：gas/gasPrice/EIP-1559、calldata、交易生命周期
- 密码学原语：keccak256 哈希、ECDSA 签名、地址如何从公钥派生
- EVM 执行模型：storage / memory / calldata、opcode、revert
- L1 vs L2：rollup（Optimistic vs ZK）原理；**为什么 agent 项目几乎都跑在 L2**（gas 低、确认快）——Base / Arbitrum / Optimism

**为什么**
agent 要自主签名、发交易、读链上状态，必须先理解"一笔交易从签名到上链"的全过程，否则后面 EIP-712、账户抽象、x402 都会卡住。

**资源**
- [evm.codes](https://www.evm.codes) — 交互式 opcode + EVM 手册
- [Cyfrin Updraft](https://updraft.cyfrin.io) — 免费、系统、面向开发者（Patrick Collins）
- [ethereum.org/developers/docs](https://ethereum.org/en/developers/docs/)

**里程碑**：能讲清楚"一笔 USDC 转账在 Base 上从签名到 finality 经历了什么"，并在测试网用钱包手动发一笔交易。

---

### Layer 2 — 智能合约 & Solidity 🟢→🔵（巩固 + 补关键点）

**学什么**（你有基础，重点补 ⭐ 的部分）
- Solidity 进阶：合约结构、modifier、event、错误处理、gas 优化模式
- 代币标准：**ERC-20**（资金池/稳定币）、**ERC-721**（⭐ ERC-8004 用 NFT 表示 agent 身份）、ERC-1155
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)：AccessControl、Ownable、SafeERC20、ReentrancyGuard
- ⭐ **EIP-712 结构化签名**（你已会，要深化）：domain separator、typeHash、`chainId` 绑定、防重放 nonce
- ⭐ **EIP-1271**：智能账户（合约）如何验签——AA 钱包必备
- ⭐ **EIP-3009 `transferWithAuthorization` / Permit2**：稳定币 gasless 授权转账，**这是 x402 结算的底层机制**
- Foundry 深用：`forge test`、fuzz 测试、invariant 测试、**fork 测试**（在主网分叉上测）、`forge script` 部署

**为什么**
你的 agent 要签 EIP-712 证明、要让 smart account 验签（EIP-1271）、要用 EIP-3009 做无 gas 稳定币支付——这三个 EIP 是连接"合约层"和"agent 支付层"的关键。你已经摸到 EIP-712，这次要把 712 + 1271 + 3009 三件套吃透。

**资源**
- [Solidity 官方文档](https://docs.soliditylang.org) / [Solidity by Example](https://solidity-by-example.org)
- [Foundry Book](https://book.getfoundry.sh)
- EIP 原文：[EIP-712](https://eips.ethereum.org/EIPS/eip-712) · [EIP-1271](https://eips.ethereum.org/EIPS/eip-1271) · [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) · [Permit2](https://github.com/Uniswap/permit2)

**里程碑**：基于 OpenZeppelin / viem 等成熟库写一个最小业务合约，校验 EIP-712 签名的"任务意图"，且支持 EIP-1271（调用方可以是 EOA 或 smart account）；不要手写底层 ECDSA/EIP-712 编码，用 Foundry 写 fuzz 测试覆盖重放攻击。

---

### Layer 3 — Web3 客户端 & 前端 🔵（你大部分已会）

**学什么**
- **viem**（首选，类型安全，你前端已在用）+ **wagmi** + `@tanstack/react-query`
- 读链：`readContract`、监听 event、解析 ABI；写链：`writeContract`、等待回执
- 钱包连接与签名：`personal_sign`、`signTypedData`（EIP-712）
- RPC 提供商（Alchemy / Infura）、节点与速率限制
- 链上数据索引：少量数据先读合约 event；数据量大时优先用 [The Graph](https://thegraph.com/docs)、indexer 服务或数据库同步工具，不手写完整索引框架
- 交易体验：`simulateContract` / 交易预览、签名确认、`waitForTransactionReceipt`、失败回放、pending / success / failed 状态展示
- 网络与账户状态：链切换、余额、nonce、连接断开、用户拒签、RPC 失败、链不匹配的处理
- 数据展示：交易历史、事件流、任务状态、链上时间线、错误信息可读化；把“链上事实”做成可扫描的 UI，而不是只给一个按钮
- 前端安全：只显示可公开信息；签名前明确展示金额、目标合约、链 ID、风险提示；不要把密钥、原始 RPC key、敏感 URL 泄到页面或日志

**为什么**
agent 的链上动作最终要有人类可见、可复核的界面。Layer 3 不只是“写一个页面”，而是把链上状态、交易预览、签名确认、回执和历史做成一个真正可用的操作台。后面 Layer 4 的 session key、Layer 7 的支付、Layer 8 的安全，都需要这层把结果清楚地展示出来。

**资源**：[viem.sh](https://viem.sh) · [wagmi.sh](https://wagmi.sh) · [ethers v6](https://docs.ethers.org/v6/)

**里程碑**：一个 Next.js “链上操作台” 或“任务控制台” —— 连接钱包 → 检查网络与余额 → 读取资金池 / 任务状态 → 预览并签名一条 EIP-712 → 发交易 → 等待回执 → 展示交易历史与事件流。

**安全验收**：链 ID 不对时禁止继续；用户拒签时 UI 要有明确状态；发交易前必须展示目标地址、金额、函数名或意图摘要；失败交易能回看失败原因；不会把私钥、助记词、完整 RPC key 送进前端状态。

---

### Layer 4 — 账户抽象 & Agent 钱包 ⭐（本次最重要的新增项）

**学什么**
- EOA vs **Smart Account（智能账户）** 的本质区别
- **ERC-4337**：核心组件 —— `UserOperation`、`EntryPoint`、Bundler、**Paymaster**（赞助 gas）、**Session Key**（会话密钥）
- **ERC-7702**（2025 Pectra 升级引入）：让普通 EOA 临时获得智能账户能力——2026 年 agent 钱包的重要方向
- **7702 还是 4337？给个判断标准**：本项目 agent 钱包**优先用 ERC-4337 智能账户**——session key / policy / paymaster 生态最成熟，最契合"受限自主花钱"。ERC-7702 更适合"让用户的现有 EOA 临时获得 AA 能力"的场景，作为进阶补充、不作为起点。两者正在融合演进，选 SDK 前确认它当前对二者各自的支持程度，别为了用新特性而牺牲成熟度
- **Session key + 权限策略**：给 agent 一把"只能调某合约、单笔≤X、每日≤Y、N 天后过期"的钥匙 —— 这是受限 agent 权限的开放做法
- Smart Account SDK（优先 SDK，不手写 `UserOperation` / EntryPoint / bundler / paymaster）。**注意这其实是两层，不是"四选一"**：
  - **账户实现 + 权限模块层**（session key 住在这一层）：[ZeroDev](https://docs.zerodev.app) Kernel（session key / policy 体验好）、[Safe{Core}](https://docs.safe.global)（多签 + 模块，适合资金池）、[Alchemy Account Kit](https://accountkit.alchemy.com)
  - **bundler / paymaster 基础设施层**（账户无关，只管打包 UserOp 和代付 gas）：[Pimlico / permissionless.js](https://docs.pimlico.io)
  - ⚠️ 常见坑：permissionless.js 默认的 **SimpleAccount 没有原生 session key**——它只是"单 owner 智能账户 + Pimlico 代付"。想"用成熟 SDK 又要 session key"，账户实现层必须换成 ZeroDev Kernel / Safe 模块这类模块化账户（ERC-7579）；Pimlico 仍然只负责 bundler/paymaster。三层心智见本课程 `layer4/05-会话密钥与权限策略.md`。
- Passkey / WebAuthn 作为签名器（可选进阶）
- **权限生命周期**：创建、激活、轮换、暂停、撤销 session key；为不同任务配置不同 scope 和额度；高风险操作要能切回人工确认
- **执行链路**：`UserOperation` 生成、模拟、提交、等待、失败重试、回执查询；知道 bundler、paymaster、smart account 哪一层在失败
- **账户可视化**：展示 smart account 地址、owner、session key 列表、额度、过期时间、最近动作、paymaster 使用情况
- **故障恢复**：paymaster 拒付、链不匹配、nonce 冲突、session key 过期、权限不足时如何降级到手动流程或请求人工介入

**为什么**
agent 自主花钱最大的风险是"私钥泄露/被 prompt 注入诱导 = 资金清零"。账户抽象不只是换个钱包 SDK，而是把“谁能做什么、能做多久、最多花多少”变成可编程、可撤销、可审计的权限层。Layer 4 要做成真正的控制面，而不是跑一次 SDK demo。

**资源**
- [erc4337.io](https://www.erc4337.io) · [EIP-4337](https://eips.ethereum.org/EIPS/eip-4337) · [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702)
- ZeroDev / Pimlico 文档里的 "session keys" 与 "gas sponsorship" 教程

**里程碑**：做一个“Agent 钱包控制台” —— 创建/导入 smart account → 生成一把受限 session key → 设置额度/过期/目标合约 → 模拟一笔受限操作 → 通过 bundler + paymaster 发送 → 展示回执 → 可一键撤销或轮换 session key。

**安全验收**：session key 的 scope、额度、过期时间、撤销状态都要可见可测；paymaster 不能为任意 calldata 付 gas；链 ID、目标合约、调用函数要在提交前校验；撤销后旧 key 不能继续用；所有高风险动作都能回到人工确认。

---

### Layer 5 — AI Agent 基础 & 编排层 🔵

**◈ 推荐继续深化（非必学）**：完整单 Agent 工作流、状态图、checkpoint、人工审批、失败恢复、对抗测试、trace 回放。

**学什么**
- **完整单 Agent 工作流**：任务输入 → zod 校验 → 意图识别 → 计划生成 → 工具选择 → 工具执行 → 结果校验 → 风险判断 → 自动执行 / 人工确认 → 最终响应 → trace 记录
- **工具调用 / function calling** 的原理与循环（理解即可，落地优先用 SDK / 框架的现成 tool calling，不在主项目手写 tool-use loop）
- **LangChain.js 必要子集**：ChatModel、message 类型、tool calling、structured output、Runnable、callback/tracing、provider adapter 基础
- **LangGraph.js**：状态图（state graph）、节点（node）、边（edge）、条件分支、checkpoint、human-in-the-loop、失败恢复、多 agent workflow；这层要真的画出并跑通状态图
- **模型提供方解耦**：优先用 OpenAI-compatible API 或本地模型适配层，模型可替换为 DeepSeek / Qwen / Ollama / Gemini / OpenAI / Claude 等；不要把项目绑死在某一个大模型或某个云厂商 SDK 上
- **工具层模型无关**：业务工具优先用 MCP SDK、HTTP 框架或成熟工具库暴露成 MCP server / HTTP API / TypeScript function + JSON Schema/zod schema；LLM 只负责选择工具和填参数，真实权限、额度、签名、支付验证必须在工具/合约/服务端执行
- **工具集设计**：至少准备 `getServiceQuote`、`readOnchainState`、`draftTaskIntent`、`riskCheck`、`requestHumanApproval`、`executeApprovedAction` 这类工具；每个工具都有 schema、权限边界、超时、重试、错误码
- **状态设计**：用 zod 定义 agent state，例如 `taskId`、`userIntent`、`plan`、`toolResults`、`riskLevel`、`approvalStatus`、`executionReceipt`、`errors`；不要让状态散落在 prompt 字符串里
- Agent 模式：ReAct、规划（planning）、短期记忆 / checkpoint、失败重试、人工审批、多 agent 编排
- **结构化输出与校验**（zod / JSON Schema，你已在用）—— 任务建议、风险判断、支付授权这类会影响资金或权限的输出必须结构化、可校验
- **评测（eval）与护栏（guardrails）**：尤其是 **prompt injection** 意识——当 agent 能动钱，注入攻击=真实损失
- **可观测性（observability）—— 第一等公民，不是事后补**：用结构化日志 + trace（如 LangSmith / OpenTelemetry 等成熟方案）让 agent 的"每一步决策、调了哪个工具、为什么放行或拦截某笔支付"可事后完整回放。agent 自主动钱的系统，线上排障("这笔异常支付到底怎么发生的")完全依赖这条决策审计链——从一开始就埋好，别等出事再补

**为什么**
这是 agent 的"大脑"和"流程控制层"。如果只会单次 tool calling，作品集会显得薄；这一层要做出一个可恢复、可测试、可观察的完整工作流。后面的 MCP、A2A、x402 都只是把这个工作流暴露出去、让别人调用、让支付发生；真正的 agent 能力在 Layer 5 先成型。

**资源**
- [LangChain.js 文档](https://js.langchain.com) · [LangGraph.js 文档](https://langchain-ai.github.io/langgraphjs/)
- [Ollama](https://ollama.com)（本地模型）· OpenAI-compatible API 文档（DeepSeek / Qwen / OpenAI 等按实际选择）
- OWASP LLM Top 10（prompt injection 等风险清单）

**里程碑**：做一个“Agent Workflow Runner” —— 用户输入一个任务 → agent 生成结构化计划 → 调用报价 / 读链 / 风险检查工具 → 低风险自动生成执行建议，高风险进入 human-in-the-loop → 输出最终决策、原因、风险等级、所需签名或交易摘要；全流程有 checkpoint、结构化日志、trace 和测试。

**安全验收**：prompt injection 样例不能绕过工具权限；LLM 输出必须过 zod / JSON Schema；风险等级为 high 时不能自动执行；工具错误和超时要进入可解释失败状态；每一次工具调用都有 request id、输入摘要、输出摘要和错误码。

---

### Layer 6 — Agent 通信协议 ⭐（A2A 的核心）

**本层分层学**：**MCP 深化 + A2A v1.0 是本层必做 🔵**；**ERC-8004 是本层的 ◈ 深化/预习**，真正端到端落地放在 Phase 5 / Capstone（和下方 Phase 计划一致）。这样 Layer 6 不会一次背三座大山。

**◈ 推荐继续深化（非必学）**：协议网关、服务目录、Agent Card 路由、签名校验、版本协商、HTTP fallback。

**MCP 在哪层出现（避免和 Layer 5 混淆）**
你在 Layer 5 已经用 MCP **封装链上工具**（把 server 跑起来、暴露 tool）；Layer 6 是**深化 MCP**——传输层（stdio / Streamable HTTP）、resources / prompts、以及把 MCP server 和 A2A 发现层对接起来。一句话：**Layer 5 用 MCP 造工具，Layer 6 深化 MCP 传输并接到 A2A。**

**学什么**
- **MCP 深入**（你有基础）：Server / Client、tools / resources / prompts、传输层（stdio / Streamable HTTP）、用 `@modelcontextprotocol/sdk` 把链上能力（查池、签名、读状态、发任务）封装成工具
- **A2A v1.0**（2026 初已发稳定版，核心数据模型趋稳）：
  - **Agent Card**（能力声明）+ **Signed Agent Card**（v1.0 头号特性）：签名机制是 **JWS（RFC 7515）+ 签名前用 JSON Canonicalization Scheme / JCS（RFC 8785）规范化**——去中心化发现要能信任，靠的就是这一步；你的里程碑"校验签名"验的就是这条 JWS
  - 发现（discovery）、任务（task）、消息（message）；11 个 JSON-RPC 方法（`SendMessage` / `SendStreamingMessage` / `GetTask` / `SubscribeToTask` / push notification config 等）
  - **三种协议绑定**：JSON-RPC 2.0（最常见的公开部署）、gRPC（低延迟内部通信）、HTTP+JSON/REST；每个 interface 在 `supportedInterfaces[]` 声明自己的 `protocolBinding`
  - **版本协商**：客户端发 `A2A-Version` header（如 `1.0`），服务端校验并拒绝不支持的版本；破坏性变更用新 URI 区分
  - **⚠️ v1.0 破坏性变更要知道**：枚举值从 kebab-case 改成 SCREAMING_SNAKE_CASE（ProtoJSON 合规）、`TaskStatusUpdateEvent` 移除了 `final` 字段、push notification 操作重命名（`CreateTaskPushNotificationConfig` 等）、security scheme 变成判别联合、OAuth 流程更新（加 Device Code / PKCE，去掉 implicit/password）。参考旧教程/旧 SDK 会踩这些坑，认准 v1.0 文档
  - SDK：Python / JS / Java / Go / .NET
- **MCP vs A2A 边界**：MCP 接工具，A2A 接 agent，两个一起用
- **ERC-8004（Trustless Agents，◈ 本层深化 / Capstone 落地）** —— agent 的链上身份与信誉：
  - **状态（2026-07）**：仍是 **draft ERC**（应用层标准，非硬分叉），但已于 **2026-01-29 在以太坊主网部署参考实现**，并在 **Base / Gnosis / BNB / Optimism / Arbitrum** 等多链起量（测试网期即注册 10,000+ agents、20,000+ feedback）；EF 去中心化 AI 团队已把它放进 2026 roadmap。**结论：可以用了，但接口细节仍可能变——把它做成可插拔的身份/信誉层，别焊进核心逻辑。**
  - 三个链上注册表：**Identity / Reputation / Validation**（每个注册表每条链部署一次）
  - 每个 agent = 一个 **ERC-721 NFT**（因此天然兼容 NFT 生态 + token-bound account），指向一份 **Agent Card JSON**（含名称、能力、MCP/A2A/web 端点、收款地址）
  - 扩展 A2A，加上"无需预先信任也能选择对方 agent"的信任层
  - 信誉可携带：在以太坊积累的记录能跟着 agent 迁到 Base / Optimism（跨链高频反馈建议落在 L2，主网单笔 feedback 的 gas 成本对高频 agent 不现实）
- **协议适配层设计**：给 A2A、MCP、HTTP、未来协议留统一 adapter 接口；Agent Card / capability / endpoint / auth / rate limit / payment hint 这些字段要能映射到统一内部模型
- **发现与路由**：Agent Card 解析、**JWS 签名校验**、版本协商、endpoint health check、超时与重试、能力匹配、任务路由；不是只"找到 agent"，而是能稳定把任务发给它
- **服务目录**：做一个轻量 registry / directory，列出可用 agent、能力标签、链支持、收费方式、信誉摘要、健康状态；让"发现"有一个可视化入口（进阶：信誉摘要可从 ERC-8004 Reputation 注册表读）
- **互操作测试**：同一任务能通过 MCP 调工具、A2A 发任务、HTTP 取结果；测试中故意喂无签名 Card、JWS 验签失败的 Card、错版本 Card、过期 Card、伪造 endpoint，看系统是否拒绝

**为什么**
这是"agent-to-agent"真正的骨架：A2A 负责发现和协作，MCP 负责工具接入，ERC-8004 负责身份与信誉。Layer 6 要做成"协议网关"和"服务目录"，让 Layer 5 生成的工作流可以跨 agent、跨工具、跨服务稳定流转。A2A v1.0 的 Signed Agent Card 把"去中心化发现能不能信任"这个根问题解决了——本层的安全验收正是围绕它展开。

**资源**
- [modelcontextprotocol.io](https://modelcontextprotocol.io) · [MCP 规范](https://spec.modelcontextprotocol.io)
- [a2a-protocol.org](https://a2a-protocol.org)（认准 v1.0）· [What's New in v1.0](https://a2a-protocol.org/latest/whats-new-v1/) · [github.com/a2aproject/A2A](https://github.com/a2aproject/A2A)
- ERC-8004 讨论与规范：[Ethereum Magicians: ERC-8004 Trustless Agents](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098) · [github.com/ChaosChain/trustless-agents-erc-ri](https://github.com/ChaosChain/trustless-agents-erc-ri)（参考实现）

**里程碑**：做一个"Agent Protocol Gateway" —— 同时支持 MCP server、A2A v1.0 Agent Card discovery（含 **JWS 签名校验**）和 HTTP fallback；带一个轻量服务目录，能列出 agent、能力、链支持、收费方式和信誉摘要；两个 agent 可以互相发现并完成一次有签名、有版本协商、有错误回放的任务交接。（◈ 深化：目录里的信誉摘要接 ERC-8004 Reputation 注册表读取，作为可插拔模块。）

**安全验收**：未签名 / JWS 验签失败 / 版本不兼容 / endpoint 被篡改的 Agent Card 必须拒绝；服务目录里显示的 endpoint 与实际验证结果要一致；协议适配层不能绕过认证、额度、计费和日志；如接入 ERC-8004，读到的身份/信誉必须与链上注册表一致，不能被本地缓存伪造。

---

### Layer 7 — Agentic 支付 ⭐（agent↔agent 价值转移）

**◈ 推荐继续深化（非必学）**：支付状态机、对账、退款 / 争议、重复提交防护、支付回放。

**学什么**
- **x402（核心结算层，2026-04 起归 Linux Foundation 的 x402 Foundation 治理）**：
  - HTTP 402 握手流程：请求付费资源 → 服务端返回 `402 Payment Required` + 付款指令 → agent 签稳定币交易 → 带 proof 重试 → 服务端验证后返回数据
  - **优先用官方 SDK / 中间件，不手写 402 逻辑**：x402 有 production-ready 的 **TypeScript / Go / Python SDK**，以及 **Express / Next.js / Hono / Axios 框架专用包**——契合本路线图的 Next.js + Node/TS 主线。**V2（2025-12 发布）拆成模块化包**：`@x402/evm`（EVM）+ `@x402/svm`（Solana）
  - **V2 关键新特性**：① 多链——从"只有 Base/USDC"扩到 **Base / Solana / Ethereum / Polygon / Starknet / Injective**；② **Wallet sessions（会话支付）**——认证一次后用 session token，服务端周期性结算，不必每次调用都上链，**这是高频 agent 调用的关键优化**（直接影响下方"收费模型"）；③ 可插拔 legacy rails（ACH / SEPA / 卡网络）
  - **Facilitator**（结算撮合者）：MVP 优先用公共 facilitator，不自建。**多 facilitator 生态**——Coinbase CDP（免费额度 1000 笔/月，之后约 $0.001/笔；支持 Base/Polygon/Arbitrum/World/Solana，走 EIP-3009(USDC/EURC) 或 Permit2(任意 ERC-20)）、RelAI、Stellar（OpenZeppelin Relayer 运营）等
  - 链无关设计，主力在 **Base / Solana**（低费、快确认）；结算币种以 **USDC** 为主，**EIP-3009** 实现 gasless，任意 ERC-20 经 Permit2 支持
  - 现状（2026，⚠️ 以下数字与"production-ready"说法均需进入本层前现场核实，勿作为架构依据）：据报道累计已破 **1.65 亿+ 笔交易、6.9 万+ 活跃 agent、约 $6 亿年化**，零协议费；Base 占大头（1.19 亿+ 笔、约 $35M）；Stripe（2026-02 在 Base 上）、Cloudflare 被报道已接入
- **AP2（授权层，与 x402 互补；Google 主导，2025-09 起有生产支持，60+ 机构在集成）**：
  - 三种 **Mandate**：Intent（意图）/ Cart（购物车）/ Payment（付款）
  - 技术形态：mandate 是 **JSON-LD 的 W3C Verifiable Credentials**，用 **ECDSA over P-256（或更强曲线）+ SHA-256** 签名（和你 Layer 6 学的 JWS/JCS 是同一类"用密码学证明授权为真"的心智）；每条 mandate 带 payload、时间戳、nonce、签名者公钥引用和签名
  - AP2 本身**不动钱**，只产出"这笔交易已被授权"的可验证记录，由具体 rail（卡/银行/稳定币）结算
  - **A2A x402 extension（已 production-ready）**：Google 联合 Coinbase、Ethereum Foundation、MetaMask 共同开发，让一个 AP2 mandate 去授权一笔 x402 USDC 结算，给 crypto 支付与刷卡同级的审计链 —— 这是把"授权"和"结算"接起来的关键（仓库 `google-a2a/a2a-x402`；进入本层前仍建议核实当前版本）
  - 边界：AP2 把 mandate 绑定到**用户**、不绑定到 agent；agent 身份证明是另一层（如 Visa 的 Trusted Agent Protocol、或 Layer 6 的 ERC-8004），别指望 AP2 替你做 agent 身份
- **稳定币基础**：USDC / EURC、EIP-3009 gasless transfer 机制；Solana 侧为 SPL USDC
- **完整支付闭环**：报价 → 授权 → 预检 → 结算 → 回执 → 对账 → 失败重试 / 退款 / 争议记录；不要只学“怎么付”，还要学“怎么对账和失败恢复”
- **支付状态机**：`quote_pending`、`awaiting_mandate`、`authorized`、`submitted`、`settled`、`failed`、`expired`、`refunded` 等状态；每个状态要能映射到日志和 UI
- **收费模型**：按次、按流量、按任务、按成功结果；高频调用可用 x402 V2 的 **wallet session** 降低每次上链成本；系统里至少要支持一种最小计费单位，并能把价格和结算币种显示给用户
- **结算对账**：交易 hash、mandate id、任务 id、收款地址、链、币种、金额、服务响应要能串起来；支持重复通知、迟到回执、部分失败的处理

**为什么**
这是"agent 之间能自主交易"的落地层，也是 Web3 A2A 区别于普通多 agent 系统的根本。Layer 7 不只是“收一次钱”，而是把授权、结算、回执、失败恢复和对账都做成产品级闭环。**AP2 = 谁批准**，**x402 = 钱真的付了**，但作品集里还要让人看到你能把整个支付流水管住。

**资源**
- x402：[x402.org](https://www.x402.org) · [github.com/coinbase/x402](https://github.com/coinbase/x402) · [Coinbase x402 文档](https://docs.cdp.coinbase.com/x402/welcome) · SDK/中间件与 facilitator 清单见 [awesome-x402](https://github.com/xpaysh/awesome-x402)（TS/Go/Python SDK、Express/Next.js/Hono/Axios 中间件、`@x402/evm`·`@x402/svm`）
- AP2：[ap2-protocol.org](https://ap2-protocol.org) · [github.com/google-agentic-commerce/AP2](https://github.com/google-agentic-commerce/AP2) · x402 扩展 [github.com/google-a2a/a2a-x402](https://github.com/google-a2a/a2a-x402)（已 production-ready）
- 钱包/agent 基础设施（开放可选）：Coinbase CDP / AgentKit（[docs.cdp.coinbase.com/agent-kit](https://docs.cdp.coinbase.com/agent-kit)）、Crossmint 等。优先用上面的 ERC-4337 SDK / AA 基础设施组合出开放的钱包策略层。

**里程碑**：做一个“Paywalled Agent Service” —— A 请求 B 的服务，先拿报价，再走 AP2/x402 授权与结算，B 返回结果并在前端展示支付状态、交易 hash、回执和对账信息；高风险金额必须进入人工审批，失败支付能重试或标记退款。**优先用 x402 官方中间件**（Express / Next.js 包）把普通 API 改造成 402 付费资源 + 公共 facilitator，不手写 402 握手 / proof 解析 / 结算撮合。

**安全验收**：授权和结算必须绑定同一任务 id、金额、币种、链和收款方；重复提交、过期 quote、伪造 proof、错误收款地址都要被拒绝；支付状态变化必须可审计，不能只看最后一笔 tx。

---

### Layer 8 — 安全（贯穿全程，⭐ 不可跳过）

**◈ 推荐继续深化（非必学）**：安全测试集、CI、回放、审计导出、发布前检查表，把安全从“知识点”做成“工程系统”。

**学什么**
- **合约安全**：重入、权限错配、整数与精度、预言机操纵、**签名重放**（nonce、domain separator、`chainId` 必须绑定）、EIP-712 实现陷阱
- **Agent 安全**：**prompt injection → 诱导转账**、工具投毒（tool poisoning）、权限过宽；用 **最小权限**（session key 作用域 + 额度上限 + 过期）对冲
- **密钥管理**：私钥永不进前端/日志/仓库；高风险动作用 **AA 策略 + human-in-the-loop**（AP2 mandate）拦截——这是受限 agent 动作的开放做法
- 永远 **测试网优先**；上主网前做审计 / 跑工具
- **可观测性与事后取证**：结构化日志、trace、交易回放、任务 ID 贯通、错误分类、失败快照、审计导出；让“出了问题怎么查”成为设计的一部分
- **权限与配置安全**：环境变量、API key、RPC key、session key、mandate、paymaster 权限都要分层管理；不要把所有钥匙混在一起
- **评测与对抗测试**：构造 prompt injection、恶意 tool 返回、伪造 Agent Card、重放签名、重复支付、链切换攻击、超限调用的测试集
- **发布前检查表**：主网开关、测试网默认、kill switch、pause、撤销、额度上限、告警、回滚、依赖版本锁定

**资源 / 练手**
- [Ethernaut](https://ethernaut.openzeppelin.com)（合约攻防闯关）· [Damn Vulnerable DeFi](https://www.damnvulnerabledefi.xyz)
- [Slither](https://github.com/crytic/slither)（静态分析）+ Foundry fuzz/invariant
- OWASP LLM Top 10、Secureum / Cyfrin 安全课

**里程碑**：建立一套“安全与观测基线” —— 包含合约 fuzz / invariant、agent prompt injection 套件、支付重复提交测试、协议伪造测试、结构化日志、trace 和回放脚本；把安全测试放进 CI，而不是作为最后补丁。

**安全验收**：任何高风险动作都能被审计、拦截、回放、撤销；关键权限都有最小化和过期机制；日志和 trace 足够还原一次错误支付或错误执行的全过程。

---

## 第 2 部分：分阶段学习计划（带里程碑）

> 每个 Phase 结束都有一个可演示的产物，并有对应的安全验收。全程测试网（Base Sepolia 等）。
>
> **关于周数**：下面的时间是"已有对应基础、较集中投入"的乐观估计。如果账户抽象 / x402 / A2A 对你是全新领域，按 **×1.5~2** 预留更现实——尤其 Phase 2（AA + session key + paymaster 三方跑通并验证额度/过期/撤销）很容易超期。卡进度是常态，不是失败。

**Phase 1 — 夯实链上基础（约 2–3 周）**
巩固 Solidity/Foundry + 吃透 EIP-712 / 1271 / 3009。
✅ 产物：用 OpenZeppelin / viem / Foundry 等成熟库完成一个校验 EIP-712 任务意图签名、支持 EIP-1271、调用现成 EIP-3009/Permit2 能力做 gasless USDC 转账的合约/脚本 + fuzz 测试。
🔐 安全验收：覆盖 nonce 防重放、domain separator、`chainId` 绑定、过期时间、错误 signer、重复使用 authorization；至少有一组 fuzz 测试证明签名不可跨链/跨合约复用。

**Phase 2 — Agent 钱包与权限（约 2 周）⭐ 新增重点**
学 ERC-4337 / 7702 + session key + paymaster。
✅ 产物：用**模块化账户 SDK**（ZeroDev Kernel / Safe 模块 / Alchemy Account Kit——注意 permissionless 默认的 SimpleAccount 没有原生 session key）创建一个智能账户 + 一把受限 session key（作用域/额度/过期），再叠 Pimlico 做 gasless 领取；不手写 bundler/paymaster/EntryPoint 交互。
🔐 安全验收：验证 session key 只能调用指定合约/函数，单笔额度、累计额度、过期时间、撤销逻辑都能拦截；paymaster 不会为任意 calldata 或未知目标合约付 gas。

**Phase 3 — AI Agent + MCP（约 1–2 周，你有基础）**
LangChain.js 必要子集 / 现成 SDK 的 tool calling + MCP server 封装链上工具 + 结构化任务输出；复杂分支再引入 LangGraph.js。
✅ 产物：一个模型可替换、能查链、能生成结构化任务建议、带 prompt-injection 护栏的 agent；链上能力以 MCP server 暴露，LLM provider 可在 DeepSeek / Qwen / Ollama / Gemini / OpenAI / Claude 等之间替换。
🔐 安全验收：MCP tool schema 使用 zod/JSON Schema 严格校验；准备一组 prompt injection / tool poisoning 样例，确认 agent 不会因为外部文本绕过额度、签名、审批或目标合约限制。

**Phase 4A — x402 付费服务闭环（约 1 周）⭐ 核心**
先不接 A2A，优先用 x402 官方 SDK / 中间件 / 公共 facilitator，把一个普通 HTTP/API 服务改造成 x402 付费资源：请求服务 → 返回 `402 Payment Required` → agent 支付 USDC → 带 proof 重试 → 服务端验证后返回结果。
✅ 产物：一个可本地/测试网演示的 x402 付费工具或数据 API；不手写 x402 proof 解析、结算撮合或 facilitator。
🔐 安全验收：覆盖 payment proof 伪造、重复提交、金额不足、过期 quote、错误收款地址、错误 chain/token；服务端必须先验证支付再释放付费结果。

**Phase 4B — A2A 发现 + 任务调用（约 1 周）⭐ 核心**
在 4A 的付费服务外层优先用 A2A SDK 接入 **A2A v1.0**：发布 Agent Card / Signed Agent Card，让另一个 agent 能发现它、读取能力说明，并发起一次任务调用。
✅ 产物：两个 agent 互相发现并完成一次"付费服务调用"，支付仍沿用 4A 的 x402 流程。
🔐 安全验收：校验 Signed Agent Card 的 **JWS 签名（JCS 规范化）**、服务端点、版本（`A2A-Version`）和能力声明；拒绝未签名/JWS 验签失败/端点被篡改的 Agent Card，避免调用伪装 agent。

**Phase 4C — AP2 高风险授权（约 1 周，进阶）**
只在高金额、高风险或需要人工审批的动作里引入 AP2 mandate；普通小额调用仍走 session key + x402 的自动路径。AP2 / A2A x402 extension 优先用官方或社区 SDK，不手写 VC/mandate 序列化和验证流程。
✅ 产物：当金额或风险分数超过阈值时，必须先拿到人类/管理员签过的 AP2 Payment Mandate，才能继续 x402 结算。
🔐 安全验收：mandate 必须绑定 payer、payee、金额、token、chain、用途、过期时间和 nonce；验证拒绝过期、重放、错收款方、错金额、错任务上下文的 mandate。

**Phase 5 — 毕业项目 / Capstone（约 3–4 周）**
用开放标准做一个 **agent 工具/API 服务市场**：
- agent 通过 **A2A + ERC-8004** 互相发现并查信誉
- 通过 **x402** 互相付款（USDC）
- 用 **ERC-4337 session key 策略** 限制 agent 权限
- 高风险用 **AP2 mandate + human-in-the-loop** 审批
- 全链路链上可审计（事件 + ERC-8004 信誉）
✅ 产物：一个端到端、可演示、纯开放标准的 Web3 A2A 应用。
🔐 安全验收：有 kill switch / pause 机制、私钥与 API key 不进前端/日志/仓库、链上事件可追溯关键动作、异常支付可定位、所有高风险动作都有人工审批或可撤销权限边界。

---

## 第 3 部分：把它变成作品集（不止是"做完"）

这整条路线从第一天就锁定了一个北极星项目，每层里程碑都是"给它加一块"——所以你不是在做一堆练习，而是在持续长出**一个**能展示的项目。但"代码能跑"和"作品集能打动人"之间还差一层包装。这一节就讲这层。

核心心态：**招聘方/合作者平均花在你一个项目上的时间可能不到 3 分钟**。他们不会 clone 下来跑，大概率只看 README 顶部、一段 demo、和你怎么描述技术决策。所以呈现的优先级是「让人 30 秒内看懂你做了什么、为什么难、你怎么解决的」。

### 3.1 作品集不是一个，是一串

别等 Capstone 全部做完才开始包装。每个 Phase 的产物单拎出来就是一个可展示的作品，难度和完成度递增：

| 阶段产物 | 作为作品集的卖点 | 适合展示给 |
|---|---|---|
| Phase 1：EIP-712/1271/3009 签名校验合约 + fuzz 测试 | "我懂签名安全和防重放，不是只会调库" | 合约/安全岗 |
| Phase 2：Agent 钱包控制台（session key + paymaster） | "我能给 agent 设计可撤销、有额度的权限边界" | AA / 钱包 / agent 基础设施岗 |
| Phase 3：带 prompt-injection 护栏的 MCP agent | "我知道 agent 动钱时注入攻击=真实损失" | AI agent / 应用岗 |
| Phase 4A/B：x402 付费服务 + A2A 发现 | "我能让两个 agent 自主发现并付费交易" | Web3 × AI 前沿岗 |
| Phase 5：完整 A2A 服务市场 Capstone | 端到端旗舰项目，串起以上全部 | 综合/主打项目 |

**策略**：先把最早能跑通的 MVP v1 闭环（见开篇）做成第一个"完整作品"发出去，之后每深入一个 Phase 就更新它，而不是攒到最后。早发布 = 早拿反馈 = 早暴露简历里能讲的故事。

### 3.2 GitHub 仓库怎么组织

- **Monorepo 优先**：`layer1/ layer2/ ... capstone/` 或按功能 `contracts/ agent/ web/ packages/shared/`，让人一眼看出分层。本课程目录（`layer0/ layer1/ ...`）已经是这个形态，Capstone 时收口成一个干净仓库即可。
- **每个子项目一个小 README**，根目录一个主 README 做导航。
- **提交历史是简历的一部分**：小步、语义化的 commit（`feat: add session key revocation`）比一坨 `update` 有说服力。本课程在 Layer 0 已经强调 commit 习惯，坚持下去。
- **CI 徽章**：把 Layer 8 要求的"安全测试进 CI"配上 GitHub Actions，README 顶部挂一个 ✅ passing 徽章——这是低成本高信号的专业度证明。
- **绝不提交** `.env` / 私钥 / 助记词。仓库里被扒出私钥是减分到负的事故。开 secret scanning。

### 3.3 README 顶部模板（最重要的 30 秒）

主项目 README 开头建议按这个顺序，让人快速接住：

```markdown
# 项目名 —— 一句话说清它是什么
> 一个让 AI agent 用开放标准互相发现、授权、付款、验证身份的 [服务市场 / ...]

[一张架构图或一段 30~60s 的 demo GIF/视频]   ← 放在最显眼处

## 它解决什么
2~3 句：agent 自主交易的真实问题（信任、授权、支付、审计）。

## 技术栈
ERC-4337 session key · MCP · A2A · x402 · EIP-712/3009 · LangGraph.js ...
（用 badge 或一行标签，让人秒认出技术深度）

## 跑起来
3 行以内的 quickstart（测试网，Base Sepolia）。

## 架构 & 关键决策
链接到 docs/，下面 3.4 展开。

## 安全
一句话点出你做了哪些防护（见 3.5）。
```

要点：**架构图/demo 放最上面**。一张清晰的"A2A 发现 → MCP 调用 → AP2 授权 → x402 结算 → ERC-8004 信誉"流程图，比一千字描述都有效——开篇第 0 部分那张分层图和交易流程图可以直接复用、美化。

### 3.4 技术写作：讲"为什么"，不是"是什么"

作品集真正拉开差距的是一篇技术 writeup（可以是 README 的一节、`docs/DECISIONS.md`、或一篇博客）。别复述协议文档，讲你的**决策和踩坑**：

- **为什么选 ERC-4337 而不是 7702？**（路线图 Layer 4 给了判断标准，把它写成你的取舍。）
- **协议不稳定怎么对冲？**——这是本栈的最大特点，也是你的最大加分项。x402/A2A/AP2/ERC-8004 都在快速演进，你做了"可插拔 adapter 设计、把核心架构和草案标准解耦"——把这个讲清楚，体现的是**工程判断力**，正是高级岗最看重的。
- **一次真实的失败排查**：贴一段 trace / 日志，讲"这笔异常支付到底怎么发生的，我怎么从决策审计链里定位的"。Layer 5 强调的可观测性在这里变成讲故事的素材。
- **安全权衡**：你拦住过哪些攻击面（prompt injection、签名重放、伪造 Agent Card）。

一句话原则：**展示判断力 > 展示信息量**。能讲清楚"我为什么没选 X"的人，比能背出"X 是什么"的人值钱得多。

### 3.5 Demo 与可信度

- **录一段 2~3 分钟的 demo 视频/GIF**：连钱包 → agent 发现服务 → 触发付费调用 → 高风险动作弹人工审批 → 前端展示交易 hash / 回执 / 信誉更新。动态演示的说服力远超截图。
- **挂一个 live 测试网 demo**（Vercel + Base Sepolia），README 放链接。能点开就玩的项目，停留时长翻倍。
- **可验证性**：demo 里出现的交易，给出 BaseScan 链接。让人能上链核对，等于把"我真做出来了"焊死。
- **诚实标注状态**：哪些 Phase 已完成、哪些在做、哪些是已知限制。写明 "Phase 4C (AP2) WIP" 比假装全部完成更专业——成熟的工程师都知道项目永远有边界。

### 3.6 把它讲出去

- 一篇带架构图的技术博客（dev.to / Mirror / 个人站），标题点明"用开放标准做 agent-to-agent 支付"这类前沿关键词。
- 简历项目栏：**一句结果 + 一串关键技术 + 一个链接**。例：「构建端到端 Web3 agent 服务市场，集成 ERC-4337 session key 权限、x402 USDC 结算、A2A 发现与 prompt-injection 护栏；[repo] [live demo]」。
- 这个领域 2026 年还很新，**早做 + 讲清楚**本身就是稀缺信号。路线图开篇也说了：这个领域 3 个月一个样——你能拿出一个真跑通的开放栈 A2A 项目，时机就是优势。

> 一句话收尾：路线图保证你"做得出来"，这一节保证你"讲得出去"。两者都做到，才是真正能用的作品集。

---

## 第 4 部分：推荐技术栈速查表

```
语言:        TypeScript (+ 少量 Solidity)
Python:      可选独立服务，仅在 RAG / 视频音频处理 / 本地推理 / 训练微调等重 AI 场景引入
链:          Base（L2，低 gas、x402/USDC 生态成熟）测试网先行 = Base Sepolia
合约:        Solidity + Foundry + OpenZeppelin
链交互:      viem（前端/脚本）+ ethers v6（agent 端，你已在用）
前端:        Next.js + wagmi + viem + Tailwind + shadcn
签名/编码:    viem / ethers / OpenZeppelin，不手写 ECDSA、EIP-712 编码
Agent 大脑:  LangChain.js 必要子集 / 现成 SDK 的 tool calling；复杂流程用 LangGraph.js
模型提供方:   可替换，不绑死某个大模型（DeepSeek / Qwen / Ollama / Gemini / OpenAI / Claude 等）
agent↔工具:  MCP（@modelcontextprotocol/sdk，优先 SDK）
agent↔agent: A2A SDK（Signed Agent Card，优先 SDK）
身份/信誉:   ERC-8004（agent = ERC-721 + Agent Card）
支付授权:    AP2 SDK / A2A x402 extension（Intent/Cart/Payment mandate，W3C VC + ECDSA P-256）
支付结算:    x402 SDK（V2，TS/Go/Python + Express/Next.js 中间件；@x402/evm·@x402/svm）+ 公共 facilitator + USDC（EIP-3009 gasless）
agent 钱包:  ERC-4337 / 7702 + session key + paymaster
             账户实现+权限模块（session key 在这层）：ZeroDev Kernel / Safe 模块 / Alchemy
             bundler+paymaster（账户无关）：Pimlico / permissionless.js
             ⚠️ SimpleAccount 无原生 session key，要 session key 用模块化账户
数据索引:    The Graph / indexer 服务；小规模先读 event
可观测性:    结构化日志（pino）+ trace（LangSmith / OpenTelemetry），agent 决策可回放
关键 EIP:    EIP-712（签名）· EIP-1271（合约验签）· EIP-3009（gasless USDC）
```

---

## 第 5 部分：术语表

| 术语 | 含义 |
|---|---|
| EOA | 外部账户，由私钥控制的普通钱包 |
| Smart Account / AA | 智能合约账户，可编程权限（账户抽象） |
| ERC-4337 | 不改协议的账户抽象标准（UserOp/EntryPoint/Bundler/Paymaster） |
| ERC-7702 | 让 EOA 临时获得智能账户能力（Pectra 升级） |
| Session Key | 有作用域/额度/期限的临时签名密钥，给 agent 用 |
| Paymaster | 替用户付 gas 的合约，实现 gasless |
| EIP-712 | 结构化数据签名标准（你已会） |
| EIP-1271 | 智能合约账户如何验证签名 |
| EIP-3009 | 稳定币 `transferWithAuthorization`，gasless 转账 |
| LangChain.js | LLM 应用工具箱 / 模型适配层，学必要子集即可 |
| LangGraph.js | 基于状态图的 agent workflow 编排，适合分支、审批、checkpoint、多 agent 流程 |
| MCP | Model Context Protocol，agent↔工具 |
| A2A | Agent2Agent，agent↔agent 通信/发现（已发 v1.0） |
| Agent Card | A2A 中描述 agent 能力的清单；Signed 版用 JWS(RFC 7515)+JCS(RFC 8785) 签名防伪 |
| AP2 | Agent Payments Protocol，用签名 mandate 表达支付授权 |
| Mandate | AP2 中的 Intent/Cart/Payment 授权凭证（W3C VC / JSON-LD，ECDSA P-256+SHA-256 签名） |
| x402 | 基于 HTTP 402 的 agent 稳定币支付协议 |
| Facilitator | x402 中负责验证与结算的撮合方 |
| ERC-8004 | Trustless Agents：agent 链上身份/信誉/验证标准（draft ERC，已于 2026-01 主网部署参考实现并多链起量，接口细节仍可能变） |
| USDC / EURC | 主流合规稳定币 |
| Rollup | L2 扩容方案（Optimistic / ZK） |
| W3C VC | Verifiable Credential，可验证凭证 |

---

## 第 6 部分：精选资源

**区块链 / Solidity / Foundry**
- Cyfrin Updraft https://updraft.cyfrin.io ·　Solidity 文档 https://docs.soliditylang.org
- Solidity by Example https://solidity-by-example.org ·　Foundry Book https://book.getfoundry.sh
- evm.codes https://www.evm.codes ·　OpenZeppelin https://docs.openzeppelin.com/contracts

**Web3 客户端 / 前端**
- viem https://viem.sh ·　wagmi https://wagmi.sh ·　ethers v6 https://docs.ethers.org/v6/ ·　The Graph https://thegraph.com/docs

**账户抽象**
- erc4337.io https://www.erc4337.io ·　ZeroDev https://docs.zerodev.app ·　Safe https://docs.safe.global ·　Pimlico https://docs.pimlico.io ·　Alchemy Account Kit https://accountkit.alchemy.com

**AI Agent / 编排层**
- LangChain.js https://js.langchain.com ·　LangGraph.js https://langchain-ai.github.io/langgraphjs/
- Ollama https://ollama.com ·　DeepSeek / Qwen / OpenAI / Gemini / Claude 等模型 API 文档按实际选择
- OWASP LLM Top 10

**Agent 协议**
- MCP https://modelcontextprotocol.io ·　A2A https://a2a-protocol.org · https://github.com/a2aproject/A2A
- ERC-8004 https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098

**Agentic 支付**
- x402 https://www.x402.org · https://github.com/coinbase/x402
- AP2 https://ap2-protocol.org · https://github.com/google-agentic-commerce/AP2 · https://github.com/google-a2a/a2a-x402
- Coinbase CDP/AgentKit https://docs.cdp.coinbase.com/agent-kit

**安全**
- Ethernaut https://ethernaut.openzeppelin.com ·　Damn Vulnerable DeFi https://www.damnvulnerabledefi.xyz ·　Slither https://github.com/crytic/slither

---

## 第 7 部分：参考来源（2026 年现状核实）

- x402 现状与采用（V2 于 2025-12 发布；2026-04 捐给 Linux Foundation 下 x402 Foundation，20+ 成员；数字/“production-ready”说法均需现场核实）：[Coinbase x402 文档（一手）](https://docs.cdp.coinbase.com/x402/welcome) · [github.com/coinbase/x402（一手）](https://github.com/coinbase/x402) · [awesome-x402（SDK/中间件/facilitator 清单）](https://github.com/xpaysh/awesome-x402) · [eco.com x402 解释](https://eco.com/support/en/articles/12328618-x402-protocol-explained-how-ai-agents-pay-onchain)
- A2A v1.0（Signed Agent Card = JWS+JCS、多 binding、版本协商、破坏性变更）：[A2A: What's New in v1.0（一手）](https://a2a-protocol.org/latest/whats-new-v1/) · [A2A v1.0 规范（一手）](https://a2a-protocol.org/latest/specification/) · [github.com/a2aproject/A2A](https://github.com/a2aproject/A2A)
- A2A 与 Linux Foundation：[Linux Foundation: A2A 一周年](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year)
- ERC-8004 状态（**2026-01-29 主网部署参考实现**，多链起量；仍是 draft 应用层 ERC，非硬分叉；"数千身份/多链数字"以一手规范与链上 tracker 为准，二手媒体谨慎对待）：[Ethereum Magicians 讨论帖（一手）](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098) · [CoinDesk: ERC-8004 主网前瞻（2026-01-28）](https://www.coindesk.com/markets/2026/01/28/ethereum-s-erc-8004-aims-to-put-identity-and-trust-behind-ai-agents) · [Forbes: ERC-8004 On Mainnet（2026-02-05）](https://www.forbes.com/sites/digital-assets/2026/02/05/ai-agents-gain-trust-via-ethereum-erc-8004-on-mainnet/)
- AP2 与 x402 扩展（AP2 规范已发布、60+ 机构集成；A2A x402 extension 已 production-ready，Google 联合 Coinbase/EF/MetaMask 开发）：[Google Cloud: 宣布 AP2](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol) · [ap2-protocol.org（一手）](https://ap2-protocol.org) · [github.com/google-a2a/a2a-x402（一手）](https://github.com/google-a2a/a2a-x402) · [Crossmint: 支付协议对比](https://www.crossmint.com/learn/agentic-payments-protocols-compared)
- Coinbase Agentic Wallets / AgentKit：[Coinbase: Introducing Agentic Wallets](https://www.coinbase.com/developer-platform/discover/launches/agentic-wallets) · [docs.cdp.coinbase.com/agent-kit](https://docs.cdp.coinbase.com/agent-kit)

---

> 路线图本身会过时（这个领域 3 个月一个样）。每进入一个新 Layer 前，建议重新核实该协议的最新版本与最佳实践。



帮我写一个Layer 4 — 账户抽象 & Agent 钱包的详细的全套完整教学到layer4文件夹，可以分为多个文件，参考chapter7.md是怎么教学langGraph的。最好有示例代码，知识点介绍，循序渐进的教学内容。
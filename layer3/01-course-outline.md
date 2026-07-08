# Layer 3 课程大纲 - Web3 客户端 & 前端

目标：把 Layer 2 写好的合约变成一个真正可用的“链上任务控制台”。这一层不只是做几个按钮，而是要把钱包连接、网络检查、读链、写链、EIP-712 签名、交易预览、回执等待、事件流、错误状态和安全提示连成一个人类能复核的操作界面。

这一层会直接承接 Layer 2 的成果：

- `AgentTaskEscrowWithPermit`：Layer 3 主线合约，把任务创建、ERC-20 注资、ERC-2612 permit 注资、EIP-712 完成任务、退款和事件流串成一个完整前端练习对象。
- `AccessControlledPaymentVault`：资金池注资、提款、暂停、角色状态读取。
- `TaskIntentVerifier` / `TaskIntentVerifier1271`：EIP-712 任务意图签名与验签。
- `TaskRegistry`：任务创建事件和事件流展示。
- Base Sepolia 部署记录：`../layer2/deployments/base-sepolia.md`。

当前已记录的 Base Sepolia 部署是 `AccessControlledPaymentVault`。`AgentTaskEscrowWithPermit` 还没有部署记录时，模块 1 先把配置位和 ABI 准备好；模块 2 开始读链前，先在 `layer2` 里补部署脚本，或先用本地 `anvil` 练完整流程。不要在前端随手填不明来源的合约地址。

## 学习原则

- 前端只放公开信息：RPC URL、合约地址、ABI 可以公开；私钥、助记词、服务端 secret、完整高权限 API key 不进前端。
- 钱包签名前必须可复核：展示链 ID、目标合约、函数名、金额、代币地址、任务摘要和风险提示。
- 先模拟再写链：优先用 `simulateContract` / wallet 预估能力发现错误，再发真实交易。
- 所有异步状态都要可见：连接中、链不匹配、等待签名、用户拒签、pending、success、failed、RPC 失败都要有明确 UI。
- 链上事实优先：交易成功与否以 receipt / event logs 为准，不只看按钮状态。
- 成熟工具优先：使用 `viem`、`wagmi`、`@tanstack/react-query`、成熟 wallet connector 和 UI 组件，不手写 RPC client、ABI 编解码、钱包连接协议或缓存框架。

## 推荐技术栈

| 关注点 | 推荐工具 | 用来做什么 | 不要做什么 |
| --- | --- | --- | --- |
| 应用框架 | Next.js + React + TypeScript | 构建任务控制台 | 不把链交互散落在组件里 |
| 链交互 | viem | 读合约、模拟交易、解析 logs、签 EIP-712 | 不手写 JSON-RPC 请求 |
| React 链状态 | wagmi | 钱包连接、账户、网络、读链/写链 hooks | 不自己维护钱包底层连接状态 |
| 数据缓存 | @tanstack/react-query | 缓存读链结果、轮询、刷新（wagmi 内置依赖） | 不用一堆手写 `useEffect` 互相触发 |
| 钱包连接 | RainbowKit / ConnectKit / wagmi connectors | 连接 MetaMask、Rabby 等钱包 | 不自己实现 wallet modal |
| RPC 提供商 | 公共 RPC 起步，事件流/轮询阶段换 Alchemy / Infura 自带 key | 稳定读链、避免限流和 block range 报错 | 不在高频轮询和全量 `getLogs` 上硬扛公共 RPC；不把高权限 key 放进前端 |
| UI | Tailwind + shadcn/ui | 表单、表格、弹窗、状态提示 | 不把错误只打进 console |
| 合约源 | Layer 2 ABI + 部署记录 | 确认地址、函数、事件 | 不复制不明来源 ABI |
| 调试 | BaseScan / cast / viem logs | 核对交易、receipt、event | 不只依赖钱包弹窗 |

## 里程碑项目

做一个最小“链上任务控制台”，用于北极星项目的前端操作面。

最终流程：

```text
连接钱包
  -> 检查 Base Sepolia 网络
  -> 读取账户余额 / token 余额 / escrow 任务状态
  -> 预览 fundTask 或 task intent
  -> 签 EIP-712 任务意图
  -> 发起合约交易
  -> 等待 receipt
  -> 展示交易历史与事件流
```

建议目录：

```text
layer3/
  01-course-outline.md
  task-console/
    package.json
    .env.example
    src/
      app/
        providers.tsx
      components/
      config/
        chains.ts
        contracts.ts
        wagmi.ts
      lib/
        clients.ts
        format.ts
        errors.ts
      hooks/
        useEscrow.ts
        useTaskIntent.ts
        useEventFeed.ts
      abi/
        AgentTaskEscrowWithPermit.ts
        PermitToken.ts
        erc20.ts
```

说明：课程大纲先定义学习顺序；真正开始写代码时，再在 `task-console/` 里创建 Next.js 项目。

## 模块 1：前端项目脚手架与链配置

目标：准备一个类型安全、配置清楚、不会误连主网的前端工程。

这一模块不是为了“先把页面做漂亮”，而是先把 Web3 前端的地基打稳：

```text
Next.js 项目
  -> 环境变量边界
  -> 链配置
  -> 合约地址和部署块
  -> ABI 来源
  -> 钱包连接依赖
  -> 最小质量命令
```

模块 1 做完后，你应该能回答三个问题：

- 这个前端当前只允许连哪条链？
- 主线合约 `AgentTaskEscrowWithPermit` 的地址、部署块、ABI 从哪里来？
- 哪些配置可以进浏览器，哪些绝对不能进浏览器？

学什么：

### 1. Next.js 项目选择

- **App Router**：使用 `src/app/` 结构，页面从 `src/app/page.tsx` 开始，根布局在 `src/app/layout.tsx`。
- **TypeScript**：所有地址、chain id、ABI、合约配置都尽量获得类型约束，减少运行时才发现函数名/参数错。
- **ESLint**：先保留 Next.js 默认规则，后面写 hooks 和组件时能尽早发现明显问题。
- **Tailwind CSS**：作为 UI 基础，后续配合 shadcn/ui 做表单、状态提示、表格和弹窗。
- **`src/` 目录**：业务代码集中放在 `src/`，配置、hooks、组件、ABI 不散在项目根目录。
- **`@/*` import alias**：后面统一用 `@/config/contracts`、`@/abi/...` 这种路径，不写一串 `../../../`。

### 2. 环境变量边界

前端项目里要非常清楚 `.env.example`、`.env.local` 和 `NEXT_PUBLIC_` 的区别。

| 文件 / 前缀 | 用途 | 能不能提交 | 会不会进浏览器 |
| --- | --- | --- | --- |
| `.env.example` | 给别人看的配置模板，只放变量名和公开默认值 | 可以 | 否 |
| `.env.local` | 本机真实配置 | 不提交 | 取决于变量名前缀 |
| `NEXT_PUBLIC_*` | 浏览器可读取的公开配置 | 变量名可以提交，真实值要看敏感度 | 会 |
| 非 `NEXT_PUBLIC_*` | 只给 Next.js 服务端读取 | 不提交真实值 | 不会直接进浏览器 |

本模块里这些值可以公开：

- Base Sepolia 公共 RPC：`https://sepolia.base.org`
- chain id：`84532`
- `AgentTaskEscrowWithPermit` / 测试 ERC-20 / USDC 等合约地址
- 合约部署块，也就是后续事件流的起点
- ABI
- 区块浏览器 URL

这些值不能放进前端：

- 私钥
- 助记词
- 后端数据库 URL
- 后端服务 token
- 高权限 RPC key
- 不做域名/额度限制的 provider key

如果使用 Alchemy / Infura / QuickNode 这类自带 key 的 RPC URL，只要写成 `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`，它就会暴露在浏览器里。这个 key 必须做域名限制、额度限制和最小权限；如果不能公开，就需要后端代理。

### 3. 链配置

Layer 3 主线只连 Base Sepolia。

| 字段 | 值 | 说明 |
| --- | --- | --- |
| chain name | Base Sepolia | 本层测试网 |
| chain id | `84532` | 所有签名和交易检查都围绕它 |
| native token | ETH | 用来支付测试网 gas |
| public RPC | `https://sepolia.base.org` | 起步够用 |
| explorer | `https://sepolia.basescan.org` | 展示 tx / address / block 链接 |

前端配置里不要写“默认连当前钱包网络”。正确心智是：

```text
应用只支持 Base Sepolia
  -> 钱包不在 84532 就提示切换
  -> chainId 不对就禁用签名和写链
```

### 4. 合约配置

Layer 3 主线合约是 `AgentTaskEscrowWithPermit`。它把 Layer 2 已学内容合到一个前端可操作的业务对象里：

```text
createTask
  -> fundTask / fundTaskWithPermit
  -> sign EIP-712 TaskIntent
  -> completeTask
  -> refundTask / cancelTask
  -> read events
```

合约配置至少包含四类信息：

| 信息 | 例子 | 用途 |
| --- | --- | --- |
| 合约名 | `AgentTaskEscrowWithPermit` | UI 展示和调试 |
| address | 部署后得到的 `0x...` 地址 | `readContract` / `writeContract` 目标 |
| deployBlock | 部署交易所在 block | 事件流从这里开始扫 |
| explorer URL | `https://sepolia.basescan.org/address/...` | 页面跳转核对链上事实 |

配置建议集中放在：

```text
src/config/chains.ts      链 ID、RPC、explorer
src/config/contracts.ts   escrow / token 地址、部署块、角色 ID、常用 explorer 链接
src/config/wagmi.ts       wagmi / RainbowKit 连接配置
```

不要在组件里散写地址。组件只应该 import 配置：

```ts
import { CONTRACTS } from "@/config/contracts";
```

### 5. ABI 来源

ABI 是前端调用合约的“接口说明书”。ABI 错了，前端可能会出现：

- 函数名不存在。
- 参数顺序错。
- 类型错，比如 `uint256` 被当成 `string`。
- 事件解析失败。

本项目 ABI 只从 Layer 2 来。主线至少同步这两个：

```bash
cd /home/lenovo/solidity-course/ata/layer2
forge inspect src/AgentTaskEscrowWithPermit.sol:AgentTaskEscrowWithPermit abi
forge inspect src/PermitToken.sol:PermitToken abi
```

合约接口一改，前端 ABI 就要重新同步。不要从区块浏览器随便复制一份“不知道是不是当前源码”的 ABI。

ABI 文件建议这样放：

```text
src/abi/AgentTaskEscrowWithPermit.ts
src/abi/PermitToken.ts
src/abi/erc20.ts
```

每个 ABI 文件导出一个 `as const` 的数组，方便 viem / wagmi 做类型推断：

```ts
export const agentTaskEscrowAbi = [
  // ...
] as const;
```

### 6. 配置文件职责

建议一开始就把职责分清，不然 Layer 3 写到一半会变成“页面里到处都是地址、ABI 和 RPC”。

| 文件 | 负责什么 | 不放什么 |
| --- | --- | --- |
| `src/config/chains.ts` | Base Sepolia 的 chain id、RPC、explorer | 合约 ABI |
| `src/config/contracts.ts` | escrow 地址、token 地址、部署块、角色 ID | React 组件状态 |
| `src/config/wagmi.ts` | wagmi / RainbowKit config | 业务流程 |
| `src/abi/*.ts` | ABI 常量 | 合约地址 |
| `src/lib/format.ts` | 地址缩写、金额格式化 | 链请求 |
| `src/lib/errors.ts` | 用户拒签、链错误、revert 的分类 | UI 组件 |

### 7. 模块 1 不做什么

这一模块先不写复杂 UI，也不急着发交易。

暂时不做：

- `approve` / `fundTask`
- `fundTaskWithPermit`
- EIP-712 签名
- 事件流
- 任务时间线
- 账户抽象
- 后端 API

模块 1 只要求项目能启动、配置清楚、依赖正确、地址和 ABI 有来源、不会误连主网。

操作练习：

1. 在 `layer3/task-console` 创建 Next.js 项目。

```bash
cd /home/lenovo/solidity-course/ata/layer3
pnpm create next-app@latest task-console --ts --eslint --tailwind --app --src-dir --import-alias "@/*"
```

如果 CLI 继续提问，建议这样选：

```text
TypeScript: Yes
ESLint: Yes
Tailwind CSS: Yes
src/ directory: Yes
App Router: Yes
import alias: @/*
```

2. 安装 Web3 前端依赖。

```bash
cd /home/lenovo/solidity-course/ata/layer3/task-console
pnpm add viem@2 wagmi@2 @tanstack/react-query @rainbow-me/rainbowkit
```

不要把这里的 `wagmi@2` 省掉。当前 `wagmi` 最新大版本可能已经高于 RainbowKit 支持范围；RainbowKit 2.x 仍要求 `wagmi ^2.9.0`。如果直接写 `pnpm add wagmi @rainbow-me/rainbowkit`，pnpm 可能会装到 wagmi 3.x，然后出现 peer dependency 冲突。

如果使用 shadcn/ui，再按项目需要初始化：

```bash
pnpm dlx shadcn@latest init
```

3. 固定 Next.js 使用 webpack，再跑一次空项目。

当前课程先不用 Turbopack。`create-next-app` 生成的 Next.js + Tailwind/PostCSS 组合在部分环境下会让 Turbopack 在 `globals.css` 阶段 panic，表现为本地页面 500 或 `pnpm build` 失败。为了让模块 1 的重点回到链配置和钱包连接，先把 `package.json` 脚本改成显式使用 webpack：

```json
{
  "scripts": {
    "dev": "next dev --webpack -H 0.0.0.0",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint"
  }
}
```

然后再验收空项目：

```bash
pnpm lint
pnpm build
pnpm dev
```

能打开本地页面后，再继续 Web3 配置。这样如果后面出错，你能分清是 Next.js 脚手架问题，还是 wagmi / ABI / 环境变量问题。

4. 准备公开配置模板。

```env
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL=https://sepolia.basescan.org
NEXT_PUBLIC_WC_PROJECT_ID=
NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS=
NEXT_PUBLIC_AGENT_TASK_ESCROW_DEPLOY_BLOCK=
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS=
NEXT_PUBLIC_PERMIT_TOKEN_DEPLOY_BLOCK=
```

说明：

- `NEXT_PUBLIC_WC_PROJECT_ID` 是 WalletConnect project id；RainbowKit 连接 WalletConnect 钱包时需要。
- 如果暂时只用浏览器注入钱包（MetaMask / Rabby），也建议先保留这个配置位，后面接 RainbowKit 时不改结构。
- `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS` 是 Layer 3 主线合约地址；部署到 Base Sepolia 后再填写。
- `NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS` 是可选测试 ERC-20Permit 地址；如果先用真实测试网 USDC 练普通 `approve + fundTask`，可以暂时留空。
- `*_DEPLOY_BLOCK` 是后续事件流的起点，不要省略。
- 还没有部署的合约地址先留空，不要填假地址。

5. 准备 `.gitignore`。

确认至少包含：

```gitignore
.env
.env.local
.env.*.local
node_modules
.next
```

`.env.example` 可以提交，`.env.local` 不提交。

6. 从 Layer 2 同步 ABI。

```bash
cd /home/lenovo/solidity-course/ata/layer2
forge inspect src/AgentTaskEscrowWithPermit.sol:AgentTaskEscrowWithPermit abi
forge inspect src/PermitToken.sol:PermitToken abi
```

把输出整理到 `task-console/src/abi/`。合约接口变更后，必须重新导出 ABI，并同步更新前端调用。

如果只需要普通 ERC-20 读余额 / 授权，可以在前端维护一个很小的 `erc20Abi`，只包含：

```text
symbol()
decimals()
balanceOf(address)
allowance(address,address)
approve(address,uint256)
```

7. 建立配置文件。

```text
src/config/chains.ts
src/config/contracts.ts
src/config/wagmi.ts
src/abi/AgentTaskEscrowWithPermit.ts
src/abi/PermitToken.ts
src/abi/erc20.ts
```

建议先写出配置骨架：

```ts
// src/config/chains.ts
export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BASE_SEPOLIA = {
  id: BASE_SEPOLIA_CHAIN_ID,
  name: "Base Sepolia",
  rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL,
} as const;
```

```ts
// src/config/contracts.ts
export const CONTRACTS = {
  escrow: {
    name: "AgentTaskEscrowWithPermit",
    address: process.env.NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS,
    deployBlock: BigInt(process.env.NEXT_PUBLIC_AGENT_TASK_ESCROW_DEPLOY_BLOCK ?? "0"),
  },
  usdc: {
    name: "Base Sepolia USDC",
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS,
  },
  permitToken: {
    name: "Permit Token",
    address: process.env.NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS,
    deployBlock: BigInt(process.env.NEXT_PUBLIC_PERMIT_TOKEN_DEPLOY_BLOCK ?? "0"),
  },
} as const;
```

后面正式写代码时，再把 `address` 收窄成 viem 的 `` `0x${string}` `` 类型，并加启动时校验。模块 1 先把职责和来源理清。

8. 写一份模块 1 自查记录。

在 `layer3/task-console/README.md` 或自己的学习笔记里记录：

```text
当前支持链：Base Sepolia，chainId = 84532
主线合约：AgentTaskEscrowWithPermit
escrow 地址：未部署 / 0x...
escrow 部署块：未部署 / block number
普通注资 token：Base Sepolia USDC / 自己部署的测试 ERC-20
permit 注资 token：PermitToken，未部署 / 0x...
ABI 来源：layer2 forge inspect
RPC：公共 RPC / 自带 key RPC
哪些配置会暴露到浏览器：所有 NEXT_PUBLIC_* 变量
```

验收：

- 所有合约地址集中在 `contracts.ts`。
- 合约部署块和合约地址一起记录，用于后续事件流查询。
- `AgentTaskEscrowWithPermit` 和 `PermitToken` ABI 来自本仓库 Layer 2 的 artifact 或 `forge inspect`，不是手抄未知 ABI。
- 未部署的合约配置保持空值，并在 UI / 代码里明确阻止读写，不填假地址。
- `chainId` 明确写成 Base Sepolia，不靠默认网络。
- 前端没有任何私钥、助记词、后端 secret 或高权限 RPC key。
- `.env.local` 被 `.gitignore` 忽略，`.env.example` 可以安全提交。
- `README.md` 或学习笔记里能说明每个公开配置的来源。
- `pnpm lint` 和 `pnpm build` 能通过。

## 模块 2：viem 基础读链

目标：不连接钱包，只用 `viem` 的 public client 读取 Base Sepolia 上的公开状态。

这一模块解决一个很基础但很关键的问题：

```text
前端不依赖钱包
  -> 能确认 RPC 可用
  -> 能读取区块高度
  -> 能读取 ERC-20 基础信息和余额
  -> 能读取 escrow 合约公开状态
  -> 能把 bigint / 地址 / 状态枚举展示成人能看懂的内容
```

模块 2 暂时不做连接钱包、不做签名、不发交易、不监听事件。它的重点是把“只读链上事实”跑通。

模块 2 做完后，你应该能回答：

- public client 和 wallet client 有什么区别？
- 什么读取可以不连接钱包完成？
- ERC-20 的 `decimals` 为什么必须先读？
- `tasks(taskId)` 返回的链上结构应该怎么格式化？
- RPC 失败、地址缺失、合约地址错误时，页面应该怎么提示？

学什么：

- `createPublicClient`。
- `http` transport。
- `getBlockNumber` / `getBalance`。
- `readContract`。
- ERC-20 `balanceOf` / `decimals` / `symbol`。
- Escrow 的 `taskCount()`、`paused()`、`PAUSER_ROLE()`、`hasRole()`、`tasks(taskId)`。
- bigint 格式化：`formatUnits`。
- 地址校验：`isAddress`。
- 读链错误分类：配置缺失、RPC 失败、合约地址错误、ABI 不匹配、revert。
- React 里手动触发异步读取：loading / error / data / refresh。

前置条件：

- `src/abi/AgentTaskEscrowWithPermit.ts` 已经从 Layer 2 导出。
- `src/abi/erc20.ts` 已经有最小 ERC-20 ABI。
- `.env.local` 至少有 `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL`、`NEXT_PUBLIC_CHAIN_ID`、`NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL`。
- 如果要读 escrow，必须先填 `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS`。
- 如果 escrow 还没部署，模块 2 也可以先读区块高度、USDC 信息、任意地址的 USDC 余额。

推荐文件落点：

```text
src/lib/clients.ts       创建 viem publicClient
src/lib/format.ts        格式化金额、地址、任务状态
src/lib/readers.ts       封装 ERC-20 / escrow 读取函数
src/app/page.tsx         先做一个简洁的读链控制台
```

操作练习：

1. 创建公共客户端。

```ts
// src/lib/clients.ts
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
});
```

先用它读一个最小健康检查：

```ts
const blockNumber = await publicClient.getBlockNumber();
```

页面上能显示当前区块高度，说明 RPC、链配置和前端调用链路先通了。

2. 准备格式化工具。

```ts
// src/lib/format.ts
import { formatUnits, isAddress } from "viem";

export function requireAddress(value: string | undefined, label: string): `0x${string}` {
  if (!value || !isAddress(value)) {
    throw new Error(`${label} is missing or invalid`);
  }

  return value;
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value: bigint, decimals: number) {
  return formatUnits(value, decimals);
}

export function formatTaskStatus(status: number) {
  return ["Created", "Funded", "Completed", "Refunded", "Cancelled"][status] ?? `Unknown(${status})`;
}
```

注意：

- 合约地址、账户地址都先用 `isAddress` 校验。
- token 金额不要直接除以 `10 ** 6`，先读 `decimals`，再用 `formatUnits`。
- `bigint` 不要直接丢进 `JSON.stringify` 或复杂 UI 状态里，展示前先格式化。

3. 读取 ERC-20 基础信息。

先读 Base Sepolia USDC，或者自己部署的 `PermitToken`：

```ts
// src/lib/readers.ts
import { erc20Abi } from "@/abi/erc20";
import { publicClient } from "@/lib/clients";

export async function readErc20Summary(token: `0x${string}`, owner?: `0x${string}`) {
  const [symbol, decimals] = await Promise.all([
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "symbol",
    }),
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "decimals",
    }),
  ]);

  const balance =
    owner === undefined
      ? undefined
      : await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [owner],
        });

  return { symbol, decimals, balance };
}
```

页面要展示：

- token 地址。
- `symbol`。
- `decimals`。
- 用户输入地址的 `balanceOf(address)`。
- 原生 ETH 余额，可以用 `publicClient.getBalance({ address })`。

4. 读取 escrow 基本状态。

要展示：

- escrow 地址。
- `taskCount`。
- paused 状态。
- 任意输入地址是否有 `PAUSER_ROLE`。
- escrow 持有的 token 余额。
- 如果已有任务 ID，读取 `tasks(taskId)` 里的 client、operator、token、amount、service、status。

示例封装：

```ts
// src/lib/readers.ts
import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { erc20Abi } from "@/abi/erc20";
import { publicClient } from "@/lib/clients";

export async function readEscrowSummary(
  escrow: `0x${string}`,
  token: `0x${string}`,
  roleAccount?: `0x${string}`,
) {
  const [taskCount, paused, pauserRole, tokenBalance] = await Promise.all([
    publicClient.readContract({
      address: escrow,
      abi: agentTaskEscrowAbi,
      functionName: "taskCount",
    }),
    publicClient.readContract({
      address: escrow,
      abi: agentTaskEscrowAbi,
      functionName: "paused",
    }),
    publicClient.readContract({
      address: escrow,
      abi: agentTaskEscrowAbi,
      functionName: "PAUSER_ROLE",
    }),
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [escrow],
    }),
  ]);

  const isPauser =
    roleAccount === undefined
      ? undefined
      : await publicClient.readContract({
          address: escrow,
          abi: agentTaskEscrowAbi,
          functionName: "hasRole",
          args: [pauserRole, roleAccount],
        });

  return { taskCount, paused, pauserRole, isPauser, tokenBalance };
}
```

这里的“任意输入地址”可以先手动输入 deployer 地址。模块 3 接钱包后，再把它替换成当前钱包账户。

5. 读取单个任务。

`AgentTaskEscrowWithPermit` 的 `tasks(taskId)` 来自 Solidity public mapping：

```solidity
struct Task {
    address client;
    address operator;
    address token;
    uint256 amount;
    string service;
    string resultURI;
    uint256 refundAfter;
    TaskStatus status;
}
```

前端展示时至少做三件事：

- `amount` 按任务 token 的 `decimals` 格式化。
- `refundAfter` 从 Unix timestamp 格式化成本地时间。
- `status` 从数字映射成 `Created / Funded / Completed / Refunded / Cancelled`。

示例：

```ts
export async function readTask(escrow: `0x${string}`, taskId: bigint) {
  return publicClient.readContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "tasks",
    args: [taskId],
  });
}
```

如果输入的 `taskId` 是 `0`，或者大于 `taskCount`，页面要直接提示“任务不存在”，不要把错误留给 RPC 或合约 revert。

6. 做一个最小读链控制台。

页面先不要追求复杂设计，模块 2 的 UI 只需要帮你看清链上状态：

```text
RPC 状态
  当前链：Base Sepolia
  当前区块：123456
  手动刷新按钮

Token Reader
  token 地址
  owner 地址
  symbol / decimals / balance / ETH balance

Escrow Reader
  escrow 地址
  taskCount / paused / escrow token balance
  role account 是否 PAUSER_ROLE

Task Reader
  taskId 输入框
  client / operator / token / amount / service / resultURI / refundAfter / status
```

这一页可以先用普通 `useState` 和按钮触发读取。不要在 render 阶段直接发请求，也不要为了模块 2 提前上 `useReadContract`，那是模块 4 的内容。

7. 写可读错误。

最少区分这几类：

| 错误 | 常见原因 | UI 应该提示什么 |
| --- | --- | --- |
| RPC URL 缺失 | `.env.local` 没填或改完没重启 dev server | 缺少 `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` |
| 地址为空 | 合约还没部署或 env 留空 | 先部署合约，或暂时跳过 escrow 读取 |
| 地址格式错误 | 少写字符、不是 `0x` 开头 | 请输入合法 EVM 地址 |
| 合约调用失败 | 地址不是该合约、ABI 不匹配、链错了 | 检查合约地址、chain id 和 ABI 来源 |
| RPC 限流 | provider 限制或网络不稳定 | 稍后重试，或换更稳定 RPC |

`.env.local` 修改后，要重启 `pnpm dev`。Next.js 不保证运行中的 dev server 会自动重新注入所有环境变量。

验收：

- 页面能展示当前 Base Sepolia 区块高度。
- 页面能读取 ERC-20 `symbol`、`decimals`、指定地址余额和 ETH 余额。
- escrow 地址为空时，页面清楚提示“未配置”，不会崩溃。
- escrow 地址存在时，页面能读取 `taskCount`、`paused`、escrow token balance。
- 输入一个地址后，页面能读取它是否有 `PAUSER_ROLE`。
- 输入合法 taskId 后，页面能展示任务详情。
- `amount`、`refundAfter`、`status` 都被格式化成人能读懂的内容。
- RPC 失败、地址错误、ABI 不匹配时有可读错误，不是空白页。
- 所有读取都有手动刷新入口。
- `pnpm lint` 和 `pnpm exec tsc --noEmit` 通过。

本模块不做：

- 钱包连接。
- `approve`。
- `createTask` / `fundTask`。
- EIP-712 签名。
- 交易发送。
- 事件流扫描。
- 数据库存储。

复习题：

1. 为什么不连接钱包也能读 `symbol()`、`balanceOf()`、`taskCount()`？
2. `publicClient` 负责什么？它为什么不能发需要签名的交易？
3. 为什么 token 金额不能直接当普通数字显示？
4. `decimals`、`formatUnits`、`bigint` 三者是什么关系？
5. 如果 `readContract` 失败，怎么判断是 RPC 问题、地址问题还是 ABI 问题？
6. 为什么模块 2 暂时不用 `useReadContract`？
7. `tasks(taskId)` 返回的 `status = 2` 代表什么？
8. `.env.local` 修改后为什么通常要重启 dev server？

说明：这一模块用裸 `publicClient.readContract` 把读链逻辑跑通、看清底层。模块 4 会把这些读取迁到 wagmi + react-query 的 hooks，拿到自动缓存、随账户/链切换刷新和轮询能力，不用自己写一堆 `useEffect`。

## 模块 3：钱包连接与网络状态

目标：让用户安全连接测试钱包，并在网络错误时禁止继续操作。

这一模块不读合约、不发交易、不用 ABI。它只解决一个问题：

```text
用户是谁？
钱包连上了吗？
当前在哪条链？
是不是 Base Sepolia？
如果链错了，能不能一键切过去？
链不对时，后续写链入口是否全部禁用？
```

模块 3 做完后，你应该能回答：

- 为什么连接钱包不等于可以写链？
- 为什么 chain id 必须显式检查？
- `WagmiProvider`、`QueryClientProvider`、`RainbowKitProvider` 分别负责什么？
- `useAccount`、`useChainId`、`useSwitchChain` 各读什么状态？
- 为什么测试钱包要和主钱包隔离？

学什么：

- wagmi config 与 connector（用 RainbowKit / ConnectKit，不手写 wallet modal）。
- `WagmiProvider` + `QueryClientProvider` 的挂载方式（react-query 是 wagmi 的内置依赖）。
- `useAccount`。
- `useChainId`。
- `useSwitchChain`。
- 连接断开、账户切换、链切换的 UI 状态。
- 测试钱包和主钱包隔离。

前置条件：

- 模块 1 的依赖已经装好：`wagmi@2`、`viem@2`、`@tanstack/react-query`、`@rainbow-me/rainbowkit`。
- `src/config/chains.ts` 已经有 Base Sepolia 的 chain id。
- `.env.local` 至少有：

```env
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL=https://sepolia.basescan.org
NEXT_PUBLIC_WC_PROJECT_ID=
```

说明：

- `NEXT_PUBLIC_WC_PROJECT_ID` 是 WalletConnect project id，RainbowKit 默认配置会用到。
- 如果只想先测浏览器注入钱包，可以先理解 wagmi provider 结构；但正式接 RainbowKit 时建议准备 WalletConnect project id。
- 这一模块不需要合约地址，也不需要 ABI。

推荐文件落点：

```text
src/config/wagmi.ts          wagmi / RainbowKit 配置
src/app/providers.tsx        客户端 Provider 边界
src/components/wallet-status.tsx
src/app/layout.tsx           挂载 Providers，引入 RainbowKit CSS
src/app/page.tsx             展示钱包和网络状态
```

操作练习：

1. 配置 wagmi（含 RainbowKit 默认 connector）。

```ts
// src/config/wagmi.ts
import { http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!walletConnectProjectId) {
  throw new Error("Missing NEXT_PUBLIC_WC_PROJECT_ID");
}

export const wagmiConfig = getDefaultConfig({
  appName: "Task Console",
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
```

这里的重点：

- `chains: [baseSepolia]` 表示应用只支持 Base Sepolia。
- `transports` 指定 Base Sepolia 用哪个 RPC。
- `ssr: true` 是为了配合 Next.js App Router。
- `projectId` 缺失时直接报错，比钱包弹窗运行时半坏更容易排查。

2. 在根布局挂载 provider。

```tsx
// src/app/providers.tsx
"use client";

import type { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { wagmiConfig } from "@/config/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

在 `src/app/layout.tsx` 挂载：

```tsx
import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "Task Console",
  description: "Base Sepolia task console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

注意：

- `providers.tsx` 必须是 client component，因为 wagmi / RainbowKit 用 React context 和 hooks。
- `layout.tsx` 可以继续是 server component，只负责包一层 `<Providers>`。
- RainbowKit 样式要引入一次。

3. 建立钱包状态组件。

```tsx
// src/components/wallet-status.tsx
"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";

export function WalletStatus() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const isWrongChain = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;

  return (
    <section>
      <ConnectButton showBalance={false} />

      <dl>
        <div>
          <dt>连接状态</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>当前地址</dt>
          <dd>{address ?? "-"}</dd>
        </div>
        <div>
          <dt>当前 chain ID</dt>
          <dd>{isConnected ? chainId : "-"}</dd>
        </div>
      </dl>

      {isWrongChain ? (
        <button
          type="button"
          onClick={() => switchChain({ chainId: BASE_SEPOLIA_CHAIN_ID })}
          disabled={isPending}
        >
          切换到 Base Sepolia
        </button>
      ) : null}
    </section>
  );
}
```

这一段先只展示状态，不做读链。

要看懂：

- `useAccount()` 关心钱包是否连接、当前地址是什么。
- `useChainId()` 关心钱包当前在哪条链。
- `useSwitchChain()` 用来请求钱包切换网络。
- `ConnectButton` 负责连接 / 断开 / 账户展示，不自己手写钱包弹窗。

4. 页面顶部显示账户状态。

在 `src/app/page.tsx` 里只做组合：

```tsx
import { WalletStatus } from "@/components/wallet-status";

export default function Home() {
  return (
    <main>
      <h1>钱包连接与网络状态</h1>
      <WalletStatus />
    </main>
  );
}
```

要展示：

- 连接 / 断开按钮。
- 当前地址。
- 当前 chain ID。
- 目标 chain ID：`84532`。
- 网络错误提示。
- 一键切换到 Base Sepolia。
- 写链是否允许。

写链状态的判断可以先写成一个布尔值：

```ts
const canWrite = isConnected && chainId === BASE_SEPOLIA_CHAIN_ID;
```

后续所有写链按钮都必须遵守这个条件：

```text
未连接钱包       -> 禁用
连接了但链不对   -> 禁用
连接且链是 84532 -> 才允许继续
```

5. 测试账户切换和链切换。

手动测试这些场景：

```text
未连接钱包
连接 MetaMask / Rabby
从 Base Sepolia 切到其他链
从其他链切回 Base Sepolia
切换钱包账户
断开连接
刷新页面后重新连接
```

每个状态都应该在页面上可见。

如果钱包不认识 Base Sepolia，需要先在钱包里添加网络，或让 `switchChain` 请求钱包添加 / 切换。

Base Sepolia 关键值：

| 字段 | 值 |
| --- | --- |
| chain id | `84532` |
| name | Base Sepolia |
| explorer | `https://sepolia.basescan.org` |
| native token | ETH |

6. 测试钱包隔离。

建议准备一个专门的测试钱包：

```text
只放测试网 ETH
只连本地开发页面
不放主网资产
不复用主钱包助记词
```

模块 3 开始，浏览器钱包会参与交互。即使当前还不发交易，也要养成隔离习惯。

7. 模块 3 暂时不做什么。

暂时不做：

```text
useReadContract
readContract
approve
writeContract
签名
事件流
数据库
合约表单
```

这些后面再接。

模块 3 的边界是：

```text
钱包连接
账户状态
网络状态
链错误阻断
测试钱包安全习惯
```

常见问题：

#### `useAccount` 报 provider 错误

通常是组件没有包在：

```tsx
<WagmiProvider>
  <QueryClientProvider>
    <RainbowKitProvider>
      {children}
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

检查 `src/app/layout.tsx` 是否挂载了 `Providers`。

#### `NEXT_PUBLIC_WC_PROJECT_ID` 缺失

RainbowKit 默认配置需要 WalletConnect project id。

解决：

```text
去 WalletConnect Cloud 创建 project id
填入 .env.local
重启 pnpm dev
```

#### 钱包连上了，但显示链不对

常见混淆：

```text
Ethereum Sepolia: 11155111
Base Mainnet: 8453
Base Sepolia: 84532
```

本课程只允许：

```text
84532
```

#### 改了 .env.local 没生效

重启：

```bash
pnpm dev
```

Next.js dev server 不保证运行中自动更新所有环境变量。

验收：

- 未连接钱包时，写链按钮禁用。
- chain ID 不是 `84532` 时，签名和交易按钮全部禁用。
- 用户切换账户后，当前地址和连接状态会刷新。
- 页面能显示连接状态、当前地址、当前 chain ID。
- 钱包连到错误链时，页面有明确提示。
- 一键切换到 Base Sepolia 可用。
- 断开钱包后，页面状态回到未连接。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 通过。

## 模块 4：用 wagmi + react-query 重做读链

目标：把模块 2 的裸读链迁到 React hooks，拿到缓存、自动刷新和轮询，不再手写一堆 `useEffect`。

这一模块承接模块 2 和模块 3：

```text
模块 2：知道怎么用 publicClient.readContract 读链
模块 3：知道当前账户和当前 chainId
模块 4：把读链迁到 wagmi hooks，让数据随账户 / 链 / 刷新自动更新
```

模块 4 做完后，你应该能回答：

- `useReadContract` 和 `publicClient.readContract` 有什么区别？
- 为什么读链 hook 必须在 Provider 里面用？
- `enabled`、`staleTime`、`refetchInterval` 分别解决什么问题？
- 为什么账户切换后，余额和角色状态应该自动刷新？
- 写链成功后，为什么要 `invalidateQueries`？
- 什么时候继续用裸 `publicClient`，什么时候用 wagmi hook？

学什么：

- `useReadContract`：单个合约读取。
- `useReadContracts`：一次批量读多个调用，减少请求。
- react-query 的 `queryKey` / 缓存 / `staleTime` / `refetchInterval`。
- 随账户和链切换自动刷新（hook 依赖 `useAccount` / `useChainId`）。
- 手动刷新：`refetch` 与 `queryClient.invalidateQueries`。
- `useBalance` 读取原生 ETH 余额。
- 什么时候仍然用裸 `publicClient`（脚本、事件解析、一次性读取）。

前置条件：

- 模块 3 的 `Providers` 已经挂好。
- 钱包能连接，并能读到当前 `address` 和 `chainId`。
- ABI 文件保留在：

```text
src/abi/AgentTaskEscrowWithPermit.ts
src/abi/PermitToken.ts
src/abi/erc20.ts
```

- `.env.local` 里已经准备好：

```env
NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS=
NEXT_PUBLIC_AGENT_TASK_ESCROW_DEPLOY_BLOCK=
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS=
NEXT_PUBLIC_PERMIT_TOKEN_DEPLOY_BLOCK=
```

说明：

- `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS` 必须是 `AgentTaskEscrowWithPermit` 地址。
- `NEXT_PUBLIC_USDC_ADDRESS` / `NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS` 是 ERC-20 token 地址。
- 地址可以先留空，但 hook 必须用 `enabled` 阻止无效读取。
- 模块 4 不发交易，只读链。

推荐文件落点：

```text
src/config/contracts.ts      合约地址和部署块
src/lib/format.ts            地址、金额、状态、时间格式化
src/hooks/useToken.ts        token 信息、余额、allowance
src/hooks/useEscrow.ts       escrow 状态、角色、任务详情
src/components/read-panel.tsx
src/app/page.tsx             组合钱包状态和读链面板
```

操作练习：

1. 恢复合约配置。

```ts
// src/config/contracts.ts
import { isAddress } from "viem";

function optionalAddress(value: string | undefined): `0x${string}` | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }

  return value;
}

function optionalBlock(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return BigInt(value);
}

export const CONTRACTS = {
  escrow: {
    name: "AgentTaskEscrowWithPermit",
    address: optionalAddress(process.env.NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS),
    deployBlock: optionalBlock(process.env.NEXT_PUBLIC_AGENT_TASK_ESCROW_DEPLOY_BLOCK),
  },
  usdc: {
    name: "Base Sepolia USDC",
    address: optionalAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS),
  },
  permitToken: {
    name: "Permit Token",
    address: optionalAddress(process.env.NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS),
    deployBlock: optionalBlock(process.env.NEXT_PUBLIC_PERMIT_TOKEN_DEPLOY_BLOCK),
  },
} as const;
```

注意：

- 不要在配置里返回假地址。
- 地址为空时返回 `undefined`，由 hook 的 `enabled` 控制是否发请求。
- `.env.local` 修改后重启 `pnpm dev`。

2. 准备格式化工具。

```ts
// src/lib/format.ts
import { formatUnits } from "viem";

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value: bigint, decimals: number) {
  return formatUnits(value, decimals);
}

export function formatTaskStatus(status: number) {
  return ["Created", "Funded", "Completed", "Refunded", "Cancelled"][status] ?? `Unknown(${status})`;
}

export function formatUnixTimestamp(timestamp: bigint) {
  if (timestamp === BigInt(0)) {
    return "-";
  }

  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}
```

3. 读取原生 ETH 余额。

```ts
// src/hooks/useToken.ts
import { useBalance } from "wagmi";

export function useNativeBalance(address: `0x${string}` | undefined) {
  return useBalance({
    address,
    query: {
      enabled: Boolean(address),
      staleTime: 10_000,
    },
  });
}
```

`useBalance` 会随 `address` 和当前 chain 自动更新。

4. 读取 ERC-20 基础信息和余额。

```ts
// src/hooks/useToken.ts
import { useReadContracts } from "wagmi";
import { erc20Abi } from "@/abi/erc20";

export function useErc20Summary(
  token: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
) {
  const contracts = [
    ...(token === undefined
      ? []
      : [
          { address: token, abi: erc20Abi, functionName: "symbol" },
          { address: token, abi: erc20Abi, functionName: "decimals" },
        ]),
    ...(token === undefined || owner === undefined
      ? []
      : [{ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }]),
  ] as const;

  return useReadContracts({
    allowFailure: false,
    contracts,
    query: {
      enabled: Boolean(token),
      staleTime: 10_000,
    },
  });
}
```

要展示：

```text
symbol
decimals
当前账户 token balance
当前账户 ETH balance
```

注意：如果 `owner` 为空，不读 `balanceOf`。

5. 把模块 2 的 escrow 状态读取改写成 hook。

```ts
// src/hooks/useEscrow.ts
import { useReadContracts } from "wagmi";
import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { CONTRACTS } from "@/config/contracts";

export function useEscrowStatus() {
  const address = CONTRACTS.escrow.address;

  return useReadContracts({
    allowFailure: false,
    contracts:
      address === undefined
        ? []
        : [
            { address, abi: agentTaskEscrowAbi, functionName: "taskCount" },
            { address, abi: agentTaskEscrowAbi, functionName: "paused" },
            { address, abi: agentTaskEscrowAbi, functionName: "PAUSER_ROLE" },
          ],
    query: {
      enabled: Boolean(address),
      staleTime: 10_000,
      refetchInterval: 15_000,
    },
  });
}
```

返回值里可以按顺序取：

```text
data[0] -> taskCount
data[1] -> paused
data[2] -> PAUSER_ROLE
```

这里用了：

```text
staleTime: 10_000       10 秒内认为数据新鲜
refetchInterval: 15_000 每 15 秒自动刷新一次
enabled                 地址不存在时不请求
```

6. 读取当前账户是否有 `PAUSER_ROLE`。

```ts
// src/hooks/useEscrow.ts
import { useReadContract } from "wagmi";
import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { CONTRACTS } from "@/config/contracts";

export function useHasPauserRole(
  role: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "hasRole",
    args: role && account ? [role, account] : undefined,
    query: {
      enabled: Boolean(escrow && role && account),
      staleTime: 10_000,
    },
  });
}
```

账户切换后，`account` 变了，query key 也变了，角色状态会自动重读。

7. 读取单个任务。

```ts
// src/hooks/useEscrow.ts
import { useReadContract } from "wagmi";
import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { CONTRACTS } from "@/config/contracts";

export function useTask(taskId: bigint | undefined) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "tasks",
    args: taskId ? [taskId] : undefined,
    query: {
      enabled: Boolean(escrow && taskId && taskId > BigInt(0)),
      staleTime: 5_000,
    },
  });
}
```

UI 里仍然要注意：

```text
taskId 不能是 0
taskId 最好先和 taskCount 比较
amount 要按 token decimals 格式化
status 要映射成文字
refundAfter 要转成本地时间
```

8. 做一个读链面板。

面板至少展示：

```text
钱包地址
当前 chain ID
ETH balance
token symbol / decimals / balance
escrow taskCount
escrow paused
当前账户是否 PAUSER_ROLE
taskId 输入框
task 详情
刷新按钮
```

状态要分清：

| 状态 | UI |
| --- | --- |
| 未连接钱包 | 显示“请先连接钱包”，账户相关读取不发请求 |
| 链错误 | 显示“请切换 Base Sepolia”，合约读取不发请求或置灰 |
| 合约地址为空 | 显示“未配置 escrow 地址” |
| loading | 显示加载状态 |
| error | 展示可读错误 |
| success | 展示格式化后的链上数据 |

9. 手动刷新。

每个 wagmi hook 都可以拿到 `refetch`：

```ts
const escrowStatus = useEscrowStatus();

<button type="button" onClick={() => escrowStatus.refetch()}>
  刷新 escrow 状态
</button>
```

如果一个按钮要刷新多组数据：

```ts
await Promise.all([
  escrowStatus.refetch(),
  tokenSummary.refetch(),
  taskDetail.refetch(),
]);
```

10. 为后续写链预留 invalidate。

写链成功后，不能假装页面数据自动变了。交易确认后要让相关查询失效或 refetch。

先在模块 4 学会这个心智：

```ts
import { useQueryClient } from "@tanstack/react-query";

const queryClient = useQueryClient();

await queryClient.invalidateQueries();
```

模块 5 / 7 写链成功后，再把它收窄到具体 query key。模块 4 先理解：

```text
链上状态变了
  -> 本地缓存旧了
  -> invalidate / refetch
  -> UI 重新读链
```

11. 什么时候仍然用裸 `publicClient`。

继续用裸 `publicClient` 的场景：

```text
脚本
一次性调试
事件 logs 扫描
服务端工具
不在 React 组件里的读取
```

用 wagmi hook 的场景：

```text
React 页面展示
依赖当前钱包账户
依赖当前 chain
需要 loading / error / cache / refetch
需要随账户切换自动刷新
```

模块 4 的重点就是学会这个边界。

常见问题：

#### hook 报 Provider 错误

说明组件不在 `WagmiProvider` 里面。检查 `Providers` 是否挂载。

#### 地址为空还在发请求

检查 `query.enabled`：

```ts
query: {
  enabled: Boolean(address),
}
```

不要对 `undefined` 地址发 `readContract`。

#### 数据不刷新

检查：

```text
staleTime 是否太长
refetchInterval 是否设置
是否调用了 refetch
写链后是否 invalidateQueries
hook 参数是否真的变化了
```

#### 切换账户后余额不变

检查 `owner` / `account` 是否作为 hook 参数传进去。参数不变，query key 就不会变。

#### 合约函数读失败

优先检查：

```text
地址是不是当前链上的合约
ABI 是否最新
functionName 是否存在
chainId 是否是 84532
```

验收：

- 读链结果有缓存，组件重复挂载不会重复打 RPC。
- 切换账户 / 链后，余额、角色、escrow 状态和任务状态自动刷新。
- 写链成功后能主动让相关查询失效并刷新（先留接口，模块 5/7 接上）。
- 仍保留一处裸 `publicClient` 用法，并说明为什么这里不用 hook。
- 地址为空时不会发无效请求。
- 未连接钱包时不会读取账户相关数据。
- 链错误时写链入口仍然禁用。
- 页面能展示 loading / error / success 三类状态。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 通过。

复习题：

1. `useReadContract` 和 `publicClient.readContract` 的区别是什么？
2. `useReadContracts` 为什么适合读 `taskCount`、`paused`、`PAUSER_ROLE`？
3. `enabled` 解决什么问题？
4. `staleTime` 和 `refetchInterval` 分别是什么意思？
5. 为什么账户切换后，token balance 应该自动刷新？
6. 为什么写链成功后要 `invalidateQueries`？
7. 什么场景应该继续用裸 `publicClient`？
8. 什么场景应该用 wagmi hook？

## 模块 5：ERC-20 授权与任务注资

目标：完成一次真实的测试网任务创建与注资流程。

> 代码进度（2026-06-20）：已写到普通 ERC-20 `createTask -> approve -> fundTask` 路线。当前已新增 `useTokenAllowance`、`useTaskFunding`、`FundingPanel`，并把模块 5 面板接入首页。`fundTaskWithPermit` / ERC-2612 permit 签名还没有开始，留到后续模块。

这一模块是 Layer 3 第一次真正“写链”。前面模块 2 / 4 都是在读链，模块 3 只解决钱包连接和网络状态。模块 5 开始要把用户输入变成真实交易：

```text
连接钱包
  -> 检查 Base Sepolia
  -> 填写任务
  -> simulate createTask
  -> write createTask
  -> 等 receipt
  -> 拿到 taskId
  -> 检查 allowance
  -> approve
  -> 等 approve receipt
  -> fundTask
  -> 等 fund receipt
  -> 刷新读链缓存
```

模块 5 先走普通 ERC-20 的 `approve + fundTask`。`fundTaskWithPermit` 只做概念预告，完整 permit 签名留到后面再学。这样不会把“交易写入”和“离线签名授权”混在一起。

模块 5 做完后，你应该能回答：

- `balanceOf` 和 `allowance` 分别在检查什么？
- 为什么 ERC-20 注资前通常要先 `approve`？
- `approve(spender, amount)` 里的 spender 为什么是 escrow 合约地址？
- 用户输入的 `"1.5"` 为什么不能直接传给 `uint256 amount`？
- `parseUnits`、`decimals` 和链上 `uint256` 金额是什么关系？
- 为什么 `writeContract` 只返回 tx hash，不直接返回 Solidity 函数的 return value？
- `simulateContract` 能提前发现哪些错误？
- 交易成功后为什么要等 receipt，再刷新缓存？
- 用户拒签、合约 revert、RPC 失败应该怎么区分？

学什么：

- 测试资产准备：Base Sepolia ETH 用来付 gas，Base Sepolia USDC 或 `PermitToken` 用来注资。
- ERC-20 `balanceOf(owner)`。
- ERC-20 `allowance`。
- ERC-20 `approve(spender, amount)`。
- `AgentTaskEscrowWithPermit.createTask`。
- `AgentTaskEscrowWithPermit.fundTask`。
- `simulateContract`：发交易前先模拟。
- `writeContract`：发真实交易。
- `waitForTransactionReceipt`：等待链上确认。
- 从 `TaskCreated` event 里拿 `taskId`。
- `parseUnits`：把用户输入金额转成链上 `uint256`。
- 交易 pending / confirmed / failed 状态。
- 用户拒签、余额不足、allowance 不足、合约暂停、任务状态错误等错误处理。
- 写链成功后的 `refetch` / `invalidateQueries`。

前置条件：

- 模块 3 的钱包连接已经可用。
- 模块 4 的读链 hooks 已经可用。
- 当前钱包能切到 Base Sepolia，`chainId = 84532`。
- 当前钱包有一点 Base Sepolia ETH 支付 gas。
- `.env.local` 至少填了：

```env
NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS=
```

说明：

- `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS` 必须是 `AgentTaskEscrowWithPermit`。
- 本模块普通注资可以用 Base Sepolia USDC，也可以用自己部署的 `PermitToken` 当普通 ERC-20 用。
- 如果测试网 USDC 拿不到，优先用 Layer 2 自己部署的测试 token。
- 如果 escrow 地址为空，写链按钮必须禁用。

推荐文件落点：

```text
src/hooks/useToken.ts          增加 allowance 读取
src/hooks/useTaskFunding.ts    createTask / approve / fundTask 写链流程
src/components/funding-panel.tsx
src/lib/errors.ts             用户拒签 / revert / RPC 错误格式化
src/app/page.tsx              组合 WalletStatus / ReadPanel / FundingPanel
```

职责边界：

| 文件 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `useToken.ts` | token balance、symbol、decimals、allowance | 发交易 |
| `useTaskFunding.ts` | create / approve / fund 的交易流程 | 页面布局 |
| `funding-panel.tsx` | 表单、按钮、状态展示 | 解析 ABI、硬编码地址 |
| `errors.ts` | 把错误转成人话 | 发送交易 |
| `contracts.ts` | 合约地址配置 | React 状态 |

操作练习：

1. 先确认测试资产和基础配置。

```text
当前钱包已连接
当前 chainId = 84532
Base Sepolia ETH balance > 0，用来付 gas
注资 token balance > 0，用来 fund task
escrow address 已配置
token address 已配置
```

如果 ETH 不足，先使用 Base Sepolia faucet。  
如果 USDC 不足，先确认 `NEXT_PUBLIC_USDC_ADDRESS` 指向的测试网 USDC 是否有可用 faucet；如果没有，就回到 Layer 2 部署的测试 ERC-20 跑普通注资流程。要练 `fundTaskWithPermit` 时，使用 Layer 2 的 `PermitToken`。

页面上先把这些状态显示出来：

```text
canWrite: true / false
account
chainId
ETH balance
token balance
escrow address
token address
```

`canWrite` 继续沿用模块 3 的判断：

```ts
const canWrite = isConnected && chainId === BASE_SEPOLIA_CHAIN_ID;
```

所有写链按钮都必须遵守：

```text
未连接钱包       -> 禁用
连接了但链不对   -> 禁用
escrow 地址为空  -> 禁用
token 地址为空   -> 禁用
余额不足         -> 禁用
输入非法         -> 禁用
```

2. 准备任务创建表单。

`createTask` 的合约函数是：

```text
createTask(operator, token, amount, service, refundAfter)
```

表单至少包含：

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `operator` | address | 必须是合法地址，不能是零地址 |
| `token` | address | 默认用配置里的 USDC / PermitToken |
| `amount` | string | 必须大于 0，不能超过 token balance |
| `service` | string | 非空，比如 `research-summary` |
| `refundAfter` | datetime-local 或秒数 | 必须晚于当前时间 |

注意：金额输入框里保留字符串，不要用 JS `number` 存 token 金额。`number` 有精度问题，链上金额必须最后转成 `bigint`。

3. 把用户输入金额转成链上金额。

ERC-20 金额在链上是整数 `uint256`。如果 USDC 的 `decimals = 6`：

```text
用户输入 1      -> 链上 1000000
用户输入 1.5    -> 链上 1500000
用户输入 0.01   -> 链上 10000
```

前端用 `parseUnits`：

```ts
import { parseUnits } from "viem";

const rawAmount = parseUnits(amountInput, decimals);
```

这里的关系是：

```text
用户输入字符串 + token decimals
  -> parseUnits
  -> bigint
  -> 合约 uint256 amount
```

校验顺序建议：

```text
amountInput 非空
decimals 已读取成功
parseUnits 不报错
rawAmount > 0
rawAmount <= balance
```

4. 发交易前先模拟 `createTask`。

`simulateContract` 的意义是：先让节点按当前链上状态跑一遍调用，尽早发现会不会 revert。比如：

```text
operator 是零地址       -> InvalidOperator
token 是零地址          -> InvalidToken
amount 是 0             -> InvalidAmount
service 为空            -> InvalidService
refundAfter 已经过期    -> InvalidDeadline
escrow paused           -> Pausable: paused / EnforcedPause
```

示例心智：

```ts
const { request, result: previewTaskId } = await publicClient.simulateContract({
  account,
  address: escrow,
  abi: agentTaskEscrowAbi,
  functionName: "createTask",
  args: [operator, token, rawAmount, service, refundAfter],
});
```

`previewTaskId` 是模拟时看到的返回值，只能用来预览。真正交易上链后，前端不能只依赖它，要以 receipt / event 为准。

5. 写入 `createTask`，并等待 receipt。

写链流程是：

```text
simulateContract
  -> 得到 request
  -> writeContract(request)
  -> 得到 tx hash
  -> waitForTransactionReceipt(hash)
  -> receipt.status === "success"
```

关键点：

- `writeContract` 返回的是交易 hash，不是 Solidity 函数返回值。
- `createTask` 虽然在 Solidity 里 `returns (uint256 taskId)`，但普通交易不会把这个 return value 直接给前端。
- 前端要拿真实 `taskId`，应该从 receipt 的 `TaskCreated` event 里解析，或交易确认后重新读 `taskCount`。

本模块建议先解析 `TaskCreated`，事件流系统留到模块 8 再做完整：

```ts
import { parseEventLogs } from "viem";

const logs = parseEventLogs({
  abi: agentTaskEscrowAbi,
  logs: receipt.logs,
  eventName: "TaskCreated",
});
```

解析后至少拿到：

```text
taskId
client
operator
token
amount
service
refundAfter
```

6. 读取当前账户对 escrow 的 allowance。

ERC-20 授权读取是：

```text
token allowance(account, escrow)
```

参数含义：

```text
owner   = 当前钱包 account
spender = escrow 合约地址
```

可以在 `useToken.ts` 里增加一个小 hook：

```ts
export function useTokenAllowance(
  token: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
) {
  return useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: Boolean(token && owner && spender),
      staleTime: 5_000,
    },
  });
}
```

页面展示：

```text
当前余额：1.23 USDC
当前授权：0.5 USDC
本次任务金额：1 USDC
是否需要 approve：是
```

7. 判断是否需要 approve。

判断规则：

```text
如果 allowance < amount
  -> 先 approve(escrow, amount)
  -> 等 approve receipt
  -> 再 fundTask(taskId)
否则
  -> 直接 fundTask(taskId)
```

注意：

- `approve` 是发给 token 合约，不是发给 escrow 合约。
- `approve(spender, amount)` 只是授权 spender 可以转走最多 `amount` 的 token，不会立刻扣款。
- 真正扣款发生在 `escrow.fundTask(taskId)` 内部的 `safeTransferFrom`。
- 课程练习建议先授权精确金额，不急着做无限授权。

8. 发 `approve` 交易。

流程和 `createTask` 一样：

```text
simulate token.approve(escrow, amount)
  -> write token.approve
  -> wait approve receipt
  -> refetch allowance
```

确认摘要里要写清楚：

```text
你正在授权 escrow 合约使用你的 token
token: 0x...
spender: escrow 0x...
amount: 1 USDC
network: Base Sepolia
```

`approve` 成功后，页面状态不要直接跳成“已注资”。它只代表授权成功，任务还没有进入 `Funded`。

9. 发 `fundTask` 交易。

`fundTask` 的合约函数是：

```text
fundTask(taskId)
```

它内部会检查：

```text
taskId 存在
调用者必须是 task.client
任务状态必须是 Created
escrow 没有 paused
token allowance 足够
token balance 足够
```

流程：

```text
simulate escrow.fundTask(taskId)
  -> write escrow.fundTask(taskId)
  -> wait fund receipt
  -> 解析 / 展示 TaskFunded
  -> 刷新 task、token balance、allowance、escrow token balance
```

成功后，任务状态应该从：

```text
Created -> Funded
```

10. 写链过程中展示清楚的阶段状态。

不要只放一个“提交”按钮。模块 5 至少展示这些阶段：

```text
idle
validating
simulating createTask
waiting wallet signature for createTask
createTask pending
createTask confirmed
checking allowance
waiting wallet signature for approve
approve pending
approve confirmed
waiting wallet signature for fundTask
fundTask pending
fundTask confirmed
failed
```

可以简化成用户能看懂的文案：

| 阶段 | UI 文案 |
| --- | --- |
| 等待签名 | 请在钱包里确认交易 |
| pending | 交易已提交，等待链上确认 |
| confirmed | 交易已确认 |
| rejected | 你取消了这次操作，链上没有变化 |
| failed | 交易失败，查看原因 |

11. 写链成功后刷新缓存。

模块 4 已经讲过读链结果有缓存。模块 5 写链成功后，缓存一定会变旧：

```text
createTask 成功    -> taskCount 变了，新 task 出现
approve 成功       -> allowance 变了
fundTask 成功      -> task.status 变了，余额变了，escrow token balance 变了
```

所以每个 receipt 成功后都要刷新相关读取：

```ts
await Promise.all([
  escrowStatus.refetch(),
  tokenSummary.refetch(),
  allowance.refetch(),
  taskDetail.refetch(),
]);
```

或者用 react-query：

```ts
await queryClient.invalidateQueries();
```

课程初期可以先 `invalidateQueries()` 全量刷新，等读写逻辑稳定后，再收窄到具体 query。

12. 发交易前展示确认摘要。

摘要至少包括：

- 网络：Base Sepolia。
- 代币：USDC 或 PermitToken。
- 金额。
- spender：escrow 地址。
- 调用函数：`createTask` / `approve` / `fundTask` / `fundTaskWithPermit`。
- 目标合约地址。
- 当前账户地址。
- operator 地址。
- service。
- refundAfter。

确认摘要的目的不是装饰 UI，而是让用户在钱包弹窗前能先复核：

```text
我在哪条链？
我要调用哪个合约？
我要授权谁？
要花多少 token？
这笔交易成功后链上状态会变成什么？
```

13. 区分几类常见错误。

建议在 `src/lib/errors.ts` 里把错误先转成人话：

| 错误 | 常见原因 | UI 文案 |
| --- | --- | --- |
| 用户拒签 | 用户关闭钱包弹窗 | 你取消了这次操作，链上没有变化 |
| ETH 不足 | 没有 gas | Base Sepolia ETH 不足，无法支付 gas |
| token 余额不足 | `balance < amount` | token 余额不足 |
| allowance 不足 | 没有 approve 或授权太少 | 需要先授权 escrow 使用 token |
| `InvalidDeadline` | `refundAfter <= 当前时间` | 退款时间必须晚于当前时间 |
| `InvalidStatus` | 任务不是 Created | 当前任务状态不能注资 |
| `Unauthorized` | 不是 task client | 只有任务创建者可以注资 |
| paused | 合约暂停 | 当前 escrow 已暂停 |
| RPC error | RPC 限流 / 网络异常 | RPC 请求失败，请稍后重试或更换 RPC |

viem 错误可以先按这个思路处理：

```ts
import { BaseError, UserRejectedRequestError } from "viem";

export function getReadableError(error: unknown) {
  if (error instanceof UserRejectedRequestError) {
    return "你取消了这次操作，链上没有变化。";
  }

  if (error instanceof BaseError) {
    return error.shortMessage;
  }

  return "操作失败，请检查钱包、网络和合约配置。";
}
```

14. 可选预告：`fundTaskWithPermit`。

普通流程是两笔交易：

```text
approve
fundTask
```

permit 流程的目标是减少成：

```text
签一条 ERC-2612 permit 消息
fundTaskWithPermit
```

但它要求 token 支持 ERC-2612：

```text
permit(owner, spender, value, deadline, v, r, s)
nonces(owner)
DOMAIN_SEPARATOR()
```

Base Sepolia USDC 不一定适合拿来做课程里的 permit 练习。本课程要练 `fundTaskWithPermit`，优先用 Layer 2 自己部署的 `PermitToken`。模块 5 只需要知道这个方向，不强求现在完成 permit 签名。

常见问题：

#### `createTask` 成功后为什么拿不到返回值？

因为真实交易上链后，钱包 / RPC 返回的是交易 hash。Solidity 的 return value 不会像普通函数调用那样直接返回给前端。

要拿 `taskId` 有三种办法：

```text
simulateContract 预览 result
receipt logs 解析 TaskCreated
交易确认后重新读 taskCount / tasks
```

模块 5 推荐解析 `TaskCreated`，模块 8 再系统学习事件流。

#### approve 成功是不是代表已经付款？

不是。`approve` 只是授权 escrow 以后可以从你账户转 token。真正付款发生在 `fundTask`。

#### 为什么 approve 之后还要等 receipt？

因为 allowance 只有在 approve 交易确认后才真正改变。如果不等 receipt 就立刻发 `fundTask`，可能会因为链上 allowance 还没更新而失败。

#### 为什么模拟成功后真实交易仍然可能失败？

模拟只代表“在模拟时那一刻的链上状态下可以成功”。真实交易 pending 的过程中，链上状态可能变化：

```text
任务被取消
合约被暂停
余额被转走
allowance 被改小
refundAfter / 状态条件变化
RPC 或钱包问题
```

所以仍然要等 receipt，并以 receipt 为准。

#### 为什么不要用 JS number 处理 token 金额？

因为 token 金额最终是整数 `uint256`，很多金额会超过 JS 安全整数范围。前端输入保留字符串，转换后用 `bigint`。

验收：

- 金额为空、为 0、超过余额时禁止提交。
- operator 地址非法时禁止提交。
- `refundAfter` 早于当前时间时禁止提交。
- escrow / token 地址为空时禁止提交。
- 链 ID 不是 `84532` 时禁止提交。
- 发交易前会先 `simulateContract`。
- `createTask` 成功后能拿到真实 `taskId`。
- allowance 不足时先走 `approve`，足够时直接 `fundTask`。
- 用户拒签时 UI 显示“用户取消”，不当作系统错误。
- approve 成功但 fundTask 失败时，界面能说明当前停在哪一步。
- fundTask 成功后能看到 task 状态变成 `Funded`，escrow token 余额变化。
- fundTask 成功后 token balance、allowance、task、taskCount 等读链数据会刷新。
- BaseScan 链接能打开对应交易。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 通过。

复习题：

1. ERC-20 `allowance(owner, spender)` 的两个参数分别是谁？
2. 为什么 `approve` 是发给 token 合约，而不是发给 escrow 合约？
3. `approve` 成功后，用户 token 余额会变化吗？
4. `fundTask` 为什么需要 `allowance`？
5. `parseUnits("1.5", 6)` 会得到什么？
6. 为什么金额输入应该用字符串，而不是 JS `number`？
7. `simulateContract` 能替代真实交易吗？
8. `writeContract` 返回的是什么？
9. 为什么 `createTask returns (uint256 taskId)`，前端写交易时却不能直接拿 return value？
10. 写链成功后为什么要刷新模块 4 的读链缓存？
11. 用户拒签和合约 revert 有什么区别？
12. `approve` 成功但 `fundTask` 失败时，链上处于什么状态？

## 模块 6：EIP-712 任务意图签名

目标：在前端生成用户可读的任务意图，并用钱包签名。

范围说明：Layer 3 主线先跑 EOA 钱包对 `AgentTaskEscrowWithPermit` 的 `TaskIntent` 签名。EIP-1271 智能账户验签留到 Layer 4，不要求本层完成智能账户签名验签闭环。

> 代码进度（2026-06-20）：已写到 EIP-712 `TaskIntent` 签名。当前已新增 `src/lib/eip712.ts`、`src/hooks/useTaskIntent.ts`、`src/components/intent-panel.tsx`，并在 `useEscrow.ts` 增加 `useClientNonce`。模块 6 只生成和展示签名，不调用 `completeTask`；提交签名、等待 receipt、解析 `TaskIntentUsed` 留到模块 7。

这一模块开始学习“签名不是交易”的前端能力。模块 5 的 `createTask / approve / fundTask` 都是写链交易，会花 gas，会产生 tx hash。模块 6 的 `signTypedData` 不写链，不花 gas，它只是让 client 钱包签一份结构化授权：

```text
我是谁：client
授权哪个任务：taskId
允许谁完成：operator
允许做什么：action = "complete"
当前 nonce：nonces(client)
有效期到什么时候：deadline
这份签名在哪条链、哪个合约有效：EIP-712 domain
```

签名之后，链上状态还不会变化。真正把签名提交给 `completeTask`、等待 receipt、解析 `TaskIntentUsed` 和 `TaskCompleted` 是模块 7 的内容。

模块 6 做完后，你应该能回答：

- EIP-712 相比普通字符串签名解决了什么问题？
- `domain`、`types`、`message` 分别是什么？
- 为什么 `chainId` 和 `verifyingContract` 必须写进 domain？
- 为什么 `TaskIntent` 的字段、顺序、类型必须和 Solidity struct 对齐？
- 为什么 nonce 必须从链上读取，不能前端自己加一？
- deadline 为什么要展示成本地时间和 Unix timestamp？
- `signTypedData` 为什么不花 gas？
- 签名成功后链上状态为什么还没变？
- 为什么签名前必须展示一份人类可读的摘要？
- 用户拒签和签名无效有什么区别？

学什么：

- `signTypedData`。
- EIP-712 domain：`name`、`version`、`chainId`、`verifyingContract`。
- typed data types。
- message 字段与 Solidity struct 对齐。
- nonce 与 deadline。
- 签名不是交易，不花 gas。
- 签名前的人类可读预览。
- EIP-712 签名结果是 `0x...` bytes，不是 tx hash。
- 签名只是一份链下授权，需要后续交易提交才会影响链上状态。
- 用户拒签、过期 deadline、nonce 不匹配、domain 不一致的风险。
- `TaskIntent` 和 `AgentTaskEscrowWithPermit.hashIntent` 的关系。

前置条件：

- 模块 3 的钱包连接已经可用。
- 模块 4 的读链 hooks 已经可用。
- 模块 5 已经能创建并注资任务，让任务进入 `Funded`。
- `.env.local` 已经配置 `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS`。
- 当前钱包在 Base Sepolia，`chainId = 84532`。
- 当前钱包是任务的 `client`。
- 要签名的任务状态必须是 `Funded`，不是 `Created` / `Completed` / `Refunded` / `Cancelled`。

说明：

- 模块 6 只生成签名，不调用 `completeTask`。
- 签名可以显示在页面上，也可以临时复制保存，但不要自动上传到不明服务。
- 如果任务还没 `Funded`，先回模块 5 注资。
- 如果当前钱包不是 task.client，不能生成 client 授权签名。
- 如果当前链不是 84532，不能签。

推荐文件落点：

```text
src/hooks/useTaskIntent.ts       读取 nonce，构造 typed data，调用 signTypedData
src/components/intent-panel.tsx  taskId 输入、签名前摘要、签名结果展示
src/lib/eip712.ts                domain / types / message 构造工具
src/lib/errors.ts                复用用户拒签错误格式化
src/app/page.tsx                 组合 WalletStatus / FundingPanel / ReadPanel / IntentPanel
```

职责边界：

| 文件 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `useTaskIntent.ts` | 读取 nonce、构造 intent、签名 | 提交 `completeTask` |
| `intent-panel.tsx` | 展示任务摘要、签名按钮、签名结果 | 直接拼底层 RPC |
| `eip712.ts` | EIP-712 domain/types/message 的纯函数 | React 状态 |
| `errors.ts` | 用户拒签等错误文案 | 业务流程 |
| `useEscrow.ts` | 继续负责读 `tasks(taskId)` / `nonces(client)` | 发交易 |

合约对应关系：

Solidity struct 是：

```solidity
struct TaskIntent {
    address client;
    uint256 taskId;
    address operator;
    string action;
    uint256 nonce;
    uint256 deadline;
}
```

合约的 EIP-712 domain 来自构造函数：

```solidity
constructor(address admin) EIP712("AgentTaskEscrow", "1") {
    // ...
}
```

所以前端 domain 必须是：

```text
name = "AgentTaskEscrow"
version = "1"
chainId = 84532
verifyingContract = escrow 地址
```

合约的 typehash 是：

```solidity
TASK_INTENT_TYPEHASH = keccak256(
    "TaskIntent(address client,uint256 taskId,address operator,string action,uint256 nonce,uint256 deadline)"
);
```

所以前端 `types.TaskIntent` 的字段名、顺序、类型必须完全对应。

操作练习：

1. 读取任务并确认它能被签名。

用户输入 `taskId` 后，先读：

```text
tasks(taskId)
```

至少检查：

```text
taskId > 0
taskId <= taskCount
task.client === 当前钱包 address
task.status === Funded
task.operator 不是零地址
```

页面展示：

```text
taskId
client
operator
token
amount
service
refundAfter
status
```

如果任务还在 `Created`，说明只创建了任务但还没有注资，应该回模块 5 执行 `fundTask`。

2. 读取 nonce。

nonce 必须从链上读：

```text
nonces(client)
```

不要在前端自己维护：

```text
上次 nonce + 1
```

原因是：

```text
签名可能已经被别的页面 / 别的设备 / 别的 operator 用掉
链上 nonce 才是最终事实
```

建议在 `useEscrow.ts` 或 `useTaskIntent.ts` 中增加：

```ts
export function useClientNonce(client: `0x${string}` | undefined) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "nonces",
    args: client ? [client] : undefined,
    query: {
      enabled: Boolean(escrow && client),
      staleTime: 5_000,
    },
  });
}
```

3. 构造任务意图。

```text
TaskIntent
  client: 当前钱包地址
  taskId: 链上任务 ID
  operator: 服务执行方地址
  action: "complete"
  nonce: escrow.nonces(client)
  deadline: 当前时间 + 10 分钟
```

字段来源：

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `client` | 当前钱包 `address` | 必须等于 task.client |
| `taskId` | 页面输入 / 当前任务 | 必须是已存在任务 |
| `operator` | task.operator | 不要让用户随意改 |
| `action` | 固定 `"complete"` | 必须和合约 `COMPLETE_ACTION_HASH` 对应 |
| `nonce` | `nonces(client)` | 必须链上读取 |
| `deadline` | 当前时间 + 有效期 | Unix timestamp，单位秒 |

注意：

- `taskId`、`nonce`、`deadline` 在前端用 `bigint`。
- `deadline` 不是任务的 `refundAfter`，它是“这份签名”的过期时间。
- `operator` 最好从 `tasks(taskId)` 读取，不让用户手填，避免签给错误地址。

4. 构造 typed data。

```ts
const domain = {
  name: "AgentTaskEscrow",
  version: "1",
  chainId: 84532,
  verifyingContract: escrowAddress,
} as const;

const types = {
  TaskIntent: [
    { name: "client", type: "address" },
    { name: "taskId", type: "uint256" },
    { name: "operator", type: "address" },
    { name: "action", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;
```

message 示例：

```ts
const message = {
  client: address,
  taskId,
  operator: task.operator,
  action: "complete",
  nonce,
  deadline,
} as const;
```

完整 typed data 的心智是：

```text
domain  这份签名在哪条链、哪个合约、哪个协议版本有效
types   要签的数据结构长什么样
message 这一次具体签的内容
```

5. 签名前展示任务摘要。

要展示：

- 谁在签。
- 授权哪个任务。
- action 是什么。
- 签名在哪条链有效。
- 签名交给哪个 escrow 合约验证。
- deadline 何时过期。
- 当前 nonce 是多少。
- operator 是谁。
- 任务当前状态。
- 这不是交易，不会花 gas。

示例摘要：

```text
签名者 client：0x...
任务 ID：12
任务状态：Funded
operator：0x...
action：complete
nonce：0
deadline：2026-06-20 18:30:00 / 1781951400
chainId：84532
verifyingContract：0x...
```

签名前的提示要清楚：

```text
这份签名允许 operator 在 deadline 前提交 completeTask。
签名本身不会改变链上状态，也不会花 gas。
签名提交上链后，任务可能从 Funded 变成 Completed。
```

6. 调用 `signTypedData`。

可以用 wagmi hook：

```ts
import { useSignTypedData } from "wagmi";

const { signTypedDataAsync, isPending, error } = useSignTypedData();

const signature = await signTypedDataAsync({
  domain,
  types,
  primaryType: "TaskIntent",
  message,
});
```

也可以用 `walletClient.signTypedData`。在 React 组件里优先用 wagmi hook，因为它自带 pending / error 状态。

签名成功后得到：

```text
0x...
```

这是签名 bytes，不是交易 hash。不要拿它去 BaseScan 查交易。

7. 展示签名结果。

页面至少展示：

```text
signature
client
taskId
operator
action
nonce
deadline
domain
```

可以提供一个“复制签名”按钮，方便模块 7 调试。

但模块 6 不自动提交签名：

```text
不调用 completeTask
不解析 TaskIntentUsed
不等待交易 receipt
```

8. 可选：本地恢复/验证签名。

为了确认签名和 typed data 对得上，可以用 viem 的验证工具做本地校验：

```ts
import { verifyTypedData } from "viem";

const valid = await verifyTypedData({
  address,
  domain,
  types,
  primaryType: "TaskIntent",
  message,
  signature,
});
```

这里验证的是：

```text
这份 signature 是否由 address 对这份 typed data 签出
```

它仍然不代表 `completeTask` 一定成功，因为合约还会检查：

```text
deadline 是否过期
nonce 是否还是当前值
task 是否 Funded
client/operator 是否匹配任务
action 是否等于 complete
```

这些完整链上校验放到模块 7。

9. 处理用户拒签。

签名弹窗里用户点取消时：

```text
链上没有变化
没有 tx hash
没有 signature
```

UI 文案建议：

```text
你取消了签名，链上没有变化。
```

不要把用户拒签说成“交易失败”，因为这里根本没有交易。

10. 保存当前签名状态。

模块 6 可以只保存在 React state：

```text
当前 intent
当前 signature
签名时间
deadline
```

页面刷新后丢失也没关系。后面如果要做任务历史、签名队列、operator 后台，再考虑持久化。

常见问题：

#### 签名会花 gas 吗？

不会。`signTypedData` 是钱包在本地对结构化数据签名，不广播交易。

#### 签名成功后链上状态会变吗？

不会。链上不知道你签过这份数据。只有后面把签名提交给合约交易时，链上状态才可能变化。

#### 为什么要写 `chainId`？

防止签名跨链复用。Base Sepolia 的签名不应该能拿到别的链上用。

#### 为什么要写 `verifyingContract`？

防止签名被拿到另一个合约复用。签名应该只对当前 escrow 合约有效。

#### 为什么 `action` 固定为 `"complete"`？

合约里检查：

```solidity
keccak256(bytes(intent.action)) == COMPLETE_ACTION_HASH
```

而 `COMPLETE_ACTION_HASH` 来自：

```solidity
keccak256("complete")
```

所以大小写、空格都不能错。

#### 为什么 nonce 不能自己加一？

因为 nonce 是防重放用的链上计数器。签名一旦被成功使用，合约会消耗 nonce。前端猜 nonce 可能和链上不一致。

#### deadline 和 refundAfter 是一回事吗？

不是。

```text
refundAfter：任务退款时间，存在 task 里
deadline：这份签名的过期时间，存在 intent 里
```

#### 为什么钱包弹窗里的内容看起来怪？

不同钱包对 EIP-712 的展示不完全一样。所以前端页面必须自己提供一份清楚的人类可读摘要，不要只依赖钱包弹窗。

#### 签名要不要发给后端？

课程模块 6 不需要。先在页面展示签名即可。以后如果做 operator 服务或任务后台，可以再设计安全的签名传递流程。

验收：

- chain ID 错误时不能签。
- nonce 从链上读取，不在前端自增猜测。
- deadline 明确展示为本地时间和 Unix timestamp。
- 用户拒签有明确状态。
- 签名结果不会自动上传到不明服务。
- 当前钱包不是 task.client 时不能签。
- task 状态不是 `Funded` 时不能签。
- `operator` 来自链上 task，不让用户随意签给陌生地址。
- `domain.name` 是 `"AgentTaskEscrow"`。
- `domain.version` 是 `"1"`。
- `domain.chainId` 是 `84532`。
- `domain.verifyingContract` 是当前 escrow 地址。
- `types.TaskIntent` 字段名、顺序、类型和 Solidity struct 对齐。
- `message.action` 固定为 `"complete"`。
- 签名成功后页面能展示 signature、intent、domain。
- 页面说明签名不是交易、不会花 gas、没有 tx hash。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 通过。

复习题：

1. EIP-712 签名和普通 `personal_sign` 有什么区别？
2. `domain` 里为什么要有 `chainId`？
3. `domain` 里为什么要有 `verifyingContract`？
4. `types.TaskIntent` 为什么必须和 Solidity struct 对齐？
5. `TaskIntent.client` 应该是谁？
6. `TaskIntent.operator` 应该从哪里来？
7. `nonce` 为什么必须从链上读取？
8. `deadline` 和 `refundAfter` 有什么区别？
9. `signTypedData` 会不会花 gas？
10. 签名成功后链上状态会不会变化？
11. signature 和 tx hash 有什么区别？
12. 为什么用户拒签不是“交易失败”？
13. 为什么 action 必须是 `"complete"`？
14. 模块 6 为什么不调用 `completeTask`？
15. 模块 7 会接着做什么？

## 模块 7：提交签名并等待链上确认

目标：把 EIP-712 签名提交给 escrow 合约，完成 `completeTask`，并展示 receipt 和事件。

> 代码进度（2026-06-21）：已写到 `verifyCompleteIntent -> simulate completeTask -> writeContract -> waitForTransactionReceipt -> parse TaskIntentUsed / TaskCompleted`。当前已新增 `src/hooks/useTaskCompletion.ts`、`src/components/completion-panel.tsx`、`src/lib/events.ts`、`src/components/task-console.tsx`，并让模块 6 的 `IntentPanel` 把签名传给模块 7。完整历史事件流仍留到模块 8。

模块 7 承接模块 6：

```text
模块 6：client 链下签 TaskIntent，得到 intent + signature
模块 7：operator 把 intent + signature 提交到链上 completeTask
```

这一模块重新回到“写链”。和模块 5 不同的是，模块 7 的写链参数里包含一个 struct 和一段 bytes 签名：

```text
completeTask(intent, signature, resultURI)
```

成功后链上会发生真实状态变化：

```text
task.status: Funded -> Completed
task.resultURI: "" -> resultURI
escrow token balance 减少
operator token balance 增加
client nonce 被消耗
emit TaskIntentUsed
emit TaskCompleted
```

模块 7 做完后，你应该能回答：

- 为什么模块 7 的交易应该由 `operator` 提交，而不是 `client`？
- 为什么提交前要先调用 `verifyCompleteIntent(intent, signature)`？
- `verifyCompleteIntent = true` 能保证什么，不能保证什么？
- `completeTask` 为什么还要 `simulateContract`？
- `TaskIntent` struct 在前端传给合约时应该长什么样？
- `signature` 为什么是 `bytes` 参数，而不是 tx hash？
- nonce 是什么时候被消耗的？
- 为什么同一份签名不能重复提交？
- 为什么任务完成后 token 会转给 operator？
- receipt logs 里的 `TaskIntentUsed` 和 `TaskCompleted` 分别说明什么？

学什么：

- `writeContract` 调用带 struct 和 bytes signature 的函数。
- 交易前模拟 `completeTask`。
- 处理 revert：过期、签名无效、nonce 错误。
- 从 receipt logs 中解析 `TaskIntentUsed`。
- nonce 使用后刷新。
- `verifyCompleteIntent(intent, signature)` 的只读预检查。
- `completeTask(intent, signature, resultURI)` 的真实写链。
- `resultURI` 的输入与校验。
- `TaskIntent` tuple 参数和 TypeScript 类型。
- `parseEventLogs` 解析多个事件。
- `TaskIntentUsed` 与 `TaskCompleted` 的区别。
- 写链后刷新 task、nonce、token balance、event/receipt 展示。
- operator / client 两个角色在前端状态里的区别。

前置条件：

- 模块 5 已经创建并注资任务，任务状态是 `Funded`。
- 模块 6 已经生成 `intent + signature`。
- 当前页面能读取 `tasks(taskId)`。
- 当前页面能读取 `nonces(client)`。
- 当前钱包已连接 Base Sepolia，`chainId = 84532`。
- 当前钱包最好是 `task.operator`，因为合约要求提交 `completeTask` 的 `msg.sender` 必须是 operator。
- `.env.local` 已经配置 `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS`。

说明：

- 模块 7 是写链，会花 gas，会有 tx hash 和 receipt。
- 模块 6 的签名不花 gas，模块 7 的 `completeTask` 会花 gas。
- 如果当前钱包不是 `task.operator`，前端应该禁用提交按钮。
- 如果签名过期、nonce 已变化、任务不再是 `Funded`，前端应该提示重新签名。
- 模块 7 只处理 `completeTask`。退款、取消、事件历史流留给后续模块。

推荐文件落点：

```text
src/hooks/useTaskCompletion.ts     verifyCompleteIntent / completeTask / receipt 解析
src/components/completion-panel.tsx
src/lib/events.ts                  parse TaskIntentUsed / TaskCompleted 的工具
src/lib/errors.ts                  增加 ExpiredIntent / InvalidIntent / InvalidSigner 文案
src/app/page.tsx                   组合 IntentPanel / CompletionPanel
```

职责边界：

| 文件 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `useTaskCompletion.ts` | 验签预检查、模拟、写链、等 receipt、解析事件 | 表单布局 |
| `completion-panel.tsx` | resultURI 输入、签名包选择/展示、提交按钮、receipt 展示 | 底层 ABI 细节 |
| `events.ts` | 从 receipt logs 解析 `TaskIntentUsed` / `TaskCompleted` | 发交易 |
| `errors.ts` | 把 revert / 用户拒签 / RPC 错误转成人话 | 业务状态管理 |
| `useTaskIntent.ts` | 继续只负责生成签名 | 不提交交易 |

合约对应关系：

`completeTask` 是：

```solidity
function completeTask(
    TaskIntent calldata intent,
    bytes calldata signature,
    string calldata resultURI
) external whenNotPaused nonReentrant
```

合约成功执行后：

```solidity
task.status = TaskStatus.Completed;
task.resultURI = resultURI;
IERC20(task.token).safeTransfer(task.operator, task.amount);

emit TaskIntentUsed(intent.client, intent.taskId, intent.operator, intent.action, intent.nonce);
emit TaskCompleted(intent.taskId, task.client, task.operator, resultURI);
```

合约会检查：

```text
resultURI 非空
deadline 没过期
action 是 "complete"
taskId 存在
task.status 是 Funded
intent.client 等于 task.client
intent.operator 等于 task.operator
msg.sender 等于 task.operator
签名者是 intent.client
nonce 正确并被消耗
```

其中最容易忘的是：

```text
签名者 = client
提交交易者 = operator
```

操作练习：

1. 准备签名包输入。

模块 7 需要模块 6 的产物：

```text
intent
signature
```

可以先用两种方式之一：

```text
方式 A：直接复用页面内存里的模块 6 signed state
方式 B：提供输入框，让用户粘贴 intent JSON 和 signature
```

课程早期建议先做方式 A。如果页面刷新导致签名丢失，就回模块 6 重新签。

签名包至少包含：

```ts
type TaskIntentMessage = {
  client: `0x${string}`;
  taskId: bigint;
  operator: `0x${string}`;
  action: "complete";
  nonce: bigint;
  deadline: bigint;
};

type SignedTaskIntent = {
  message: TaskIntentMessage;
  signature: `0x${string}`;
};
```

注意：传给合约的 `intent` 是 `message`，不是整个 EIP-712 domain/types。

2. 读取当前任务状态。

提交前重新读：

```text
tasks(intent.taskId)
nonces(intent.client)
```

检查：

```text
task.status === Funded
task.client === intent.client
task.operator === intent.operator
currentNonce === intent.nonce
deadline > 当前时间
当前钱包 address === task.operator
```

这些检查能让用户在发交易前看到明显问题。

3. 准备 resultURI。

`completeTask` 要求：

```text
resultURI 非空
```

它可以是：

```text
ipfs://...
https://...
ar://...
demo-result://task-1
```

课程练习阶段可以先用：

```text
demo-result://task-<taskId>
```

但 UI 要说明：`resultURI` 是 operator 提交的任务结果地址或结果说明引用，不是签名本身。

4. 调用 `verifyCompleteIntent(intent, signature)` 先做只读检查。

```text
verifyCompleteIntent = true
  -> 允许 operator 提交 completeTask
verifyCompleteIntent = false
  -> 展示可能原因：过期、nonce 不匹配、签名者不一致、chain/domain 不一致
```

示例 hook：

```ts
export function useVerifyCompleteIntent(
  intent: TaskIntentMessage | undefined,
  signature: `0x${string}` | undefined,
) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "verifyCompleteIntent",
    args: intent && signature ? [intent, signature] : undefined,
    query: {
      enabled: Boolean(escrow && intent && signature),
      staleTime: 3_000,
    },
  });
}
```

`verifyCompleteIntent` 是只读检查，不花 gas。

它返回 `false` 时，常见原因：

```text
deadline 已过期
nonce 不是当前 nonces(client)
action 不是 "complete"
taskId 不存在
任务不是 Funded
intent.client / intent.operator 和链上 task 不一致
signature 不是 client 对这份 typed data 签的
domain 不一致，例如 chainId 或 verifyingContract 错
```

注意：`verifyCompleteIntent = true` 只说明“现在读链检查通过”。真实交易仍然要 `simulateContract`，因为状态可能在 pending 前后变化。

5. 发交易前展示确认摘要。

摘要至少包括：

```text
当前钱包：必须是 operator
client
operator
taskId
action
nonce
deadline
resultURI
escrow address
chainId
verifyCompleteIntent 结果
```

还要明确提示：

```text
这次是写链交易，会花 gas。
成功后任务会变成 Completed，token 会转给 operator。
```

6. 模拟 `completeTask`。

示例：

```ts
const simulation = await publicClient.simulateContract({
  account: operator,
  address: escrow,
  abi: agentTaskEscrowAbi,
  functionName: "completeTask",
  args: [intent, signature, resultURI],
});
```

模拟可能提前发现：

```text
InvalidResult      resultURI 为空
ExpiredIntent      deadline 已过
InvalidAction      action 不是 complete
TaskNotFound       taskId 不存在
InvalidStatus      task 不是 Funded
InvalidIntent      client/operator/msg.sender 不匹配
InvalidSigner      签名者不是 client
nonce 错误          签名已用过或 nonce 变化
合约 paused         当前不能 complete
```

7. 由 operator 调用 `completeTask(intent, signature, resultURI)`。

流程：

```text
simulate completeTask
  -> walletClient.writeContract(simulation.request)
  -> 得到 tx hash
  -> waitForTransactionReceipt
  -> receipt.status === "success"
```

注意：

- 当前钱包必须是 `task.operator`。
- `signature` 是模块 6 生成的 `0x...` bytes。
- `intent` 是模块 6 的 `message`。
- `resultURI` 是 operator 这次提交的任务结果。

8. 等 receipt，并解析事件。

成功 receipt 里应该能解析出两个核心事件：

```text
TaskIntentUsed(client, taskId, operator, action, nonce)
TaskCompleted(taskId, client, operator, resultURI)
```

示例：

```ts
const logs = parseEventLogs({
  abi: agentTaskEscrowAbi,
  logs: receipt.logs,
});

const intentUsed = logs.find((log) => log.eventName === "TaskIntentUsed");
const completed = logs.find((log) => log.eventName === "TaskCompleted");
```

两个事件含义：

| 事件 | 说明 |
| --- | --- |
| `TaskIntentUsed` | 这份 client 授权已被使用，nonce 被消耗 |
| `TaskCompleted` | 任务已经完成，resultURI 已写入，资金已转给 operator |

9. 展示 tx、receipt 和事件。

要展示：

- tx hash。
- block number。
- status。
- gas used。
- `TaskIntentUsed(client, taskId, operator, action, nonce)`。
- `TaskCompleted(taskId, client, operator, resultURI)`。
- BaseScan 链接。
- 完成前后的 task 状态。
- operator token balance 变化。

10. 成功后刷新缓存。

`completeTask` 成功后，至少刷新：

```text
tasks(taskId)
nonces(client)
operator token balance
escrow token balance
event / receipt 展示
```

可以先：

```ts
await queryClient.invalidateQueries();
```

模块 7 先保证状态正确，后面再优化具体 query key。

11. 处理重复提交。

`completeTask` 成功后 nonce 会被消耗。

同一份签名再次提交时应该失败：

```text
intent.nonce != nonces(intent.client)
```

UI 可以提示：

```text
这份签名已经使用过或 nonce 已变化，请重新生成 TaskIntent。
```

12. 处理过期签名。

如果：

```text
当前时间 > intent.deadline
```

就不要继续提交。

UI 提示：

```text
签名已过期，请回模块 6 重新签名。
```

常见问题：

#### verifyCompleteIntent 已经 true，为什么还要 simulate？

因为 `verifyCompleteIntent` 是只读快照。它检查的是“刚才那一刻”是否通过。真实交易提交前，链上状态可能变：

```text
任务被退款
任务被完成
合约被暂停
nonce 被另一笔交易消耗
deadline 过期
```

所以写链前仍然要 `simulateContract`。

#### 为什么当前钱包必须是 operator？

合约里检查：

```solidity
msg.sender != intent.operator
```

如果提交交易的人不是 operator，会 revert `InvalidIntent`。

这代表：

```text
client 负责签授权
operator 负责拿授权完成任务
```

#### 为什么签名用过后不能再用？

因为 `completeTask` 成功时会消耗 nonce：

```solidity
_useCheckedNonce(intent.client, intent.nonce);
```

同一份签名里的 nonce 已经过期，重复提交会失败。

#### signature 是 tx hash 吗？

不是。

```text
signature：模块 6 的钱包签名，给合约验签用
tx hash：模块 7 的 completeTask 交易哈希，给区块浏览器查交易用
```

#### TaskIntentUsed 和 TaskCompleted 为什么都要看？

`TaskIntentUsed` 说明：

```text
这份授权签名已被使用，nonce 被消耗
```

`TaskCompleted` 说明：

```text
任务完成，resultURI 写入，token 已支付给 operator
```

两个事件一起看，才知道“签名授权被用掉”和“任务完成付款”都发生了。

验收：

- 已使用过的签名不能重复提交。
- 过期签名提交前能被拦截或给出明确错误。
- 成功后 nonce 自动刷新。
- task 状态变成 `Completed`，operator 收到 token。
- receipt 和事件能在页面上看到。
- 当前钱包不是 operator 时不能提交。
- `resultURI` 为空时不能提交。
- 提交前会先调用 `verifyCompleteIntent`。
- 提交前会先 `simulateContract`。
- 用户拒签交易时显示“用户取消”，不当作合约错误。
- `completeTask` 成功后能解析 `TaskIntentUsed` 和 `TaskCompleted`。
- 成功后同一份签名再次提交会被拒绝或明确提示 nonce 已变化。
- 成功后 task、nonce、token balance 会刷新。
- BaseScan 链接能打开对应交易。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 通过。

复习题：

1. 模块 6 的 signature 和模块 7 的 tx hash 有什么区别？
2. 为什么 `completeTask` 应该由 operator 提交？
3. `completeTask` 的三个参数分别是什么？
4. `intent` 传的是 EIP-712 的 message，还是整个 domain/types/message？
5. `verifyCompleteIntent` 能检查哪些问题？
6. `verifyCompleteIntent = true` 后为什么还要 `simulateContract`？
7. `resultURI` 是什么？为什么不能为空？
8. `TaskIntentUsed` 表示什么？
9. `TaskCompleted` 表示什么？
10. nonce 是什么时候被消耗的？
11. 为什么同一份签名不能重复提交？
12. `ExpiredIntent`、`InvalidIntent`、`InvalidSigner` 分别大概表示什么？
13. 成功后为什么要刷新 task、nonce 和 token balance？
14. 如果当前钱包是 client 但不是 operator，提交 `completeTask` 会怎样？
15. 模块 8 会在模块 7 的基础上继续做什么？

## 模块 8：事件流、交易历史与任务时间线

目标：把链上发生过的事做成可扫描的历史，而不是只显示最后一次结果。

> 代码进度（2026-06-22）：已写到 `getLogs -> parseEventLogs -> block range 分页 -> escrow event stream -> task timeline`。当前已新增 `src/lib/event-history.ts`、`src/hooks/useTaskEvents.ts`、`src/components/events-panel.tsx`、`src/components/task-timeline.tsx`、`src/lib/explorer.ts`，并在 `TaskConsole` 中接入模块 8。数据库、The Graph 和后端 indexer 仍留到后续阶段。

模块 5 和模块 7 已经解析过“当前这笔交易 receipt 里的事件”。模块 8 要往前走一步：

```text
不是只看刚刚发生的那笔交易
而是从合约部署块开始
按区间读取历史 logs
解析成任务事件
再组合成 escrow 事件流和单个 task 时间线
```

这一模块仍然不引入数据库和 indexer。先用前端直接读链，练清楚事件日志的基本模型：

```text
合约 emit event
  -> 区块保存 log
  -> RPC eth_getLogs 查询 log
  -> ABI parse 成事件名和 args
  -> 前端排序、过滤、展示
```

模块 8 做完后，你应该能回答：

- event log 和合约 storage 有什么区别？
- 为什么 `TaskCompleted` 能从历史 logs 找到，但 `tasks(taskId)` 只能读当前状态？
- 为什么事件流不能从 `fromBlock: 0` 一次扫到最新块？
- `blockNumber`、`transactionHash`、`transactionIndex`、`logIndex` 分别有什么用？
- indexed event 参数为什么能被 RPC 过滤？
- 为什么前端分页扫事件只能作为课程和小规模工具方案？
- 什么时候该迁到 The Graph、indexer 服务或后端数据库？

学什么：

- `publicClient.getLogs` 和 `publicClient.getContractEvents`。
- `parseEventLogs` 把原始 logs 解析成事件。
- indexed 参数过滤和前端二次过滤。
- block range 分页。
- deployBlock 为什么是事件查询起点。
- RPC 限流、单次 block 跨度限制和降级策略。
- 事件排序：`blockNumber -> transactionIndex -> logIndex`。
- receipt 事件和历史事件流的区别。
- 单个任务时间线如何从多个事件合成。
- pending 交易、本地状态和链上确认事件的关系。
- 手动刷新和低频轮询。
- 什么时候不用前端硬扫，改用 The Graph / indexer / 数据库。

前置条件：

- `.env.local` 里已经配置 `NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS`。
- `.env.local` 里已经配置 `NEXT_PUBLIC_AGENT_TASK_ESCROW_DEPLOY_BLOCK`。
- 模块 5 已经能产生 `TaskCreated`、`TaskFunded` 或 `TaskFundedWithPermit`。
- 模块 7 已经能产生 `TaskIntentUsed`、`TaskCompleted`。
- 当前 RPC 能查询 Base Sepolia logs。
- 如果你的 RPC 单次只能扫 10 个区块，就把模块 8 的 block range 先设成 `10`，不要强行一次扫几千个区块。

说明：

- 模块 8 是读链，不需要钱包签名，也不花 gas。
- 查询事件用的是 RPC 的 `eth_getLogs`，不是读合约 storage。
- 事件历史只能证明合约发出过什么事件，不能代替当前 storage 状态。
- 课程阶段可以前端分页查询；真实产品里事件量变大后要迁到 indexer 或数据库。
- `IntentSigned` 不是链上事件。模块 6 的签名只存在本地内存里，除非模块 7 提交成功，链上才会出现 `TaskIntentUsed`。

推荐文件落点：

```text
src/lib/event-history.ts        getLogs 分页、解析、归一化、排序
src/hooks/useTaskEvents.ts      react-query 包装事件流查询
src/components/events-panel.tsx escrow 事件流面板
src/components/task-timeline.tsx 单个 task 时间线
src/lib/explorer.ts             tx / block / address 的 BaseScan 链接工具
src/components/task-console.tsx 组合模块 8 面板
```

职责边界：

| 文件 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `event-history.ts` | 拉 logs、分页、解析、归一化、排序 | React 状态和页面布局 |
| `useTaskEvents.ts` | 用 react-query 调用事件查询、处理刷新 | ABI 细节和 UI |
| `events-panel.tsx` | 展示 escrow 全局事件流、刷新按钮、错误状态 | 写链操作 |
| `task-timeline.tsx` | 展示单个任务从创建到完成的时间线 | 全局事件查询策略 |
| `explorer.ts` | 生成 BaseScan 链接 | 业务判断 |

### 1. 先理解 event log

Solidity 里：

```solidity
emit TaskCreated(taskId, client, operator, token, amount, service, refundAfter);
```

执行后不会把事件写进 `tasks(taskId)` storage。它会写进交易 receipt 的 logs 里，并跟随区块保存。

所以：

```text
storage
  -> 当前状态
  -> tasks(taskId) 读到的是现在的 Task

event logs
  -> 历史轨迹
  -> TaskCreated / TaskFunded / TaskCompleted 告诉你过去发生过什么
```

比如任务完成后：

```text
tasks(taskId).status = Completed
```

但你想知道它什么时候创建、什么时候注资、什么时候完成，就要查事件。

### 2. 模块 8 要展示哪些事件

`AgentTaskEscrowWithPermit` 主线至少展示：

```text
TaskCreated
TaskFunded
TaskFundedWithPermit
TaskIntentUsed
TaskCompleted
TaskRefunded
TaskCancelled
Paused
Unpaused
```

其中：

| 事件 | 含义 |
| --- | --- |
| `TaskCreated` | 任务被创建，记录 client、operator、token、amount、service、refundAfter |
| `TaskFunded` | client 用普通 `approve + fundTask` 注资 |
| `TaskFundedWithPermit` | client 用 permit 注资 |
| `TaskIntentUsed` | client 的 EIP-712 授权签名已被使用，nonce 被消耗 |
| `TaskCompleted` | 任务完成，resultURI 写入，token 支付给 operator |
| `TaskRefunded` | 超过 refundAfter 后 client 退款 |
| `TaskCancelled` | 未注资任务被 client 取消 |
| `Paused` | 管理员暂停合约 |
| `Unpaused` | 管理员恢复合约 |

先不要把 ERC-20 `Transfer` 全量混进来。模块 8 的主线是 escrow 业务事件。

### 3. deployBlock 是事件查询起点

不要这样：

```ts
fromBlock: 0n
```

原因：

```text
浪费 RPC 请求
很容易超过服务商 block range 限制
容易被限流
页面很慢
```

应该从合约部署块开始：

```text
fromBlock = CONTRACTS.escrow.deployBlock
toBlock = latestBlock
```

如果 `deployBlock` 没配置，模块 8 的 UI 应该提示：

```text
缺少 escrow deployBlock，不能查询历史事件。
```

不要静默退回到 `0`。

### 4. block range 分页

公共 RPC 或免费 RPC 经常限制单次 `eth_getLogs` 的区块跨度。

所以模块 8 要按小窗口分页：

```text
deployBlock -> deployBlock + rangeSize - 1
deployBlock + rangeSize -> deployBlock + rangeSize * 2 - 1
...
直到 latestBlock
```

示例：

```ts
export function buildBlockRanges(fromBlock: bigint, toBlock: bigint, size: bigint) {
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];

  for (let start = fromBlock; start <= toBlock; start += size) {
    const end = start + size - 1n;
    ranges.push({
      fromBlock: start,
      toBlock: end > toBlock ? toBlock : end,
    });
  }

  return ranges;
}
```

如果你的 RPC 只能扫 10 个区块：

```text
rangeSize = 10n
```

这不是数据库问题，是 RPC 限制问题。小规模课程项目可以慢一点分页扫；数据量变大后再上 indexer。

### 5. 读取原始 logs

最通用的方式是按合约地址查 logs：

```ts
const logs = await publicClient.getLogs({
  address: escrow,
  fromBlock,
  toBlock,
});
```

这会拿到这个合约在区间内发出的原始 logs。

原始 log 里有：

```text
address
topics
data
blockNumber
transactionHash
transactionIndex
logIndex
```

但它还不知道这是 `TaskCreated` 还是 `TaskCompleted`。下一步需要 ABI 解析。

### 6. 解析事件

用：

```ts
const parsed = parseEventLogs({
  abi: agentTaskEscrowAbi,
  logs,
});
```

解析后会得到：

```text
eventName
args
blockNumber
transactionHash
transactionIndex
logIndex
```

比如：

```ts
if (log.eventName === "TaskCompleted") {
  const args = log.args as {
    taskId: bigint;
    client: `0x${string}`;
    operator: `0x${string}`;
    resultURI: string;
  };
}
```

注意：如果 ABI 没同步，或者 ABI 里没有对应事件，解析结果就会缺失或类型不对。

### 7. `getLogs` 和 `getContractEvents` 怎么选

模块 8 可以这样理解：

```text
getLogs
  -> 更底层
  -> 适合一次拿某个合约的一批 logs，再自己 parse 和归一化

getContractEvents
  -> 更合约友好
  -> 适合查某一个 eventName，也可以配合 indexed args 过滤
```

查全局事件流时，推荐先用：

```text
getLogs + parseEventLogs
```

查单个事件、单个 indexed 参数时，可以用：

```ts
const created = await publicClient.getContractEvents({
  address: escrow,
  abi: agentTaskEscrowAbi,
  eventName: "TaskCreated",
  args: { taskId },
  fromBlock,
  toBlock,
});
```

`taskId`、`client`、`operator` 这些带 `indexed` 的参数可以让 RPC 在 topics 层面过滤。

但是不是所有字段都能这样过滤。比如 `service`、`resultURI` 不是 indexed，就只能解析后在前端过滤。

### 8. 归一化事件

不同事件的 args 不一样，UI 不适合直接吃原始 log。

建议先统一成一种前端类型：

```ts
type TaskHistoryEvent = {
  id: string;
  kind:
    | "TaskCreated"
    | "TaskFunded"
    | "TaskFundedWithPermit"
    | "TaskIntentUsed"
    | "TaskCompleted"
    | "TaskRefunded"
    | "TaskCancelled"
    | "Paused"
    | "Unpaused";
  taskId?: bigint;
  client?: `0x${string}`;
  operator?: `0x${string}`;
  token?: `0x${string}`;
  amount?: bigint;
  service?: string;
  resultURI?: string;
  nonce?: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
  transactionIndex: number;
  logIndex: number;
};
```

`id` 可以用：

```text
transactionHash + ":" + logIndex
```

这样 React list key 稳定。

### 9. 稳定排序

链上事件必须稳定排序。

推荐排序键：

```text
blockNumber
transactionIndex
logIndex
```

升序适合时间线：

```text
创建 -> 注资 -> 完成
```

降序适合全局事件流：

```text
最新事件在上面
```

不要只按 `blockNumber` 排。一个区块里可能有多笔交易，一笔交易里也可能有多个 log。

### 10. 时间显示怎么做

event log 自带 `blockNumber`，但不直接带 timestamp。

要显示本地时间，需要再查 block：

```ts
const block = await publicClient.getBlock({ blockNumber });
```

然后用：

```ts
block.timestamp
```

注意：

```text
同一个 block 里的多个事件共用一个 timestamp
```

所以应该缓存 block timestamp，不要每条事件都重复查一次。

课程阶段可以先显示：

```text
blockNumber
```

然后再补 timestamp 缓存。

### 11. escrow 全局事件流

全局事件流展示合约发生过的所有核心业务事件。

UI 至少显示：

```text
事件名
taskId
主要地址 client / operator / account
amount
service / resultURI
blockNumber
tx hash
BaseScan 链接
```

示例展示：

```text
TaskCompleted
task #3
operator 0x1234...abcd
resultURI demo-result://task-3
block 12345678
tx 0xabcd...
```

空状态要显示：

```text
还没有查询到事件。
```

不要显示成错误。

### 12. 单个 task 事件流

单个任务只展示某个 `taskId` 相关事件。

可以先简单做：

```text
先查 escrow 全部事件
再在前端过滤 event.taskId === 当前 taskId
```

如果事件量变大，再改成按 indexed `taskId` 分事件查询：

```text
TaskCreated(taskId)
TaskFunded(taskId)
TaskFundedWithPermit(taskId)
TaskIntentUsed(taskId)
TaskCompleted(taskId)
TaskRefunded(taskId)
TaskCancelled(taskId)
```

注意：

```text
Paused / Unpaused 没有 taskId
```

它们属于合约级事件，不属于某个单独任务。

### 13. 任务时间线

时间线不是简单把事件列表原样展示，而是把业务阶段表达出来：

```text
TaskCreated
  -> TaskFunded 或 TaskFundedWithPermit
  -> TaskIntentUsed
  -> TaskCompleted
```

如果任务被取消：

```text
TaskCreated
  -> TaskCancelled
```

如果任务被退款：

```text
TaskCreated
  -> TaskFunded
  -> TaskRefunded
```

模块 6 的 `IntentSigned` 要特别处理：

```text
IntentSigned 是本地签名状态，不是链上事件
```

页面可以在当前 session 里显示它，但不要把它当作历史链上事件。刷新页面后它就消失是正常的。

### 14. pending 状态和 confirmed 事件

写链流程里会出现三种状态：

```text
pending
  -> 交易已发出，还没进区块

confirmed
  -> receipt.status 是 success，链上已确认

event indexed
  -> 历史事件查询已经能从 getLogs 查到
```

模块 7 成功后能从 receipt 里立即解析 `TaskCompleted`。

模块 8 刷新历史事件时，也应该能从 `getLogs` 再查到同一条事件。

这两者要能对上：

```text
同一个 transactionHash
同一个 logIndex
同一个 eventName
```

### 15. 手动刷新和低频轮询

模块 8 不要高频扫 logs。

建议先做：

```text
手动刷新按钮
```

如果要自动刷新，用低频：

```ts
refetchInterval: 30_000
```

不要每秒扫一次历史区间。

更好的策略是：

```text
历史区间：缓存
最新区间：低频刷新
刚发出的交易：receipt 直接展示
```

课程阶段可以先简单：

```text
点击刷新 -> 重新从 deployBlock 分页扫到 latestBlock
```

但要知道这不是大规模生产方案。

### 16. 错误和降级策略

常见错误：

| 错误 | 可能原因 | UI 提示 |
| --- | --- | --- |
| block range 太大 | RPC 限制单次查询跨度 | 请调小事件查询区间 |
| rate limited | 请求太频繁或免费额度不足 | RPC 被限流，请稍后重试或换自带 key |
| missing deployBlock | 没填部署块 | 请先配置 escrow deploy block |
| invalid address | escrow 地址不合法 | 请检查合约地址 |
| no logs | 区间内没有事件 | 显示空状态 |
| parse failed | ABI 与合约不一致 | 请重新导出 ABI |

如果查询失败，不要让整个页面崩掉。事件面板可以单独显示错误，其他读链和写链模块继续可用。

### 17. 为什么暂时不用数据库

模块 8 先不用数据库是为了把底层概念学清楚：

```text
event 是怎么被 emit 的
RPC 怎么按 block range 查
ABI 怎么解析 log
task timeline 怎么由事件合成
```

只要课程阶段任务数量不大，部署块距离当前块不远，前端分页读是可以接受的。

但是你要知道边界：

```text
区块越来越多
事件越来越多
需要跨用户搜索
需要复杂筛选
需要秒级刷新
需要可靠历史缓存
需要统计分析
```

这时就不要继续让浏览器硬扫。应该迁到：

```text
The Graph
自建 indexer
后端定时同步 logs
数据库缓存
```

这些放到后续 Layer 4 / Capstone，不在模块 8 一开始就上。

操作练习：

1. 配置事件查询参数。

至少确认：

```text
escrow address
escrow deployBlock
latestBlock
rangeSize
```

如果 `deployBlock` 缺失，事件查询按钮禁用。

2. 写 block range 工具。

输入：

```text
fromBlock
toBlock
rangeSize
```

输出：

```text
[{ fromBlock, toBlock }, ...]
```

要求：

```text
最后一个区间不能超过 latestBlock
rangeSize 可以很小，例如 10n
fromBlock 不能大于 toBlock
```

3. 展示 escrow 事件流。

至少包括：

- `TaskCreated`。
- `TaskFunded` / `TaskFundedWithPermit`。
- `TaskIntentUsed`。
- `TaskCompleted`。
- `TaskRefunded`。
- `TaskCancelled`。
- `Paused` / `Unpaused`。

展示字段至少包括：

```text
eventName
taskId
主要地址
amount / resultURI / service
blockNumber
transactionHash
BaseScan tx 链接
```

4. 展示 task 事件流。

至少包括：

- `TaskCreated`。
- `TaskFunded` / `TaskFundedWithPermit`。
- `TaskIntentUsed`。
- `TaskCompleted`。
- `TaskRefunded` / `TaskCancelled`。

通过输入：

```text
taskId
```

过滤出单个任务的事件。

5. 做一条任务时间线。

```text
TaskCreated
  -> TaskFunded
  -> CompleteTaskPending
  -> TaskIntentUsed
  -> TaskCompleted
```

注意：

```text
CompleteTaskPending 是前端本地 pending 状态
TaskIntentUsed / TaskCompleted 是链上 confirmed 事件
```

6. 给每条事件加 BaseScan 链接。

至少支持：

```text
交易链接：/tx/{transactionHash}
区块链接：/block/{blockNumber}
地址链接：/address/{address}
```

7. 处理空状态和错误状态。

要有：

```text
还没有事件
正在查询
查询失败
deployBlock 未配置
RPC 限流
block range 太大
```

8. 控制刷新频率。

先做手动刷新：

```text
刷新事件
```

再考虑低频自动刷新：

```ts
refetchInterval: 30_000
```

不要高频轮询全历史。

验收：

- 事件按 block number / log index 稳定排序。
- 每条事件都能跳到 BaseScan。
- 地址、金额、时间格式可读。
- 没有事件时显示空状态，不是报错。
- `getLogs` 从合约部署块开始、按 block range 分页，公共 RPC 限流或超范围时有可读错误并能降级。
- `deployBlock` 未配置时不会从 `0` 开始硬扫。
- `TaskCreated`、`TaskFunded`、`TaskCompleted` 能在全局事件流看到。
- 输入某个 `taskId` 后，只显示这个任务相关事件。
- 模块 7 刚完成的 `TaskCompleted` 能在模块 8 刷新后查到，并且 `transactionHash` 对得上。
- `TaskIntentUsed` 和 `TaskCompleted` 都能解析。
- `Paused` / `Unpaused` 能作为合约级事件展示，不强行塞进单个 task 时间线。
- 查询失败不会影响钱包连接、读 task、写链面板。
- `pnpm exec tsc --noEmit`、`pnpm lint`、`pnpm build` 通过。

复习题：

1. event log 和 contract storage 有什么区别？
2. 为什么 `tasks(taskId)` 只能读当前状态，不能告诉你完整历史？
3. 为什么不能从 `fromBlock: 0` 扫事件？
4. `deployBlock` 在事件查询里起什么作用？
5. `blockNumber`、`transactionIndex`、`logIndex` 为什么要一起用于排序？
6. `transactionHash` 和 event log 是什么关系？
7. `getLogs` 和 `getContractEvents` 有什么区别？
8. `parseEventLogs` 需要 ABI 的原因是什么？
9. indexed 参数为什么能被 RPC 过滤？
10. 哪些字段不能用 indexed 参数过滤，只能解析后前端过滤？
11. 为什么模块 6 的 `IntentSigned` 不是链上事件？
12. `TaskIntentUsed` 和 `TaskCompleted` 在时间线里分别表示什么？
13. 为什么 receipt 里的事件和 `getLogs` 查到的事件应该能对上？
14. RPC 提示 block range 太大时，前端应该怎么降级？
15. 什么时候应该从前端分页查询迁到 The Graph / indexer / 数据库？

## 模块 9：错误处理、安全提示与验收清单

目标：把最容易出事故的边界都变成清楚的用户体验。

学什么：

- 用户拒签和交易失败的区别。
- RPC 失败、钱包断开、链切换中的状态处理。
- 合约 revert 的错误解释。
- 前端输入校验。
- 签名风险提示。
- 公开配置和敏感配置边界。
- 最小测试策略。

常见错误分类：

| 错误 | 可能原因 | UI 应该怎么说 |
| --- | --- | --- |
| Chain mismatch | 钱包不在 Base Sepolia | 请切换到 Base Sepolia 后继续 |
| User rejected | 用户取消签名或交易 | 你取消了这次操作，链上没有变化 |
| Insufficient balance | USDC 或 ETH 不足 | 余额不足，无法完成交易或支付 gas |
| Allowance too low | 未授权或授权不足 | 需要先授权 escrow 使用 token |
| Contract paused | escrow 已暂停 | 当前合约暂停，暂时不能创建、注资、完成或退款 |
| Invalid signature | EIP-712 domain/message 不一致 | 签名内容无效，请重新生成任务意图 |
| Expired intent | deadline 已过 | 任务意图已过期，请重新签名 |
| Nonce mismatch | 签名已使用或 nonce 过旧 | 当前签名不可重复使用，请刷新 nonce |
| Invalid status | task 状态不允许当前动作 | 请刷新任务状态后重试 |
| Refund not available | 还没到 refundAfter | 当前任务还不能退款 |

最小测试策略：

| 测试层级 | 覆盖对象 | 建议工具 |
| --- | --- | --- |
| 单元测试 | 金额解析、`formatUnits` 包装、地址缩写、错误分类函数 | Vitest |
| Hook / 组件测试 | 钱包未连接、链 ID 错误、余额不足、用户拒签后的 UI 状态 | Vitest + Testing Library |
| 手工 / E2E 验收 | createTask、approve + fundTask、EIP-712 签名、`completeTask`、事件流刷新 | Playwright 或手工清单 |

到模块 9 时补测试依赖和脚本：

```bash
pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

`package.json` 至少准备：

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

优先把纯函数和错误分类测起来；钱包弹窗和真实链交互可以先用手工验收，等流程稳定后再补 Playwright。

验收：

- 所有写链动作前都有确认摘要。
- 网络错误、用户拒签、revert、RPC 失败都有不同文案。
- 不在前端状态、日志、URL 中暴露 secret。
- 页面刷新后还能从链上恢复 escrow 状态、任务状态和事件流。
- `pnpm lint`、`pnpm build`、核心纯函数测试通过。

## 最终验收标准

完成 Layer 3 时，你应该能交付一个能跑的链上操作台：

```text
连接钱包
检查 Base Sepolia
读取 escrow / token / task 状态
完成 createTask + approve + fundTask
生成并签署 EIP-712 TaskIntent
提交 completeTask 交易
等待 receipt
解析并展示事件流
展示交易历史和失败原因
```

必须满足：

- chain ID 不对时禁止继续。
- 用户拒签时 UI 明确显示，不误报为链上失败。
- 发交易前展示目标地址、函数名、金额或任务摘要。
- 失败交易能回看失败原因。
- 事件流能和 BaseScan 对上。
- 前端不包含私钥、助记词或后端 secret。

推荐验收命令：

这里的 `pnpm build` 和 `pnpm dev` 默认走前面配置好的 webpack 脚本。

```bash
cd /home/lenovo/solidity-course/ata/layer3/task-console
pnpm lint
pnpm test
pnpm build
pnpm dev
```

手工验收：

1. 钱包未连接时，所有写链按钮禁用。
2. 钱包在非 Base Sepolia 时，页面要求切换网络。
3. 测试钱包有 Base Sepolia ETH 和可用测试 token，或者明确切到 Layer 2 的 `PermitToken`。
4. 输入 0 token 或超过余额时，不能提交。
5. createTask 成功后，可以继续 approve / fundTask。
6. fundTask 成功后，task 状态和 `TaskFunded` 事件刷新。
7. EIP-712 签名前能看懂任务摘要。
8. `completeTask` 成功后，能看到 `TaskIntentUsed` 和 `TaskCompleted` 事件。
9. 同一签名重复提交会被阻止或显示 nonce 错误。
10. EIP-1271 不强塞进 Layer 3 主线，只作为 Layer 4 衔接点保留。

## 复习自测

1. `readContract`、`simulateContract`、`writeContract`、`waitForTransactionReceipt` 各自解决什么问题？
2. 为什么 EIP-712 的 domain 必须包含 `chainId` 和 `verifyingContract`？
3. 为什么签名不花 gas，但提交签名给合约会花 gas？
4. `approve` 成功但 `fundTask` 失败时，链上状态发生了什么？
5. 为什么不能在前端保存私钥或助记词？
6. event logs 和合约 storage 有什么区别？
7. 用户拒签、RPC 失败、合约 revert 应该如何区分？
8. 为什么前端不能自己猜 nonce，而要从链上读取？
9. 什么时候用 `useReadContract`（hook），什么时候用裸 `publicClient.readContract`？react-query 在中间帮你做了什么？
10. 为什么 `getLogs` 不能 `fromBlock: 0` 一把扫到头？公共 RPC 和自带 key 的 RPC 在这件事上差别在哪？
11. 为什么 Layer 3 先跑 EOA 的 `AgentTaskEscrowWithPermit` EIP-712 签名，而把 EIP-1271 留到 Layer 4？

## 下一步怎么接 Layer 4

Layer 3 完成后，前端已经能让人类安全地看见、确认和执行链上动作。Layer 4 会把“每次都由人手动点确认”升级为“给 agent 一把受限 session key”：

```text
Layer 3：人连接钱包、签名、发交易、看事件
Layer 4：智能账户 + session key + policy + paymaster，让 agent 在权限边界内执行
```

所以 Layer 3 的控制台不要做成一次性 demo。后面它会继续展示 smart account 地址、session key 权限、额度、过期时间、paymaster 状态和 agent 最近动作。

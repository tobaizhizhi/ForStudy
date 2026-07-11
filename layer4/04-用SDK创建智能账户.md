# 模块 3：用 SDK 创建智能账户并发出第一笔赞助交易

前两模块讲透了“为什么”和“架构”。这一模块开始动手：用 **permissionless.js + Pimlico** 在 Base Sepolia 上创建一个智能账户，并发出第一笔 **gas 被赞助**的交易。

全程我们**不手写 `UserOperation`、不手算 userOpHash、不碰 bundler / paymaster 的 RPC**——这些交给 SDK。这正是路线图要求的“优先用 SDK”。

> 目标：跑出一个真实的智能账户地址，并让它在自己一分 ETH 都没有的情况下，成功发出一笔上链交易。

## 学什么

- Pimlico bundler + paymaster 的接入。
- `toSimpleSmartAccount`：由 owner 反事实推导账户地址。
- `createSmartAccountClient`：把 bundler + paymaster 接上，得到一个“像钱包一样”的客户端。
- `sendTransaction`：SDK 背后帮你组装 + 签名 + 赞助 + 打包 UserOperation。
- 反事实地址（部署前就能拿到地址）、首笔交易触发部署。

## 前置条件

- 完成模块 1、2。
- 一个只放测试网资产的钱包私钥（owner）。
- 一个 [Pimlico](https://dashboard.pimlico.io) API key（建 project 后拿到；给它设额度和域名限制）。
- 本机 Node 20+、pnpm。
- 代码落点：`layer4/agent-wallet/`（脚手架已建好）。

Base Sepolia faucet 拿点 ETH 不是给智能账户用的（gas 由 paymaster 出），而是给你可能要用的 owner EOA 备用。真正的“无 gas 也能发交易”正是这一模块要演示的。

## 操作练习

### 1. 装依赖

```bash
cd /home/lenovo/solidity-course/ata/layer4/agent-wallet
pnpm install
```

依赖只有两个核心包：

```json
{
  "dependencies": {
    "permissionless": "^0.2.36",
    "viem": "^2.21.54"
  }
}
```

> `permissionless` 建立在 `viem` 之上，和 Layer 3 的技术栈一脉相承。选它就是因为它最 viem-native、最“开放基础设施”。

### 2. 配环境变量

复制 `.env.example` 成 `.env`，至少填：

```env
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PIMLICO_API_KEY=你的_pimlico_key
OWNER_PRIVATE_KEY=0x你的测试钱包私钥
```

【安全提示】`PIMLICO_API_KEY` 决定“谁替你付 gas”，泄露了别人能刷爆你的赞助额度。只放做了额度 / 域名限制的 key，且 `.env` 不提交。

### 3. 把链、Pimlico、EntryPoint 配好

`src/config.ts`（脚手架已写好）：

```ts
import "dotenv/config";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";

export const CHAIN = baseSepolia;
export const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

// Pimlico 同一个 endpoint 同时充当 bundler 和 paymaster。
export const PIMLICO_URL = `https://api.pimlico.io/v2/${CHAIN.id}/rpc?apikey=${required("PIMLICO_API_KEY")}`;

// 本课程用 EntryPoint v0.7；要用 v0.8 就换 entryPoint08Address + version: "0.8"。
export const ENTRY_POINT = { address: entryPoint07Address, version: "0.7" } as const;

export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
export const pimlicoClient = createPimlicoClient({
  transport: http(PIMLICO_URL),
  entryPoint: ENTRY_POINT,
});
```

要点：

- Pimlico 在 Base Sepolia 的 endpoint 形如 `https://api.pimlico.io/v2/84532/rpc?apikey=...`，它**同时是 bundler 和 paymaster**。
- `ENTRY_POINT` 明确写 v0.7。换版本只改这一处。

### 4. 构造智能账户客户端

`src/smartAccount.ts`：

```ts
import { http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { CHAIN, ENTRY_POINT, PIMLICO_URL, pimlicoClient, publicClient } from "./config";

export async function buildSmartAccountClient(ownerPrivateKey: Hex) {
  const owner = privateKeyToAccount(ownerPrivateKey);

  // 由 owner 反事实推导出一个 SimpleAccount 地址（此刻还没上链）
  const account = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: ENTRY_POINT,
  });

  // 把 bundler（发 UserOp）和 paymaster（代付 gas）接上
  const smartAccountClient = createSmartAccountClient({
    account,
    chain: CHAIN,
    bundlerTransport: http(PIMLICO_URL),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return { owner, account, smartAccountClient };
}
```

【学习提示】对照模块 2 的架构图：

- `toSimpleSmartAccount` 对应“Account + Factory”：它知道怎么算地址、怎么在首笔交易里塞 `initCode` 部署自己。
- `paymaster: pimlicoClient` 对应“Paymaster”：SDK 会自动去要赞助数据填进 `paymasterAndData`。
- `userOperation.estimateFeesPerGas` 让 SDK 用 Pimlico 建议的 gas price。
- `createSmartAccountClient` 返回的对象用起来**像一个普通钱包**（有 `sendTransaction`），但底层全走 UserOperation。

【重要提醒】这里选的 `toSimpleSmartAccount`（SimpleAccount）是 eth-infinitism 的**最小参考账户：单 owner、没有 session key**，它的 `validateUserOp` 只做一件事——`owner == recover(签名)`。选它是为了先把「UserOp → paymaster → bundler」这条流水线讲干净。但它天生不支持下一模块的 session key。**想「用成熟 SDK + session key」，要换成模块化账户（ZeroDev Kernel 等），而不是 SimpleAccount**——这条路线会在模块 4（5.6 节）完整展开。别把「permissionless 这层」误当成 session key 的来源：session key 是**账户实现层**的能力。

### 5. 建号 + 发第一笔赞助交易

`src/createAccount.ts`：

```ts
import { formatEther } from "viem";
import { OWNER_PRIVATE_KEY, explorerTx, publicClient } from "./config";
import { buildSmartAccountClient } from "./smartAccount";

async function main() {
  const { owner, account, smartAccountClient } = await buildSmartAccountClient(OWNER_PRIVATE_KEY);

  console.log("owner (EOA)   :", owner.address);
  console.log("smart account :", account.address);

  const code = await publicClient.getCode({ address: account.address });
  console.log("是否已部署    :", code && code !== "0x" ? "是" : "否（下面这笔 UserOp 会部署它）");

  // 发一笔最小自调用（value=0），触发账户部署 + 走一遍 bundler/paymaster 全链路。
  // gas 由 paymaster 赞助，所以账户里可以一分 ETH 都没有。
  const hash = await smartAccountClient.sendTransaction({
    to: account.address,
    value: 0n,
    data: "0x",
  });

  console.log("已提交赞助交易:", explorerTx(hash));
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("上链状态      :", receipt.status);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

运行：

```bash
pnpm create-account
```

预期输出（地址会不同）：

```text
owner (EOA)   : 0xYourEoa...
smart account : 0xYourSmartAccount...
是否已部署    : 否（下面这笔 UserOp 会部署它）
已提交赞助交易: https://sepolia.basescan.org/tx/0x....
上链状态      : success
```

到 BaseScan 打开那个链接，你会看到：这笔交易是 Bundler 调 `EntryPoint.handleOps`，你的智能账户在这一笔里被**部署**并执行了自调用，而 **gas 是 paymaster 付的**——你的智能账户余额始终是 0。

【学习提示】再跑一次 `pnpm create-account`，这次“是否已部署”会显示“是”，因为账户已经上链，`initCode` 不再需要。

## 常见问题

#### `Missing env PIMLICO_API_KEY`

`.env` 没填或没被加载。确认 `.env` 在 `agent-wallet/` 目录、`config.ts` 顶部有 `import "dotenv/config"`。

#### `AA21 didn't pay prefund` / paymaster 相关报错

paymaster 没同意赞助，或 Pimlico 项目没开 sponsorship policy。去 Pimlico dashboard 确认这条链的 sponsorship policy 已启用、额度没用完。

#### `AA10 sender already constructed`

账户已经部署过了，但 SDK 还想带 `initCode`。通常是缓存 / 重复调用问题，重跑一次即可（第二次不会再带 initCode）。

#### 交易一直 pending

Base Sepolia 偶尔拥堵，或 gas price 估低了。`estimateFeesPerGas` 用 `.fast` 一般够；也可以等一会或重发。

#### 智能账户地址每次都不一样

`toSimpleSmartAccount` 的地址由 owner + entryPoint + 一个 salt/index 决定。owner 不变、参数不变，地址就固定。地址变了通常是换了 owner 私钥或 SDK 参数。

## 验收

- 能打印出 owner EOA 和智能账户地址，且智能账户地址在部署前就有值。
- 第一次运行时账户未部署，交易上链后账户已部署。
- 交易 gas 由 paymaster 赞助，智能账户 ETH 余额为 0 也能发成功。
- BaseScan 上能看到这笔 `handleOps` 交易和 `UserOperationEvent`。
- 全程没有手写 `UserOperation`、userOpHash、bundler / paymaster 的 RPC 调用。
- `pnpm typecheck` 通过。

## 复习题

1. `toSimpleSmartAccount` 返回的 `account.address`，为什么在还没发任何交易时就有值？
2. `createSmartAccountClient` 把哪两个基础设施接了进来？
3. 智能账户里没有 ETH，为什么还能发交易？是谁付的 gas？
4. 你运行脚本拿到的 `txHash` 对应链上的哪一笔交易？谁是这笔交易的 `from`？
5. 第一次和第二次运行 `create-account`，`initCode` 的处理有什么不同？
6. 换成 EntryPoint v0.8 要改哪里？
7. `PIMLICO_API_KEY` 泄露会有什么后果？怎么降低风险？

下一模块进入本层的核心：给 agent 发一把**受限 session key**，并把作用域、额度、过期、撤销全部落到链上。

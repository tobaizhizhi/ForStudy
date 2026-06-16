# Layer 1 课程大纲 - 区块链 & EVM 基础

目标：把“链上发生了什么”讲清楚、看得懂、查得到、能安全地在测试网动手。Layer 1 不急着写复杂合约，重点是理解一笔交易从本地签名、进入 RPC / mempool、被打包、执行、产生 receipt / logs，到最终确认的全过程。

这一层开始，你会逐步从 Layer 0 的 mock 链上工具，过渡到真实测试网。第一原则仍然是：**有成熟工具就用成熟工具，不手写底层轮子**。

## 学习原则

- 全程使用测试网：优先 Base Sepolia / Sepolia，不在主网用真资金实验。
- 工具优先：查链用区块浏览器 / `cast` / `viem`，签名与编码用钱包 / `viem` / `ethers` / Foundry，不手写 ECDSA、RLP、ABI 编码、RPC 客户端。
- 先读后写：先学会查 block、transaction、receipt、logs，再发送测试网交易。
- 每个交易都能解释：能说清楚 `from`、`to`、`nonce`、`value`、`data`、`gas`、`maxFeePerGas`、`chainId`、receipt、event logs 分别是什么意思。
- 安全默认开启：私钥只放 `.env`，不要提交；日志不要打印私钥、助记词、API key、完整 RPC key。

## 推荐工具栈

| 关注点 | 优先工具 | 用来做什么 | 不要做什么 |
| --- | --- | --- | --- |
| 钱包 | MetaMask / Rabby / 测试钱包 | 手动发测试网交易、签名 | 不要用主钱包和真实资产实验 |
| 命令行查链 | Foundry `cast` | 查余额、查交易、发简单交易、ABI 编解码 | 不要自己拼 JSON-RPC 请求 |
| 本地链 | Foundry `anvil` | 本地模拟交易、调试 gas / nonce | 不要直接在主网调试 |
| TS 链交互 | `viem` | 读链、发交易、等 receipt、解析 logs | 不要手写 RPC client |
| 区块浏览器 | BaseScan / Etherscan | 读 block、tx、receipt、logs、合约信息 | 不要只依赖钱包弹窗理解交易 |
| EVM 理解 | evm.codes | 查 opcode、gas、执行语义 | 不要一开始背 opcode |
| 调试/模拟 | Tenderly / Foundry trace | 看执行路径、revert 原因 | 不要靠猜定位失败交易 |

## 模块 1：Layer 1 心智模型与工具准备

目标：知道自己接下来用哪些工具观察链，而不是只看钱包 UI。

学什么：

- 区块链的最小组成：block、transaction、state、receipt、logs。
- RPC 节点是什么，钱包和脚本为什么都要连 RPC。
- 测试网和主网的区别。
- Base Sepolia / Sepolia 的区块浏览器、faucet、RPC。
- Foundry 工具中的 `cast` / `anvil` 分别负责什么。

核心概念：五个角色分别干什么。

| 角色 | 它是什么 | 它负责什么 | 你现在怎么用 |
| --- | --- | --- | --- |
| 钱包 | 管理账户和私钥的工具，例如 MetaMask / Rabby | 保存私钥、展示交易内容、签名、发交易 | 用测试钱包签名、领取测试币、手动发测试网交易 |
| RPC | 连接区块链节点的接口地址 | 让钱包、脚本、工具能读链和发交易 | `https://sepolia.base.org` 就是 Base Sepolia 的 RPC |
| 区块浏览器 | 把链上数据做成网页的网站，例如 BaseScan | 查看地址、余额、交易、区块、receipt、logs | 用它核对交易是否成功、余额是否到账 |
| `cast` | Foundry 提供的命令行工具 | 查余额、查区块、查交易、发简单交易、ABI 编解码 | 用命令快速验证 RPC、余额、nonce、交易状态 |
| `viem` | TypeScript 链交互库 | 在代码里读链、写链、签名、解析 ABI / logs | 后面用它写脚本和前端链交互逻辑 |

它们之间的关系可以先这样记：

```text
人 / 脚本
  -> 钱包 / cast / viem
  -> RPC 节点
  -> 区块链网络
```

区块浏览器不是用来发交易的核心工具，它更像一个“链上数据查看器”：你发完交易后，用它确认链上实际发生了什么。

操作练习：

```bash
cd /home/lenovo/solidity-course/ata/layer1
foundryup
cast --version
anvil --version
```

准备一个 `.env.example`，记录需要的配置名，但不要放真实私钥：

```env
BASE_SEPOLIA_RPC_URL=
SEPOLIA_RPC_URL=
TEST_PRIVATE_KEY=
TEST_ADDRESS=
```

操作示例：

1. 先确认你连到的是 Base Sepolia，而不是别的网络。

```bash
cast chain-id --rpc-url $BASE_SEPOLIA_RPC_URL
cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL
```

你应该看到：`chainId = 84532`，block number 是一个正在增长的数字。

2. 看看测试地址是不是正确。

```bash
cast wallet address --private-key $TEST_PRIVATE_KEY
cast balance $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL --ether
```

这里你要理解的是：

- `wallet address` 会从私钥推导出地址。
- `balance` 只是查链，不会花 gas。
- 如果余额是 `0`，先去 faucet 领 Base Sepolia ETH，再继续。

3. 用区块浏览器交叉确认。

打开：

```text
https://sepolia.basescan.org/address/<你的地址>
```

你应该能看到这个地址在 Base Sepolia 上的余额、交易历史和代币记录。

验收：

- 能说清楚钱包、RPC、区块浏览器、`cast`、`viem` 各自扮演什么角色。
- 能解释为什么测试网私钥也不能提交到 Git。

## 模块 2：账户、地址、私钥与签名

目标：理解 EOA 和合约账户的区别，为后面的 EIP-712、EIP-1271、ERC-4337 打基础。

学什么：

- EOA：由私钥控制的普通钱包账户。
- Contract Account：由合约代码控制的账户。
- 地址、私钥、公钥的大致关系。
- `chainId` 为什么能防止跨链重放。
- `personal_sign`、交易签名、EIP-712 签名只是用途不同，底层都离不开签名验证。

核心概念：账户和签名分别是什么。

| 概念 | 简单理解 | 你要记住什么 |
| --- | --- | --- |
| 私钥 private key | 控制账户的秘密钥匙 | 谁拿到私钥，谁就能控制这个账户；绝不能泄露 |
| 公钥 public key | 由私钥推导出来的公开验证材料 | 可以公开，用来证明签名确实来自某个私钥 |
| 地址 address | 公钥哈希后得到的账户标识 | 地址可以公开，别人给你转账就用地址 |
| 签名 signature | 私钥对某段数据的授权证明 | 签名能证明“这个地址同意了这段内容” |
| EOA | 外部账户，普通钱包账户 | 有私钥，没有合约代码 |
| Contract Account | 合约账户 | 没有普通私钥，由合约代码控制 |

私钥、公钥、地址的关系可以先这样记：

```text
private key
  -> public key
  -> address
```

这个方向是单向的：可以从私钥推导出地址，但不能从地址反推出私钥。

EOA 和合约账户的区别：

| 对比项 | EOA 普通钱包 | Contract Account 合约账户 |
| --- | --- | --- |
| 是否有私钥 | 有 | 通常没有普通私钥 |
| 是否有代码 | 没有，`code` 通常是 `0x` | 有合约 bytecode |
| 谁控制它 | 私钥持有人 | 合约逻辑 |
| 能不能主动发起交易 | 能 | 不能主动发起，只能被交易或合约调用触发 |
| 后面对应什么 | 普通钱包、测试账户 | ERC-20、Safe、ERC-4337 smart account |

三种常见签名要分清：

| 签名类型 | 用来做什么 | 会不会花 gas | 是否默认绑定链 |
| --- | --- | --- | --- |
| 交易签名 | 授权链上状态变化，例如转账、调用合约 | 会，交易上链要 gas | 会，交易里包含 `chainId` |
| `personal_sign` | 签一段普通消息，例如登录证明 | 不会，只是签名 | 通常不会，除非消息内容自己写了链信息 |
| EIP-712 | 签结构化数据，例如任务意图、授权单 | 不会，除非后续拿签名去发交易 | 通常会在 domain 里绑定 `chainId` / verifying contract |

这里先学 `personal_sign` 和账户识别。EIP-712 会在 Layer 2 继续深入。

工具优先：

- 用钱包或 `cast wallet` 管理测试账户。
- 用 `viem` / `ethers` 做签名，不手写 secp256k1 / ECDSA。

操作练习：

1. 生成一个新的测试账户。

```bash
cast wallet new
```

你会看到类似信息：

```text
Successfully created new keypair.
Address:     0x...
Private key: 0x...
```

注意：这个私钥只能作为测试用。不要把它发给别人，不要提交到 Git。

2. 从私钥推导地址，确认 `.env` 里的 `TEST_PRIVATE_KEY` 和 `TEST_ADDRESS` 是一对。

```bash
cast wallet address --private-key $TEST_PRIVATE_KEY
```

如果输出地址和 `.env` 里的 `TEST_ADDRESS` 不一样，说明你填错了其中一个。

3. 从私钥推导公钥。

```bash
cast wallet public-key --raw-private-key $TEST_PRIVATE_KEY
```

这一步是为了看到：私钥可以推导出公钥，地址又来自公钥。但日常开发里你很少直接操作公钥。

4. 查这个地址在 Base Sepolia 上的余额。

```bash
cast chain-id --rpc-url $BASE_SEPOLIA_RPC_URL
cast balance $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
```

如果第一个命令输出 `84532`，说明你连的是 Base Sepolia。

5. 对比 EOA 和合约账户有没有代码。

先查你的测试钱包：

```bash
cast code $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
```

EOA 通常会输出：

```text
0x
```

再查一个 Base Sepolia 上的 USDC 测试合约地址：

```bash
cast code 0x036CbD53842c5426634e7929541eC2318f3dCF7e --rpc-url $BASE_SEPOLIA_RPC_URL
```

合约账户会输出一长串 bytecode。你现在不用读懂 bytecode，只要知道：

```text
code = 0x       大概率是 EOA
code != 0x      是合约账户
```

6. 用私钥签一段普通消息，再验证签名。

```bash
MESSAGE="hello layer1"
SIGNATURE=$(cast wallet sign "$MESSAGE" --private-key $TEST_PRIVATE_KEY)
echo $SIGNATURE
cast wallet verify --address $TEST_ADDRESS "$MESSAGE" "$SIGNATURE"
```

这里发生的是：

```text
TEST_PRIVATE_KEY 对 MESSAGE 签名
  -> 得到 SIGNATURE
  -> verify 用 TEST_ADDRESS 检查这个签名是不是它签出来的
```

这不会发交易，不会花 gas，不会改变链上状态。

7. 在钱包里做同样的事情。

打开任意支持签名测试的网站或本地 demo，用测试钱包签一段普通消息。签名前要观察钱包弹窗：

- 如果只是 `Sign message` / `personal_sign`，通常不会花 gas。
- 如果是 `Send transaction`，就是要发交易，会上链并可能花 gas。
- 如果看不懂签名内容，不要签。

这一点后面非常重要：agent 系统里，很多风险都来自“用户或 agent 签了自己没看懂的东西”。

验收：

- 能说清楚“地址不是私钥，地址可以公开，私钥不能公开”。
- 能说清楚 EOA 和合约账户都能有地址，但控制方式不同。
- 能解释 `chainId` 为什么会出现在签名和交易里。
- 能用 `cast code` 判断一个地址大概率是 EOA 还是合约账户。
- 能用 `cast wallet sign` 和 `cast wallet verify` 完成一次消息签名与验证。
- 能区分“签消息”和“发交易”：前者不上链、不花 gas；后者会上链、可能花 gas。

## 模块 3：交易生命周期与 gas

目标：能完整解释一笔交易从创建到确认经历了什么。

学什么：

- 交易字段：`from`、`to`、`nonce`、`value`、`data`、`chainId`。
- EIP-1559：`maxFeePerGas`、`maxPriorityFeePerGas`、base fee。
- gas limit、gas used、交易失败也会消耗 gas。
- mempool、打包、receipt、confirmations、finality。
- nonce 如何保证同一账户交易顺序。

核心概念：一笔交易最要盯住的字段。

| 字段 | 它是什么 | 你要怎么理解 |
| --- | --- | --- |
| `from` | 发送者地址 | 谁发起了这笔交易 |
| `to` | 接收方地址 | 交易发给谁；发合约时这里是合约地址 |
| `nonce` | 账户交易序号 | 同一个账户的交易顺序号，不能乱 |
| `value` | 发送的原生币数量 | ETH 转账金额；合约调用时也可以带 value |
| `data` | 调用数据 | 普通转账通常是空的；调用合约时这里装参数 |
| `chainId` | 链编号 | 防止交易被拿去别的链上重放 |
| `gas limit` | 你愿意给这笔交易的最大 gas | 上限，不是实际花费 |
| `gas used` | 实际消耗的 gas | receipt 里能看到，通常小于等于 gas limit |
| `gas price` | 每单位 gas 的价格 | 最终决定这笔交易花多少钱 |

EIP-1559 你先记住两层：

- `maxFeePerGas`：你愿意付的最高单价。
- `maxPriorityFeePerGas`：给打包者的小费。

实际手续费通常要到 receipt 里看 `effectiveGasPrice` 和 `gasUsed` 才能知道。

工具优先：

- 查交易用区块浏览器 / `cast tx`。
- 发简单测试交易用钱包 / `cast send` / `viem wallet client`。
- 估算 gas 用 RPC / `viem estimateGas`，不自己估。

操作练习：

1. 先看当前账户和网络状态。

```bash
cast nonce $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
cast gas-price --rpc-url $BASE_SEPOLIA_RPC_URL
cast block latest --rpc-url $BASE_SEPOLIA_RPC_URL
cast balance $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL --ether
```

这一步是在发交易前先确认：

- 我是谁：`TEST_ADDRESS`
- 我连的是哪条链：`BASE_SEPOLIA_RPC_URL`
- 我当前的交易序号是多少：`nonce`
- 这条链现在的 gas 大概是多少：`gas-price`

2. 先估算一笔最小转账要多少 gas。

把收款地址换成你自己的另一个测试地址。刚开始也可以先给自己转一笔极小额，练流程更安全：

```bash
TO_ADDRESS=$TEST_ADDRESS
cast estimate "$TO_ADDRESS" --from $TEST_ADDRESS --value 0.000001ether --rpc-url $BASE_SEPOLIA_RPC_URL
cast estimate "$TO_ADDRESS" --from $TEST_ADDRESS --value 0.000001ether --cost --rpc-url $BASE_SEPOLIA_RPC_URL
```

第一条看的是 gas 数量，第二条看的是按当前网络价格估出来的总成本。

3. 发送一笔很小的测试网原生币转账。

推荐先用 `--async`，这样你能把“发送”和“查询结果”分开看：

```bash
TX_HASH=$(cast send "$TO_ADDRESS" \
  --value 0.000001ether \
  --private-key $TEST_PRIVATE_KEY \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --async)

echo "$TX_HASH"
```

这里你会先拿到一个交易 hash。交易此时可能还在 mempool，或者正在等待打包。

4. 用 `cast tx` 和 `cast receipt` 分别看“请求”和“结果”。

```bash
cast tx "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
cast receipt "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
```

你可以这样理解：

- `cast tx` 看的是交易本身，偏“我发了什么请求”。
- `cast receipt` 看的是执行结果，偏“链最后怎么处理的”。

你要重点找这些字段：

- `tx` 里：`from`、`to`、`nonce`、`value`、`gas`、`chainId`
- `receipt` 里：`status`、`gasUsed`、`effectiveGasPrice`、`blockNumber`、`logs`

5. 再去区块浏览器里核对一次。

```text
https://sepolia.basescan.org/tx/<TX_HASH>
```

对着浏览器看，你会发现：

- 交易 hash 一样
- `from` / `to` 一样
- `nonce` 一样
- `gas used` 一样

这一步是为了把命令行和浏览器里的结果对应起来，避免只会看其中一个。

6. 如果交易失败，先看什么。

优先顺序：

- 先看 `receipt.status` 是不是失败。
- 再看是不是余额不够。
- 再看 `nonce` 是否被卡住。
- 再看 `to`、`value`、`chainId`、`gas limit` 是否填错。

一个常见结论是：

```text
失败的交易也会消耗 gas，只是不会完成你想要的状态变更。
```

验收：

- 能根据交易 hash 在浏览器里找到 status、block、gas used、effective gas price、nonce。
- 能解释为什么交易 revert 后 gas 不会全部退回。
- 能解释 nonce 卡住时后续交易为什么也会卡住。
- 能说清楚 `cast estimate`、`cast send`、`cast tx`、`cast receipt` 各自负责什么。
- 能看懂一笔交易里 `from`、`to`、`nonce`、`value`、`gas`、`chainId` 的作用。

## 模块 4：读链、RPC 与区块浏览器

目标：学会从链上读取事实，而不是只相信应用界面。

学什么：

- RPC 是什么：`eth_blockNumber`、`eth_getBalance`、`eth_getTransactionByHash`、`eth_getTransactionReceipt`。
- block、transaction、receipt 的区别。
- pending / latest / finalized 这些 block tag 的大致含义。
- RPC provider 的速率限制和失败重试。

工具优先：

- CLI 查链优先用 `cast`。
- 项目代码读链优先用 `viem` 的 public client。
- 不手写 JSON-RPC 请求封装，除非只是为了看一眼原始协议。

操作练习：

```bash
cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL
cast balance $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
cast tx <TX_HASH> --rpc-url $BASE_SEPOLIA_RPC_URL
cast receipt <TX_HASH> --rpc-url $BASE_SEPOLIA_RPC_URL
```

验收：

- 能说清楚 transaction 和 receipt 的区别：transaction 是“你请求链做什么”，receipt 是“链执行后的结果”。
- 能从 receipt 判断一笔交易成功还是失败。
- 能找到一笔交易产生了哪些 logs。

## 模块 5：ABI、calldata 与合约调用

目标：看懂合约调用的 `data` 字段，为后面 EIP-712、ERC-20、MCP 链上工具打基础。

学什么：

- ABI 是合约函数和事件的接口说明。
- function selector：函数签名前 4 字节。
- calldata：调用合约时传给 EVM 的原始数据。
- `readContract` vs `writeContract`：读调用不改状态，写调用要交易。
- revert reason / custom error 的基本概念。

工具优先：

- ABI 编码/解码用 `cast calldata`、`cast sig`、`viem encodeFunctionData`、区块浏览器。
- 不手写 ABI 编码。

操作练习：

```bash
cast sig "transfer(address,uint256)"
cast calldata "transfer(address,uint256)" <TO_ADDRESS> 1000000
cast 4byte 0xa9059cbb
```

用 `viem` 做一个最小读链脚本时，只调用现有合约的只读函数，例如 ERC-20 的 `balanceOf` / `decimals` / `symbol`。

验收：

- 能解释为什么 ERC-20 `transfer(address,uint256)` 的 selector 是 `0xa9059cbb`。
- 能看懂交易里的 `input data` 大致对应哪个函数和参数。
- 能区分“读合约”和“写合约”为什么成本不同。

## 模块 6：EVM 执行模型入门

目标：理解 EVM 执行时在处理什么，不要求手写 opcode。

学什么：

- EVM 是状态机：交易输入进来，执行后改变 state 或 revert。
- `storage`、`memory`、`calldata` 的区别。
- opcode、gas cost、stack 的基本概念。
- revert：为什么状态会回滚，但 gas 会消耗。
- event logs 不属于合约 storage，但能被外部索引。

工具优先：

- 查 opcode 用 evm.codes。
- 看执行路径用 Foundry trace / Tenderly。
- 不在这个阶段手写 opcode 或自己实现 EVM。

操作练习：

```bash
cast run <TX_HASH> --rpc-url $BASE_SEPOLIA_RPC_URL
```

如果某条测试网交易不适合 `cast run`，可以用区块浏览器或 Tenderly 看 trace / logs。

验收：

- 能解释 `storage` 是链上持久状态，`memory` 是执行期间临时空间，`calldata` 是外部传入参数。
- 能解释一次 revert 为什么不会留下状态变更。
- 能知道什么时候该看 trace，什么时候看 receipt 就够了。

## 模块 7：事件 logs 与最小索引意识

目标：知道链上应用为什么大量依赖 event，以及后面 agent 怎么追踪任务状态。

学什么：

- event、topic、indexed 参数、data。
- receipt.logs 和区块浏览器 Event Logs。
- 通过 logs 追踪 ERC-20 Transfer 或业务事件。
- 小规模直接查 logs，大规模用 The Graph / indexer 服务，不手写完整索引系统。

工具优先：

- 查 logs 用 `cast logs`、区块浏览器、`viem getLogs`。
- 大规模索引用 The Graph / 现成 indexer，不自己从零写生产级索引器。

操作练习：

```bash
cast topic "Transfer(address,address,uint256)"
cast logs \
  --from-block <FROM_BLOCK> \
  --to-block latest \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

验收：

- 能解释 topic0 为什么通常是事件签名哈希。
- 能从 ERC-20 `Transfer` log 看出转出地址、转入地址和金额。
- 能说清楚 event log 适合做审计和索引，但不是合约内部状态。

## 模块 8：L1、L2、Rollup 与 finality

目标：理解为什么 Web3 agent 项目更适合先跑在 L2，尤其是 Base 这类低成本网络。

学什么：

- L1 和 L2 的关系。
- Optimistic Rollup 与 ZK Rollup 的高层区别。
- L2 的排序器、确认速度、最终性、提现延迟。
- 为什么 x402 / agent 小额高频支付更适合 L2。
- 跨链桥的基本风险：桥不是普通转账。

工具优先：

- 用官方文档、区块浏览器、成熟桥接工具理解流程。
- 不手写跨链桥，不自己实现 rollup 证明。

操作练习：

- 对比同一时段 Ethereum Sepolia 和 Base Sepolia 的 gas / 出块速度。
- 在浏览器里找一笔 Base Sepolia 交易，观察它的确认速度和区块信息。
- 阅读 Base 文档中关于交易确认 / withdrawals 的说明。

验收：

- 能解释为什么 agent 小额支付和高频工具调用不适合优先放在以太坊 L1。
- 能说清楚 L2 交易“很快确认”和“最终结算到 L1”不是同一件事。
- 能说明桥接资产时为什么要更谨慎。

## 模块 9：Layer 1 安全验收

目标：把安全习惯嵌到链上基础学习里，而不是等后面动真资金才补。

必做检查：

- `.env` 已加入 `.gitignore`，仓库里只有 `.env.example`。
- 测试私钥只用于测试网，和主钱包隔离。
- 所有脚本先打印目标 `chainId`、`from`、`to`、金额，再执行写交易。
- 发送交易前用 `estimateGas` / 模拟调用检查明显错误。
- 任何日志都不打印私钥、助记词、完整 RPC key、完整 API key。
- 能从浏览器和 `cast receipt` 双重确认交易结果。

验收问题：

- 如果 RPC URL 配错到主网，你的脚本会不会提醒？
- 如果 nonce 卡住，你知道怎么查当前 nonce 和 pending 交易吗？
- 如果交易失败，你会先看 receipt、revert reason、还是代码猜原因？
- 如果一个网页让你签名，你能分辨它是在签消息还是发交易吗？

## 最终里程碑

完成 Layer 1 时，你要能演示并讲清楚：

```text
读取测试网配置
  -> 查询当前 chainId / block / 账户余额 / nonce
  -> 估算一笔测试网转账或合约调用的 gas
  -> 发送交易
  -> 等待 receipt
  -> 在区块浏览器和 cast 中核对交易状态
  -> 解释 calldata、gas、nonce、logs、finality 分别发生了什么
```

推荐最终产物：一个 `layer1` 下的小脚本或命令行 demo，使用 `viem + zod + pino`：

- 校验 `.env` 里的 RPC 和测试账户配置。
- 打印当前网络、余额、nonce、latest block。
- 可选发送一笔极小额测试网交易。
- 输出结构化 JSON。
- 不泄露任何 secret。

最终验收命令可以逐步补成：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm demo:layer1:read
pnpm demo:layer1:send -- --to <TO_ADDRESS> --value 0.000001
```

## 和后续 Layer 的关系

- 到 Layer 2，你会把这里学的 ABI、calldata、logs、revert、gas 带进 Solidity / Foundry。
- 到 Layer 3，你会用 `viem` / `wagmi` 把读链、写链、签名放进前端。
- 到 Layer 4，你会理解 ERC-4337 为什么要替代“直接把私钥交给 agent”。
- 到 Layer 7，你会更容易理解 x402 为什么依赖链上支付证明、稳定币、finality 和低 gas L2。

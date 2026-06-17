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

核心概念：你到底在读什么。

| 对象 | 它是什么 | 你怎么查 |
| --- | --- | --- |
| RPC | 你连接链的接口 | `cast chain-id`、`cast client`、`cast rpc` |
| block | 一批已经打包的交易 | `cast block latest`、区块浏览器 |
| account state | 某个地址的余额、nonce、code | `cast balance`、`cast nonce`、`cast code` |
| transaction | 交易请求本身 | `cast tx <TX_HASH>` |
| receipt | 交易执行结果 | `cast receipt <TX_HASH>` |
| logs | 交易执行时合约发出的事件 | receipt 里的 `logs`、`cast logs`、区块浏览器 |

几个 block tag 先这样理解：

| tag | 简单理解 | 什么时候用 |
| --- | --- | --- |
| `latest` | 当前节点认为的最新区块 | 最常用，查最新状态 |
| `pending` | 包含待处理交易的状态 | 看待打包状态，初学少用 |
| `safe` | 相对安全的区块 | 需要更稳妥确认时了解 |
| `finalized` | 最终确认的区块 | 需要最终性判断时了解 |

现在你先重点掌握 `latest`。`safe` / `finalized` 在 L1、L2 上细节会不同，后面学 finality 再展开。

工具优先：

- CLI 查链优先用 `cast`。
- 项目代码读链优先用 `viem` 的 public client。
- 不手写 JSON-RPC 请求封装，除非只是为了看一眼原始协议。

操作练习：

1. 先确认 RPC 连得上、链也对。

```bash
cast chain-id --rpc-url $BASE_SEPOLIA_RPC_URL
cast client --rpc-url $BASE_SEPOLIA_RPC_URL
cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL
```

你要看到：

- `chain-id` 是 `84532`。
- `block-number` 是一个会增长的数字。
- `client` 能返回节点客户端信息，说明 RPC 正常响应。

2. 查最新区块。

```bash
cast block latest --rpc-url $BASE_SEPOLIA_RPC_URL
```

重点看：

- `number`：区块高度。
- `hash`：区块 hash。
- `timestamp`：区块时间。
- `transactions`：这个区块里包含的交易。
- `baseFeePerGas`：EIP-1559 的基础 gas 单价，若该链/节点返回。

3. 查一个地址的链上状态。

```bash
cast balance $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL --ether
cast nonce $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
cast code $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
```

这里分别是在查：

- `balance`：这个地址有多少 ETH。
- `nonce`：这个地址已经发过多少笔交易，下一笔交易要用哪个 nonce。
- `code`：这个地址有没有合约 bytecode。

4. 用上一模块发出的 `TX_HASH` 查 transaction 和 receipt。

```bash
cast tx "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
cast receipt "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
```

你要重点对比：

| 查什么 | 命令 | 重点字段 |
| --- | --- | --- |
| 交易请求 | `cast tx` | `from`、`to`、`nonce`、`value`、`input`、`gas`、`chainId` |
| 执行结果 | `cast receipt` | `status`、`blockNumber`、`gasUsed`、`effectiveGasPrice`、`logs` |

一句话：

```text
transaction = 我请求链做什么
receipt = 链执行后的结果
```

5. 用区块浏览器交叉核对。

```text
https://sepolia.basescan.org/tx/<TX_HASH>
https://sepolia.basescan.org/address/<TEST_ADDRESS>
```

你要确认命令行和浏览器里的这些信息一致：

- transaction hash
- from / to
- block number
- status
- gas used
- logs

6. 看一眼原始 JSON-RPC。

项目里不建议自己手写 RPC client，但学习时可以看一眼底层方法长什么样：

```bash
cast rpc eth_blockNumber --rpc-url $BASE_SEPOLIA_RPC_URL
cast rpc eth_getBalance "[\"$TEST_ADDRESS\",\"latest\"]" --raw --rpc-url $BASE_SEPOLIA_RPC_URL
cast rpc eth_getTransactionByHash "[\"$TX_HASH\"]" --raw --rpc-url $BASE_SEPOLIA_RPC_URL
cast rpc eth_getTransactionReceipt "[\"$TX_HASH\"]" --raw --rpc-url $BASE_SEPOLIA_RPC_URL
```

你会发现原始 RPC 返回的数据更偏底层，很多数值是十六进制。日常开发优先用 `cast` / `viem` 这类工具帮你处理格式。

7. 如果你有一笔 ERC-20 转账交易，可以观察 logs。

```bash
cast receipt "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
```

普通 ETH 转账通常没有 ERC-20 `Transfer` 事件；合约调用或 ERC-20 转账才更可能在 receipt 里看到 logs。模块 7 会专门讲 event logs。

8. 常见 RPC 问题怎么判断。

| 现象 | 可能原因 | 先怎么查 |
| --- | --- | --- |
| `--rpc-url` 报空 | 环境变量没加载 | `echo "$BASE_SEPOLIA_RPC_URL"` |
| chainId 不对 | RPC 配错网络 | `cast chain-id` |
| 交易查不到 | 交易还没广播成功 / RPC 不同步 / hash 错 | 浏览器和另一个 RPC 交叉查 |
| 请求很慢或失败 | 公共 RPC 限流 | 换 RPC provider 或稍后重试 |
| receipt 没有 | 交易还没打包 | 等一会再查 `cast receipt` |

验收：

- 能说清楚 transaction 和 receipt 的区别：transaction 是“你请求链做什么”，receipt 是“链执行后的结果”。
- 能从 receipt 判断一笔交易成功还是失败。
- 能找到一笔交易产生了哪些 logs。
- 能说清楚 `block`、`account state`、`transaction`、`receipt`、`logs` 分别是什么。
- 能用 `cast` 和区块浏览器交叉确认同一笔交易。
- 能看懂最基础的 JSON-RPC 方法和返回值为什么偏底层。

## 模块 5：ABI、calldata 与合约调用

目标：看懂合约调用的 `data` 字段，为后面 EIP-712、ERC-20、MCP 链上工具打基础。

学什么：

- ABI 是合约函数和事件的接口说明。
- function selector：函数签名前 4 字节。
- calldata：调用合约时传给 EVM 的原始数据。
- `readContract` vs `writeContract`：读调用不改状态，写调用要交易。
- revert reason / custom error 的基本概念。

核心概念：合约调用到底发了什么。

| 概念 | 简单理解 | 你要记住什么 |
| --- | --- | --- |
| ABI | 合约接口说明 | 告诉工具有哪些函数、参数、返回值、事件 |
| function signature | 函数字符串 | 例如 `transfer(address,uint256)` |
| selector | 函数选择器 | 对 function signature 做 keccak 后取前 4 bytes |
| calldata | 调用合约时传入的原始数据 | `selector + ABI 编码后的参数` |
| read call | 只读调用 | 不改状态，不花 gas，不产生交易 hash |
| write tx | 写交易 | 改状态，需要签名、上链、花 gas，产生 receipt |

一条合约调用可以先这样理解：

```text
我要调用哪个函数
  -> selector
我要传什么参数
  -> ABI encode
selector + encoded args
  -> calldata
```

以 ERC-20 转账为例：

```text
transfer(address,uint256)
  -> selector: 0xa9059cbb
  -> calldata: 0xa9059cbb + 收款地址 + 金额
```

这一模块只要求你看懂和使用工具编码 / 解码，不要求手写 ABI 编码。

工具优先：

- ABI 编码/解码用 `cast calldata`、`cast sig`、`viem encodeFunctionData`、区块浏览器。
- 不手写 ABI 编码。

操作练习：

1. 准备一个 Base Sepolia 测试 USDC 合约地址。

```bash
USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

这个地址是 Base Sepolia 上常用的测试 USDC。你现在只是读它，不需要持有 USDC。

2. 看函数 selector。

```bash
cast sig "transfer(address,uint256)"
```

你应该看到：

```text
0xa9059cbb
```

意思是：`transfer(address,uint256)` 这个函数的 selector 是 `0xa9059cbb`。

也可以反查 selector 对应的函数签名：

```bash
cast 4byte 0xa9059cbb
```

注意：`cast 4byte` 会查询公开签名数据库，可能受网络影响。项目里不要依赖它做关键逻辑。

3. 编码一段 `transfer` calldata。

```bash
TO_ADDRESS=0x1111111111111111111111111111111111111111
TRANSFER_CALLDATA=$(cast calldata "transfer(address,uint256)" "$TO_ADDRESS" 1000000)
echo "$TRANSFER_CALLDATA"
```

输出会像这样：

```text
0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240
```

这里不要被长字符串吓到，它可以拆成：

```text
0xa9059cbb      函数 selector
0000...1111     第 1 个参数：to 地址
0000...0f4240   第 2 个参数：amount，1000000
```

`1000000` 对 USDC 来说通常表示 `1 USDC`，因为 USDC 是 6 decimals。

4. 解码刚才的 calldata。

```bash
cast decode-calldata "transfer(address,uint256)" "$TRANSFER_CALLDATA"
```

你应该能看到类似：

```text
0x1111111111111111111111111111111111111111
1000000
```

这一步是在证明：工具能把 `calldata` 还原成函数参数。

5. 读 ERC-20 合约的只读函数。

```bash
cast call "$USDC_BASE_SEPOLIA" "symbol()(string)" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call "$USDC_BASE_SEPOLIA" "decimals()(uint8)" --rpc-url $BASE_SEPOLIA_RPC_URL
cast call "$USDC_BASE_SEPOLIA" "balanceOf(address)(uint256)" $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
```

这里发生的是：

- `symbol()`：读 token 符号。
- `decimals()`：读精度。
- `balanceOf(address)`：读某个地址的 token 余额。

这些都是 read call：

```text
不上链
不花 gas
没有交易 hash
不会产生 receipt
```

6. 用原始 calldata 做同样的只读调用。

先编码 `balanceOf(address)`：

```bash
BALANCE_CALLDATA=$(cast calldata "balanceOf(address)" "$TEST_ADDRESS")
echo "$BALANCE_CALLDATA"
```

再用 `--data` 调合约：

```bash
cast call "$USDC_BASE_SEPOLIA" --data "$BALANCE_CALLDATA" --rpc-url $BASE_SEPOLIA_RPC_URL
```

这一步是为了让你看懂：

```text
cast call 合约地址 "balanceOf(address)(uint256)" 参数
```

背后其实也是在构造 calldata，只是 `cast` 帮你编码了。

7. 理解 read call 和 write tx 的区别。

读调用：

```bash
cast call "$USDC_BASE_SEPOLIA" "balanceOf(address)(uint256)" $TEST_ADDRESS --rpc-url $BASE_SEPOLIA_RPC_URL
```

写交易，例如 ERC-20 转账：

```bash
cast send "$USDC_BASE_SEPOLIA" "transfer(address,uint256)" "$TO_ADDRESS" 1000000 \
  --private-key $TEST_PRIVATE_KEY \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

这条 `cast send` 先不要急着跑，除非你确认测试账户里有 Base Sepolia USDC。否则可能失败。这里主要是让你看出：

| 类型 | 命令 | 是否改状态 | 是否花 gas | 是否有 tx hash |
| --- | --- | --- | --- | --- |
| read call | `cast call` | 否 | 否 | 否 |
| write tx | `cast send` | 是 | 是 | 是 |

8. 在区块浏览器里看 calldata。

找一笔 ERC-20 转账交易，打开 BaseScan 的 transaction 页面，查看 `Input Data` / `Method` / `Logs`。

你要尝试对应起来：

```text
Method: transfer
Input Data: 0xa9059cbb...
Logs: Transfer event
```

普通 ETH 转账通常 input data 是空的；合约调用通常会有 input data。

9. revert reason / custom error 先了解到这个程度。

如果你调用的函数会失败，EVM 可能返回 revert 信息。常见原因：

- 余额不足。
- allowance 不够。
- 调用了不存在的函数。
- 参数不合法。
- 合约主动 `revert`。

这部分后面到 Solidity / Foundry 会深入。模块 5 只要知道：

```text
合约调用失败时，不只是“没反应”，而是可能有可解码的 revert reason / custom error。
```

验收：

- 能解释为什么 ERC-20 `transfer(address,uint256)` 的 selector 是 `0xa9059cbb`。
- 能看懂交易里的 `input data` 大致对应哪个函数和参数。
- 能区分“读合约”和“写合约”为什么成本不同。
- 能用 `cast calldata` 编码函数调用。
- 能用 `cast decode-calldata` 解码函数调用。
- 能用 `cast call` 读取 ERC-20 的 `symbol`、`decimals`、`balanceOf`。
- 能解释为什么项目里不手写 ABI 编码，而是用 `cast` / `viem` / `ethers` 这类成熟工具。

## 模块 6：EVM 执行模型入门

目标：理解 EVM 执行时在处理什么，不要求手写 opcode。

学什么：

- EVM 是状态机：交易输入进来，执行后改变 state 或 revert。
- `storage`、`memory`、`calldata` 的区别。
- opcode、gas cost、stack 的基本概念。
- revert：为什么状态会回滚，但 gas 会消耗。
- event logs 不属于合约 storage，但能被外部索引。

模块 5 讲的是：

```text
你发给合约的 calldata 长什么样。
```

模块 6 讲的是：

```text
EVM 收到 calldata 后，大概怎么执行。
```

这一模块不用你手写 EVM、手写 opcode，也不用背完整指令表。目标是能看懂执行路径里的基本词：`CALLDATALOAD`、`SLOAD`、`SSTORE`、`MSTORE`、`JUMPI`、`REVERT`、`LOG` 这些名字出现时，你知道它们大概在干什么。

核心概念：EVM 像一个状态机。

```text
当前链上状态
  + 交易 / call 输入
  + 合约 bytecode
  -> EVM 执行
  -> 返回结果 / revert
  -> 新的链上状态 + logs + receipt
```

几个数据区域先这样分：

| 区域 | 简单理解 | 生命周期 | 常见用途 |
| --- | --- | --- | --- |
| `storage` | 合约的链上硬盘 | 持久保存，交易后还在 | token 余额、owner、配置、mapping |
| `memory` | 执行过程里的临时内存 | 本次调用结束就没了 | 临时计算、组装返回值 |
| `calldata` | 外部传进来的只读参数 | 本次调用期间存在 | 函数 selector、函数参数 |
| stack | EVM 的操作数栈 | 执行期间存在 | opcode 之间传递中间值 |

你现在先记：

```text
storage 最贵、会持久化；memory 临时；calldata 是外部输入。
```

常见 opcode 只需认识这些：

| opcode | 大概做什么 |
| --- | --- |
| `PUSH` | 把一个值压到 stack 上 |
| `CALLDATALOAD` | 从 calldata 读取参数 |
| `MSTORE` / `MLOAD` | 写 / 读 memory |
| `SSTORE` / `SLOAD` | 写 / 读 storage |
| `JUMP` / `JUMPI` | 跳转，类似程序分支 |
| `CALL` / `DELEGATECALL` | 调用其他合约或代理逻辑 |
| `LOG` | 发 event log |
| `REVERT` | 回滚本次执行 |
| `RETURN` | 返回结果 |

工具优先：

- 查 opcode 用 evm.codes。
- 看执行路径用 Foundry trace / Tenderly。
- 不在这个阶段手写 opcode 或自己实现 EVM。

操作练习：

1. 准备测试 USDC 合约地址。

```bash
USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

2. 先看这个地址有没有合约 bytecode。

```bash
cast code "$USDC_BASE_SEPOLIA" --rpc-url $BASE_SEPOLIA_RPC_URL
```

如果输出不是 `0x`，说明这个地址有合约代码。

对比你的 EOA 测试钱包：

```bash
cast code "$TEST_ADDRESS" --rpc-url $BASE_SEPOLIA_RPC_URL
```

EOA 通常输出：

```text
0x
```

3. 把一小段 bytecode 反汇编成 opcode。

```bash
RUNTIME_CODE=$(cast code "$USDC_BASE_SEPOLIA" --rpc-url $BASE_SEPOLIA_RPC_URL)
echo "$RUNTIME_CODE" | cut -c1-82
cast disassemble "$(echo "$RUNTIME_CODE" | cut -c1-82)"
```

你可能会看到类似：

```text
PUSH1 0x80
PUSH1 0x40
MSTORE
CALLDATASIZE
CALLDATALOAD
JUMPI
```

现在不用逐行读懂，只要知道：合约源码最终会编译成 bytecode，EVM 实际执行的是 opcode。

4. 用 trace 观察一次只读调用。

```bash
cast call "$USDC_BASE_SEPOLIA" \
  "balanceOf(address)(uint256)" \
  "$TEST_ADDRESS" \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --trace
```

你会看到一段调用路径。重点看：

- 调用了哪个合约。
- 调用了哪个函数。
- 有没有 `delegatecall`。
- 最后是 `Return` 还是 `Revert`。
- 大概用了多少 gas。

如果看到一些关于 cache、Sourcify、Etherscan config 的 warning，但 trace 仍然输出了，先不用纠结。那通常是工具在尝试拉取辅助信息失败，不影响你观察执行路径。

5. 用原始 calldata 做同样的 trace。

```bash
BALANCE_CALLDATA=$(cast calldata "balanceOf(address)" "$TEST_ADDRESS")

cast call "$USDC_BASE_SEPOLIA" \
  --data "$BALANCE_CALLDATA" \
  --rpc-url $BASE_SEPOLIA_RPC_URL \
  --trace
```

这一步把模块 5 和模块 6 接起来：

```text
模块 5：构造 calldata
模块 6：看 EVM 怎么执行这段 calldata
```

6. 读一个原始 storage slot。

```bash
cast storage "$USDC_BASE_SEPOLIA" 0 --rpc-url $BASE_SEPOLIA_RPC_URL
```

你会看到一个 32 bytes 的值，例如：

```text
0x000000000000000000000000...
```

注意：不要随便把 slot 0 解释成某个业务字段。很多合约是 proxy，storage layout 会比较复杂。这个练习只是让你看到：

```text
storage 是按 32-byte slot 存储的链上持久数据。
```

后面学 Solidity / Foundry 时，再系统讲 storage layout。

7. 模拟一次可能失败的调用，观察 revert。

这条命令是 `cast call`，只是模拟，不会真的发交易：

```bash
TO_ADDRESS=0x1111111111111111111111111111111111111111

cast call "$USDC_BASE_SEPOLIA" \
  "transfer(address,uint256)(bool)" \
  "$TO_ADDRESS" \
  999999999999999999 \
  --from "$TEST_ADDRESS" \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

如果你的测试地址没有足够 USDC，这个调用大概率会失败。这个失败是预期的，用来观察 revert。

你要理解：

```text
revert = 本次执行回滚，不留下状态变化。
```

如果这是一笔真实 `cast send` 写交易，失败交易仍然可能消耗 gas；但这里是 `cast call` 模拟，所以不会花你的测试 ETH。

8. 用 `cast run` 看一笔已经上链交易的执行路径。

如果你前面有一笔 `TX_HASH`：

```bash
cast run "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
```

如果某条测试网交易不适合 `cast run`，或者公共 RPC 不支持需要的历史状态，可以用区块浏览器或 Tenderly 看 trace / logs。

9. 什么时候看 receipt，什么时候看 trace。

| 你想知道什么 | 先看什么 |
| --- | --- |
| 交易成功还是失败 | receipt |
| 花了多少 gas | receipt |
| 发出了哪些 logs | receipt / 区块浏览器 |
| 具体调用了哪些合约 | trace |
| 为什么某个复杂调用失败 | trace / Tenderly |
| 某个 opcode 是什么意思 | evm.codes |

正常开发里，不是每笔交易都要看 trace。receipt 能回答的问题，就先看 receipt。

验收：

- 能解释 `storage` 是链上持久状态，`memory` 是执行期间临时空间，`calldata` 是外部传入参数。
- 能解释一次 revert 为什么不会留下状态变更。
- 能知道什么时候该看 trace，什么时候看 receipt 就够了。
- 能用 `cast code` 判断地址是否有 bytecode。
- 能用 `cast disassemble` 看一小段 opcode。
- 能用 `cast call --trace` 观察一次只读调用的执行路径。
- 能用 `cast storage` 读取一个原始 storage slot，并知道不要在不了解 layout 时乱解释。

## 模块 7：事件 logs 与最小索引意识

目标：知道链上应用为什么大量依赖 event，以及后面 agent 怎么追踪任务状态。

学什么：

- event、topic、indexed 参数、data。
- receipt.logs 和区块浏览器 Event Logs。
- 通过 logs 追踪 ERC-20 Transfer 或业务事件。
- 小规模直接查 logs，大规模用 The Graph / indexer 服务，不手写完整索引系统。

模块 3 / 4 里你已经见过 receipt。模块 7 要看的是 receipt 里的 `logs`：

```text
交易执行
  -> 合约 emit event
  -> 事件进入 receipt.logs
  -> 前端 / indexer / agent 通过 logs 追踪状态
```

核心概念：event log 是链上应用对外发出的“可索引记录”。

| 概念 | 简单理解 | 你要记住什么 |
| --- | --- | --- |
| event | 合约发出的事件 | 给外部系统读，不是给合约内部逻辑读 |
| log | event 上链后的记录 | 存在 receipt 里，可以被查询和索引 |
| topic0 | 事件签名哈希 | 通常用来识别是哪种事件 |
| indexed 参数 | 可作为 topic 的参数 | 方便按地址、id 等字段过滤 |
| data | 非 indexed 参数编码 | 不能像 topic 那样直接高效过滤 |

以 ERC-20 的 `Transfer` 事件为例：

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

它通常会变成：

```text
topic0 = keccak256("Transfer(address,address,uint256)")
topic1 = indexed from
topic2 = indexed to
data   = value
```

注意：event logs 不等于 storage。它适合审计、前端展示、索引，不适合合约内部读取状态。

工具优先：

- 查 logs 用 `cast logs`、区块浏览器、`viem getLogs`。
- 大规模索引用 The Graph / 现成 indexer，不自己从零写生产级索引器。

操作练习：

1. 准备测试 USDC 合约地址。

```bash
USDC_BASE_SEPOLIA=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

2. 计算 ERC-20 `Transfer` 的 topic0。

```bash
cast sig-event "Transfer(address,address,uint256)"
```

你应该看到：

```text
0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
```

这就是 `Transfer(address,address,uint256)` 这个事件的 topic0。

3. 用 `cast abi-encode-event` 看 indexed 参数如何进入 topics。

```bash
cast abi-encode-event \
  "Transfer(address indexed,address indexed,uint256)" \
  0x0000000000000000000000000000000000000000 \
  0x1111111111111111111111111111111111111111 \
  1000000
```

你会看到类似：

```text
[topic0]: 0xddf252ad...
[topic1]: 0x000000...0000
[topic2]: 0x000000...1111
[data]:   0x000000...0f4240
```

含义是：

- `topic0`：事件类型，表示 Transfer。
- `topic1`：`from`，因为它是 indexed。
- `topic2`：`to`，因为它是 indexed。
- `data`：`value`，因为它没有 indexed。

4. 查最近一小段区块里的 USDC Transfer logs。

先取最新区块。很多免费 RPC 对 `eth_getLogs` 有范围限制，可能一次只能查 10 个区块，所以默认先查最近 10 个区块：

```bash
LATEST_BLOCK=$(cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL)
FROM_BLOCK=$((LATEST_BLOCK - 9))

cast logs \
  --address "$USDC_BASE_SEPOLIA" \
  --from-block "$FROM_BLOCK" \
  --to-block latest \
  "Transfer(address,address,uint256)" \
  --rpc-url $BASE_SEPOLIA_RPC_URL
```

如果你的 RPC 支持更大的 `eth_getLogs` 范围，可以把 `9` 改大；如果提示 `up to a 10 block range`，就保持 10 个区块以内，或者分批查询。

你会看到每条 log 大概包含：

- `address`：发出事件的合约地址。
- `blockNumber`：事件所在区块。
- `transactionHash`：是哪笔交易产生的事件。
- `logIndex`：这笔交易或区块里的第几个 log。
- `topics`：事件类型和 indexed 参数。
- `data`：非 indexed 参数。

5. 手动解读一条 ERC-20 Transfer log。

假设你看到：

```text
topics: [
  0xddf252ad...
  0x000000000000000000000000ff949e43a36c86ecec445b23dcf046a9d4e67605
  0x000000000000000000000000bb7bc0b596d471b34f2770e95f93f0ab9596a649
]
data: 0x00000000000000000000000000000000000000000000000000000000000003e8
```

它表示：

```text
事件类型：Transfer
from: 0xff949e43a36c86ecec445b23dcf046a9d4e67605
to:   0xbb7bc0b596d471b34f2770e95f93f0ab9596a649
value: 0x3e8 = 1000
```

USDC 是 6 decimals，所以 `1000` 是 `0.001 USDC`。

6. 用交易 receipt 看 logs。

从上一步某条 log 里复制 `transactionHash`：

```bash
TRANSFER_TX=0x...
cast receipt "$TRANSFER_TX" --rpc-url $BASE_SEPOLIA_RPC_URL
```

然后在 receipt 里找 `logs`。这会让你看到：

```text
cast logs 查到的 log
  ==
某笔交易 receipt.logs 里的其中一条
```

7. 用区块浏览器交叉查看。

打开：

```text
https://sepolia.basescan.org/tx/<TRANSFER_TX>
```

看页面里的：

- Logs
- Events
- ERC-20 Tokens Transferred

把浏览器显示的人类友好结果，和 `cast logs` 的 topics/data 对上。

8. 什么时候直接查 logs，什么时候用 indexer。

| 场景 | 做法 |
| --- | --- |
| 查最近几百 / 几千个区块 | `cast logs` / `viem getLogs` |
| 前端展示少量任务事件 | 直接读合约 event 或后端缓存 |
| 要查大量历史数据 | The Graph / indexer 服务 |
| 生产级实时索引 | 现成 indexer / 队列 / 数据库，不手写完整索引框架 |

你现在只需要理解最小索引意识：

```text
logs 是事实来源，但大规模查询需要 indexer。
```

9. 和你的 Web3 agent 项目的关系。

后面你会用 logs 追踪：

- 任务创建。
- 任务执行完成。
- 支付完成。
- session key 授权 / 撤销。
- 信誉更新。

agent 或前端不应该只相信本地状态，而应该能用链上事件回放关键动作。

验收：

- 能解释 topic0 为什么通常是事件签名哈希。
- 能从 ERC-20 `Transfer` log 看出转出地址、转入地址和金额。
- 能说清楚 event log 适合做审计和索引，但不是合约内部状态。
- 能用 `cast sig-event` 算事件 topic0。
- 能用 `cast logs` 查指定合约最近一段区块的事件。
- 能把 `cast logs` 里的 topics/data 和 BaseScan 的 Events 对上。
- 能解释什么时候直接查 logs，什么时候应该用 The Graph / indexer。

## 模块 8：L1、L2、Rollup 与 finality

目标：理解为什么 Web3 agent 项目更适合先跑在 L2，尤其是 Base 这类低成本网络。

学什么：

- L1 和 L2 的关系。
- Optimistic Rollup 与 ZK Rollup 的高层区别。
- L2 的排序器、确认速度、最终性、提现延迟。
- 为什么 x402 / agent 小额高频支付更适合 L2。
- 跨链桥的基本风险：桥不是普通转账。

这一模块不要求你实现 Rollup，也不要求你手写证明系统。目标是能回答：

```text
为什么我的 Web3 agent 项目优先跑在 Base 这类 L2，而不是以太坊 L1？
```

核心概念：

| 概念 | 简单理解 | 你要记住什么 |
| --- | --- | --- |
| L1 | 底层主链，例如 Ethereum | 安全性强、成本高、确认更慢 |
| L2 | 建在 L1 上的扩容网络，例如 Base / Arbitrum / Optimism | 成本低、确认快，最终依赖 L1 结算 |
| Rollup | 把很多 L2 交易打包后提交到 L1 | 让 L2 继承一部分 L1 安全性 |
| Sequencer | L2 负责排序和出块的组件 | 用户感知上交易很快，但要理解中心化 / 可用性风险 |
| Finality | 最终性 / 不可逆程度 | “很快看到成功”和“最终结算到 L1”不是一回事 |
| Bridge | 跨链桥 | 不是普通转账，风险更高，优先用成熟官方桥 / SDK |

你可以先用一句话理解：

```text
L2 负责便宜快速执行，L1 负责更强的最终结算和安全锚定。
```

两种 Rollup 先只记高层区别：

| 类型 | 简单理解 | 常见特点 |
| --- | --- | --- |
| Optimistic Rollup | 默认交易是对的，有挑战期 | 生态成熟，提现到 L1 可能有等待时间 |
| ZK Rollup | 用有效性证明证明交易正确 | 证明系统复杂，最终性体验可能更强 |

Base 属于 OP Stack 生态，先按 Optimistic Rollup 方向理解即可。具体机制会演进，进入真实项目阶段要看官方最新文档。

工具优先：

- 用官方文档、区块浏览器、成熟桥接工具理解流程。
- 不手写跨链桥，不自己实现 rollup 证明。

操作练习：

1. 准备两个 RPC。

```bash
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
```

如果你已经在 `.env` 里配过，可以直接加载 `.env` 后使用。

2. 对比 chainId。

```bash
cast chain-id --rpc-url $BASE_SEPOLIA_RPC_URL
cast chain-id --rpc-url $SEPOLIA_RPC_URL
```

你应该看到：

```text
Base Sepolia: 84532
Ethereum Sepolia: 11155111
```

这一步确认你确实在对比两条不同网络。

3. 对比当前 gas price。

```bash
BASE_GAS=$(cast gas-price --rpc-url $BASE_SEPOLIA_RPC_URL)
SEP_GAS=$(cast gas-price --rpc-url $SEPOLIA_RPC_URL)

echo "Base Sepolia gas wei: $BASE_GAS"
echo "Ethereum Sepolia gas wei: $SEP_GAS"

cast to-unit "$BASE_GAS" gwei
cast to-unit "$SEP_GAS" gwei
```

注意：测试网 gas 不等于主网真实成本，但它能帮你练习比较方式。真正做架构决策时要看主网或目标网络的实时数据。

4. 对比区块高度和最新区块信息。

```bash
cast block-number --rpc-url $BASE_SEPOLIA_RPC_URL
cast block-number --rpc-url $SEPOLIA_RPC_URL

cast block latest --field timestamp --rpc-url $BASE_SEPOLIA_RPC_URL
cast block latest --field timestamp --rpc-url $SEPOLIA_RPC_URL
```

你要观察：

- 两条链的区块高度不同，不能直接比较大小。
- timestamp 可以让你知道最新区块大概是什么时间。
- L2 的确认体验通常更快，更适合频繁交互。

5. 找一笔 Base Sepolia 交易观察确认过程。

如果你有前面模块发过的 `TX_HASH`：

```bash
cast tx "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
cast receipt "$TX_HASH" --rpc-url $BASE_SEPOLIA_RPC_URL
```

然后打开：

```text
https://sepolia.basescan.org/tx/<TX_HASH>
```

重点看：

- status
- block number
- timestamp
- gas used
- effective gas price
- confirmations

6. 理解“L2 上很快成功”和“最终结算到 L1”不是同一件事。

可以先这样记：

```text
L2 confirmed：你在 L2 上很快看到交易成功。
L1 finality / settlement：这批 L2 数据最终提交并在 L1 上获得更强确认。
```

对于你的 agent MVP：

- 小额服务调用可以先接受 L2 confirmation。
- 高风险、大金额、跨链退出，要更关注最终性和桥接流程。

7. 阅读官方文档，而不是自己猜桥接机制。

建议阅读：

```text
https://docs.base.org/
```

重点找这些主题：

- Base Sepolia / Base Mainnet 网络信息。
- transaction finality / confirmations。
- bridge / withdrawals。
- OP Stack / rollup 相关说明。

8. 跨链桥的风险意识。

桥接不是：

```text
从 A 链普通转账到 B 链
```

更接近：

```text
在 A 链锁定 / 销毁资产
  -> 桥或协议确认消息
  -> 在 B 链释放 / 铸造对应资产
```

所以桥接风险包括：

- 桥合约漏洞。
- 消息验证问题。
- 错链 / 错 token。
- 提现等待期。
- 第三方桥的信任假设。

Layer 1 阶段只要知道：

```text
不手写桥，不碰主网大额桥接，优先官方桥和成熟 SDK。
```

9. 和 Web3 agent 项目的关系。

agent-to-agent 支付、x402、小额服务调用适合优先放在 L2，因为：

- gas 更低。
- 确认更快。
- 小额高频交互更现实。
- Base 上 USDC / x402 生态更适合做测试网 MVP。

但你仍然要避免：

- 把所有安全假设都交给 L2 快速确认。
- 在不了解桥接流程时做跨链资金流。
- 在主网直接测试 agent 自动支付。

验收：

- 能解释为什么 agent 小额支付和高频工具调用不适合优先放在以太坊 L1。
- 能说清楚 L2 交易“很快确认”和“最终结算到 L1”不是同一件事。
- 能说明桥接资产时为什么要更谨慎。
- 能用 `cast` 对比 Base Sepolia 和 Ethereum Sepolia 的 chainId、gas price、latest block。
- 能说清楚 sequencer、rollup、finality、bridge 这些词的大概意思。
- 能说明为什么项目 MVP 优先用 Base Sepolia，而不是一开始上主网或跨链。

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

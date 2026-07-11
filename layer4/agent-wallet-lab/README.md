# Layer 4 本地可运行练习

这套 lab 是给 `layer4/*.md` 配的“复制就能跑”版本：不需要 `.env`、不需要 Pimlico API key、不需要测试网资产。它用本地数据模拟 ERC-4337 / session key / paymaster / EIP-1271 / ERC-7702 的关键流程，让你先看见数据长什么样，再去跑真实链脚本。

```bash
cd /home/lenovo/solidity-course/ata/layer4/agent-wallet-lab
pnpm install
pnpm demo:all
```

单独运行某个知识点：

```bash
pnpm demo:userop      # UserOperation 和外层 tx 的区别
pnpm demo:validation # validationData 的低 160 位和时间窗
pnpm demo:policy     # session key 的白名单、额度、过期、撤销
pnpm demo:paymaster  # bundler 为什么先模拟，paymaster 为什么不能乱赞助
pnpm demo:1271       # 智能账户如何用 EIP-1271 验 TaskIntent
pnpm demo:7702       # to = EOA 时，为什么会执行 7702 委托代码
```

和真实链脚本的关系：

- `agent-wallet-lab/`：本地教学模型，帮助你理解概念。
- `agent-wallet/`：真实 Base Sepolia + Pimlico + permissionless.js 脚本。
- `contracts/`：Foundry 版最小智能账户与 session key 策略，验证链上强制逻辑。


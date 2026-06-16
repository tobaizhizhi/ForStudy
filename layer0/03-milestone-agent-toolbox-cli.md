# 里程碑项目：agent-toolbox-cli

Layer 0 的最终产物是一个小型 TypeScript CLI。它不用接真实链和真实模型，先用 mock 工具把工程骨架跑通。

## 项目目标

做一个 `agent-toolbox-cli`，支持三类命令：

```bash
pnpm agent quote --service risk-check --amount 5
pnpm agent execute --task-id task_001
pnpm agent status --task-id task_001
```

它要完成这些事：

1. 读取 `.env` 配置。
2. 用 zod 校验配置和 CLI 参数。
3. 调用 mock 链上/HTTP 工具。
4. 输出结构化 JSON。
5. 打结构化日志。
6. 用 Vitest 覆盖成功和失败路径。

## 推荐工具

```text
pnpm
TypeScript strict
tsx
commander 或 cac
zod
pino
Vitest
msw 或 nock
ESLint
Prettier
```

同类工具不要全装。比如 CLI 解析选择 `commander` 或 `cac` 一个即可；HTTP mock 选择 `msw` 或 `nock` 一个即可。

## 建议目录

```text
agent-toolbox-cli/
  package.json
  tsconfig.json
  vitest.config.ts
  eslint.config.js
  .prettierrc
  .env.example
  src/
    index.ts
    cli.ts
    config.ts
    logger.ts
    schemas/
      env.ts
      task.ts
      tool.ts
    tools/
      mockChainTool.ts
      mockHttpTool.ts
    workflow/
      runTask.ts
  tests/
    config.test.ts
    cli.test.ts
    runTask.test.ts
```

## 功能要求

### 配置

`.env.example` 至少包含：

```bash
RPC_URL=https://example-rpc.local
CHAIN_ID=84532
LOG_LEVEL=info
```

要求：

- 启动时校验配置。
- 缺少必填配置时失败。
- 不打印 secret。

### CLI

至少支持：

```bash
pnpm agent quote --service risk-check --amount 5
pnpm agent execute --task-id task_001
pnpm agent status --task-id task_001
```

要求：

- 参数由 `commander` / `cac` / `yargs` 解析。
- 参数进入业务逻辑前必须经过 zod。
- 错误时返回非 0 exit code。

### Mock 工具

至少有两个 mock 工具：

- `mockChainTool`：模拟读取链上状态，例如余额、任务状态。
- `mockHttpTool`：模拟外部 API，例如服务报价、风险判断。

要求：

- 工具输入有 schema。
- 工具输出有 schema。
- 失败路径可测试。

### 输出结构

成功输出示例：

```json
{
  "ok": true,
  "taskId": "task_001",
  "action": "quote",
  "result": {
    "service": "risk-check",
    "amount": "5",
    "requiresApproval": false
  }
}
```

失败输出示例：

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "amount must be a positive number"
  }
}
```

## 测试要求

必须覆盖：

- `.env` 缺字段。
- CLI 参数错误。
- mock chain tool 成功。
- mock HTTP tool 成功。
- mock HTTP tool 失败。
- zod 输出校验失败。
- workflow 返回结构化错误。

验收命令：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm agent --help
pnpm agent quote --service risk-check --amount 5
```

## 完成标准

Layer 0 完成时，你应该能做到：

- 核心数据结构不使用 `any`。
- 外部输入全部先经过 zod。
- CLI 参数解析不手写。
- 配置加载和校验稳定。
- 日志是结构化的。
- 失败路径能被测试覆盖。
- 项目结构后面能直接接 MCP tool、viem client、LangGraph node。

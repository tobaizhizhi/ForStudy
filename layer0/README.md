# Layer 0 - 工程基础

目标：用成熟工具搭出一个可靠的 TypeScript agent 脚手架。这里不追求手写底层设施，而是把 TypeScript strict、ESM、CLI、配置校验、日志、测试、mock、代码质量工具串起来，为后续接 MCP、LangGraph、viem、x402、A2A、AA SDK 做准备。

## 学习原则

- 有成熟工具就学成熟工具：CLI 用 `commander` / `cac` / `yargs`，日志用 `pino` / `winston`，测试用 `Vitest`，HTTP mock 用 `msw` / `nock`。
- 自己理解原理，但主项目不手写基础设施：不手写参数解析器、日志框架、测试 runner、HTTP mock 框架、格式化工具、散落的输入校验。
- 所有外部输入先校验：`.env`、CLI 参数、HTTP 返回、LLM 输出、MCP tool input 都要经过 zod / JSON Schema。
- 安全默认开启：不要把私钥、API key、RPC key 打进日志、提交进仓库、放进前端 bundle。

## 文档顺序

1. [工具优先栈](./01-tools-first-stack.md)：该用哪些现成工具，哪些东西不要手写。
2. [分模块学习大纲](./02-module-outline.md)：按模块学习 TypeScript、ESM、CLI、配置、zod、日志、测试。
3. [里程碑项目](./03-milestone-agent-toolbox-cli.md)：最终交付一个 `agent-toolbox-cli` 小工具。
4. [总结与复习](./总结与复习.md)：模块复盘、小抄和自测题。

## 最终通过标准

完成 Layer 0 时，你应该能独立搭一个 CLI 项目：

```text
读取 .env 配置
  -> 解析 CLI 参数
  -> 用 zod 校验输入
  -> 调用 mock 链上/HTTP 工具
  -> 输出结构化 JSON
  -> 打结构化日志
  -> 用 Vitest 覆盖成功和失败路径
```

推荐工具组合：

```text
pnpm + TypeScript strict + tsx + commander/cac + zod
+ pino + Vitest + msw/nock + ESLint + Prettier
```

验收命令：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm agent --help
```

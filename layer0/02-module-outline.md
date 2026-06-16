# 分模块学习大纲

Layer 0 的学习顺序建议按下面 8 个模块走。每个模块都要求产出一点可运行的代码，最后合并成 `agent-toolbox-cli`。

## 模块 1：TypeScript strict 基础

目标：核心数据结构不靠 `any` 糊过去。

学什么：

- `unknown` vs `any`
- 类型收窄：`typeof`、`in`、自定义 type guard
- 联合类型 / 判别联合
- 泛型基础
- `as const`
- `satisfies`
- `Record` / `Pick` / `Omit` / `Partial` / `Required`

操作步骤：

1. 在里程碑项目根目录准备 TypeScript strict 环境。

```bash
pnpm init
pnpm add -D typescript tsx @types/node
pnpm exec tsc --init
```

`tsconfig.json` 里至少打开这些选项：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  }
}
```

2. 创建示例文件。

```bash
mkdir -p src/playground
touch src/playground/module1-types.ts
```

3. 把下面代码写入 `src/playground/module1-types.ts`。

```ts
const ACTIONS = ["quote", "execute", "status"] as const;

type TaskAction = (typeof ACTIONS)[number];

type TaskIntent = {
  taskId: string;
  action: TaskAction;
  service: string;
  maxAmount: string;
  expiresAt: number;
};

type ToolErrorCode = "INVALID_INPUT" | "TOOL_FAILED" | "TIMEOUT";

type ToolError = {
  code: ToolErrorCode;
  message: string;
  cause?: unknown;
};

type ToolResult<T> = { ok: true; data: T } | { ok: false; error: ToolError };

type QuoteInput = Pick<TaskIntent, "service" | "maxAmount">;
type TaskPatch = Partial<Pick<TaskIntent, "maxAmount" | "expiresAt">>;
type TaskById = Record<TaskIntent["taskId"], TaskIntent>;

const defaultIntent = {
  taskId: "task_001",
  action: "quote",
  service: "risk-check",
  maxAmount: "5",
  expiresAt: Date.now() + 60_000,
} satisfies TaskIntent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTaskAction(value: unknown): value is TaskAction {
  return typeof value === "string" && ACTIONS.includes(value as TaskAction);
}

function parseTaskIntent(value: unknown): ToolResult<TaskIntent> {
  if (!isRecord(value)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "input must be an object" },
    };
  }

  const { taskId, action, service, maxAmount, expiresAt } = value;

  if (typeof taskId !== "string" || taskId.length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "taskId must be a string" },
    };
  }

  if (!isTaskAction(action)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "action is invalid" },
    };
  }

  if (typeof service !== "string" || service.length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "service must be a string" },
    };
  }

  if (typeof maxAmount !== "string" || maxAmount.length === 0) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "maxAmount must be a string" },
    };
  }

  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: "expiresAt must be a number" },
    };
  }

  return {
    ok: true,
    data: { taskId, action, service, maxAmount, expiresAt },
  };
}

function printResult(result: ToolResult<TaskIntent>): void {
  if (result.ok) {
    console.log(JSON.stringify({ ok: true, task: result.data }, null, 2));
    return;
  }

  console.log(JSON.stringify({ ok: false, error: result.error }, null, 2));
}

const rawInput = JSON.parse(JSON.stringify(defaultIntent)) as unknown;
const parsed = parseTaskIntent(rawInput);

const taskMap: TaskById = parsed.ok ? { [parsed.data.taskId]: parsed.data } : {};
const quoteInput: QuoteInput = {
  service: defaultIntent.service,
  maxAmount: defaultIntent.maxAmount,
};
const patch: TaskPatch = { maxAmount: "10" };

console.log({ quoteInput, patch, taskCount: Object.keys(taskMap).length });
printResult(parsed);
```

4. 运行类型检查和示例脚本。

```bash
pnpm exec tsc --noEmit
pnpm tsx src/playground/module1-types.ts
```

你应该看到类似输出：

```json
{
  "quoteInput": { "service": "risk-check", "maxAmount": "5" },
  "patch": { "maxAmount": "10" },
  "taskCount": 1
}
```

以及一个 `ok: true` 的任务 JSON。

说明：模块 1 先练 `unknown` + 类型收窄，所以这里手动写了 `parseTaskIntent`。到模块 5 会把这类手写校验替换为 zod schema。

验收：核心类型不使用 `any`；外部输入先用 `unknown` 接住，再校验和收窄；`pnpm exec tsc --noEmit` 能通过。

## 模块 2：ESM、Node.js 与 tsx

目标：能稳定运行 TypeScript 脚本和 CLI。

工具：`tsx`、Node.js ESM。

学什么：

- `package.json` 的 `type: "module"`
- `import` / `export`
- 默认导出 vs 命名导出
- ESM 下路径、扩展名、`import.meta.url`
- 用 `tsx` 跑脚本
- Node `--env-file`

操作步骤：

1. 确认 `package.json` 使用 ESM。

```json
{
  "type": "module"
}
```

2. 创建一个最小的 ESM 示例目录。

```bash
mkdir -p src/playground
touch src/playground/math.ts src/playground/module2-esm.ts
```

3. 把下面代码写入 `src/playground/math.ts`。

```ts
export function add(a: number, b: number): number {
  return a + b;
}

export const version = "esm-demo" as const;
```

4. 把下面代码写入 `src/playground/module2-esm.ts`。

```ts
import { add, version } from "./math.js";

function main(): void {
  const result = add(2, 3);

  console.log(
    JSON.stringify(
      {
        mode: "esm",
        version,
        result,
        fileUrl: import.meta.url,
      },
      null,
      2,
    ),
  );
}

main();
```

5. 运行脚本。

```bash
pnpm tsx src/playground/module2-esm.ts
```

你应该看到类似输出：

```json
{
  "mode": "esm",
  "version": "esm-demo",
  "result": 5,
  "fileUrl": "file:///.../src/playground/module2-esm.ts"
}
```

说明：这里故意用了 `./math.js`，因为在 `module: "NodeNext"` 下，TypeScript 会按 Node 的 ESM 规则理解路径；你开发时写 `.ts`，运行时对应的是 `.js`。

验收：能用 `tsx` 跑 ESM TypeScript 文件，不依赖复杂构建流程；能理解为什么相对导入常写 `.js` 后缀。

## 模块 3：CLI 参数解析

目标：命令行入口可维护，不手写参数解析。

工具：`commander` 或 `cac`，二选一即可。

学什么：

- command
- option
- required option
- subcommand
- help output
- exit code

练习命令：

```bash
pnpm agent quote --service risk-check --amount 5
pnpm agent execute --task-id task_001
pnpm agent status --task-id task_001
```

操作步骤：

1. 安装 CLI 参数解析库。

```bash
pnpm add commander
```

2. 在 `package.json` 里加一个脚本入口。

```json
{
  "scripts": {
    "agent": "tsx src/cli.ts"
  }
}
```

如果 `package.json` 里已经有 `scripts`，把 `agent` 合进去即可，不要覆盖已有脚本。

3. 创建 CLI 入口文件。

```bash
mkdir -p src
touch src/cli.ts
```

4. 把下面代码写入 `src/cli.ts`。

```ts
import { Command, InvalidArgumentError } from "commander";

type QuoteInput = {
  service: string;
  amount: number;
  json: boolean;
};

type TaskInput = {
  taskId: string;
  json: boolean;
};

type ExecuteInput = TaskInput & {
  dryRun: boolean;
};

type QuoteOptions = {
  service: string;
  amount: number;
  json?: boolean;
};

type ExecuteOptions = {
  taskId: string;
  dryRun?: boolean;
  json?: boolean;
};

type StatusOptions = {
  taskId: string;
  json?: boolean;
};

function parseNonEmpty(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new InvalidArgumentError("must not be empty");
  }

  return trimmed;
}

function parsePositiveAmount(value: string): number {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidArgumentError("amount must be a positive number");
  }

  return amount;
}

function printOutput(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  console.log(value);
}

function quote(input: QuoteInput): void {
  const result = {
    ok: true,
    action: "quote",
    service: input.service,
    amount: input.amount,
    currency: "USDC",
    estimatedFee: 0.05,
    taskId: "task_001",
  };

  printOutput(result, input.json);
}

function execute(input: ExecuteInput): void {
  const result = {
    ok: true,
    action: "execute",
    taskId: input.taskId,
    mode: input.dryRun ? "dry-run" : "live",
    status: input.dryRun ? "simulated" : "submitted",
  };

  printOutput(result, input.json);
}

function status(input: TaskInput): void {
  if (!input.taskId.startsWith("task_")) {
    printOutput(
      {
        ok: false,
        error: {
          code: "TASK_NOT_FOUND",
          message: `task not found: ${input.taskId}`,
        },
      },
      input.json,
    );

    process.exitCode = 1;
    return;
  }

  const result = {
    ok: true,
    action: "status",
    taskId: input.taskId,
    status: "completed",
  };

  printOutput(result, input.json);
}

const program = new Command();

program
  .name("agent")
  .description("Agent toolbox CLI")
  .version("0.1.0")
  .showHelpAfterError()
  .showSuggestionAfterError();

program
  .command("quote")
  .description("Get a quote for an agent service")
  .requiredOption("--service <name>", "service name, for example risk-check", parseNonEmpty)
  .requiredOption("--amount <usdc>", "max payment amount in USDC", parsePositiveAmount)
  .option("--json", "print JSON output", false)
  .action((options: QuoteOptions) => {
    quote({
      service: options.service,
      amount: options.amount,
      json: options.json ?? false,
    });
  });

program
  .command("execute")
  .description("Execute an approved task")
  .requiredOption("--task-id <id>", "task id returned by quote", parseNonEmpty)
  .option("--dry-run", "simulate the execution without submitting anything", false)
  .option("--json", "print JSON output", false)
  .action((options: ExecuteOptions) => {
    execute({
      taskId: options.taskId,
      dryRun: options.dryRun ?? false,
      json: options.json ?? false,
    });
  });

program
  .command("status")
  .description("Read task status")
  .requiredOption("--task-id <id>", "task id to query", parseNonEmpty)
  .option("--json", "print JSON output", false)
  .action((options: StatusOptions) => {
    status({
      taskId: options.taskId,
      json: options.json ?? false,
    });
  });

program.parse(process.argv);
```

5. 运行 help，确认 command / subcommand 都能看到说明。

```bash
pnpm agent --help
pnpm agent quote --help
```

6. 运行三个练习命令。

```bash
pnpm agent quote --service risk-check --amount 5 --json
pnpm agent execute --task-id task_001 --dry-run --json
pnpm agent status --task-id task_001 --json
```

你应该看到类似输出：

```json
{
  "ok": true,
  "action": "quote",
  "service": "risk-check",
  "amount": 5,
  "currency": "USDC",
  "estimatedFee": 0.05,
  "taskId": "task_001"
}
```

7. 试一个错误命令，观察 exit code。

```bash
pnpm agent status --task-id missing --json
echo $?
```

你应该看到 `TASK_NOT_FOUND`，并且 `echo $?` 输出 `1`。

说明：模块 3 的重点不是业务逻辑，而是把命令入口整理好。`commander` 负责解析参数、生成 help、处理必填参数；业务函数只接收 `QuoteInput` / `ExecuteInput` / `TaskInput` 这种整理后的对象。到模块 5 会继续把这些输入对象升级成 zod schema，避免 CLI、HTTP、MCP tool 各写一套校验。

验收：CLI 参数由成熟库解析，业务函数拿到的是已经整理过的对象。

## 模块 4：配置、环境变量与密钥安全

目标：配置可校验，密钥不泄漏。

工具：Node `--env-file` / `dotenvx` / `dotenv` + `zod`。

学什么：

- `.env`
- `.env.example`
- `.gitignore`
- 必填配置校验
- 默认值
- 日志脱敏
- 私钥/API key/RPC key 的安全边界

练习命令：

```bash
pnpm add zod
```

操作步骤：

1. 准备环境文件和忽略规则。

```bash
touch .env .env.example .gitignore
```

把 `.env.example` 写成这样：

```bash
RPC_URL=https://base-sepolia.example
CHAIN_ID=84532
LOG_LEVEL=info
SERVICE_API_KEY=replace-me
```

`.env` 里放本机真实值，格式可以类似这样：

```bash
RPC_URL=https://your-rpc.example
CHAIN_ID=84532
LOG_LEVEL=debug
SERVICE_API_KEY=sk-live-example
```

`.gitignore` 至少加入：

```gitignore
.env
```

2. 创建示例文件。

```bash
mkdir -p src/playground
touch src/playground/module4-config.ts
```

3. 把下面代码写入 `src/playground/module4-config.ts`。

```ts
import { z } from "zod";

const EnvSchema = z.object({
  RPC_URL: z.string().url(),
  CHAIN_ID: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SERVICE_API_KEY: z.string().min(1).optional(),
});

type Env = z.infer<typeof EnvSchema>;

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function maskUrl(value: string): string {
  const url = new URL(value);

  return `${url.protocol}//${url.host}/...`;
}

function formatIssue(issue: z.core.$ZodIssue): { path: string; message: string } {
  return {
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  };
}

function main(): void {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: {
            code: "INVALID_ENV",
            message: "configuration is invalid",
            issues: parsed.error.issues.map(formatIssue),
          },
        },
        null,
        2,
      ),
    );

    process.exitCode = 1;
    return;
  }

  const config: Env = parsed.data;

  const output = {
    ok: true,
    config: {
      rpcUrl: maskUrl(config.RPC_URL),
      chainId: config.CHAIN_ID,
      logLevel: config.LOG_LEVEL,
      serviceApiKey: config.SERVICE_API_KEY ? maskSecret(config.SERVICE_API_KEY) : null,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
```

4. 运行配置校验脚本。

```bash
node --env-file=.env --import tsx src/playground/module4-config.ts
```

你应该看到类似输出：

```json
{
  "ok": true,
  "config": {
    "rpcUrl": "https://your-rpc.example/...",
    "chainId": 84532,
    "logLevel": "debug",
    "serviceApiKey": "sk-l...mple"
  }
}
```

5. 故意删掉一个必填配置，再看失败输出。

比如把 `.env` 里的 `RPC_URL` 删掉后再运行：

```bash
node --env-file=.env --import tsx src/playground/module4-config.ts
echo $?
```

你应该看到 `INVALID_ENV`，并且 `echo $?` 输出 `1`。

说明：模块 4 的重点不是“怎么优雅地读环境变量”，而是把配置边界立起来。启动时先用 zod 检查 `.env`，再把通过校验的值交给业务逻辑；凡是可能泄漏的 secret，都要在日志和 JSON 输出里打码。

验收：缺少必填配置时启动失败，并输出清楚错误；日志不会打印 secret；`LOG_LEVEL` 可以有默认值。

## 模块 5：zod / JSON Schema 作为工具边界

目标：所有外部输入和结构化输出都有 schema。

工具：`zod`，必要时导出 JSON Schema。

学什么：

- `z.object`
- `z.enum`
- `z.string().min()`
- `z.coerce.number()`
- `safeParse`
- `z.infer`
- schema 复用
- 错误格式化

练习：建立这些 schema：

- `EnvSchema`
- `TaskIntentSchema`
- `ToolInputSchema`
- `AgentOutputSchema`

操作步骤：

1. 确认已经安装 zod。

```bash
pnpm add zod
```

2. 创建示例文件。

```bash
mkdir -p src/playground
touch src/playground/module5-schemas.ts
```

3. 把下面代码写入 `src/playground/module5-schemas.ts`。

```ts
import { z } from "zod";

const NonEmptyText = z.string().trim().min(1);
const ActionSchema = z.enum(["quote", "execute", "status"]);
const RiskLevelSchema = z.enum(["low", "medium", "high"]);
const ToolNameSchema = z.enum(["mockChainTool", "mockHttpTool"]);

const EnvSchema = z.object({
  RPC_URL: z.httpUrl(),
  CHAIN_ID: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SERVICE_API_KEY: z.string().min(1).optional(),
});

const TaskIntentSchema = z
  .object({
    taskId: NonEmptyText,
    action: ActionSchema,
    service: NonEmptyText,
    maxAmount: z.coerce.number().positive(),
    expiresAt: z.coerce.number().int().positive(),
    nonce: NonEmptyText,
  })
  .strict();

const ToolInputSchema = z
  .object({
    requestId: NonEmptyText,
    tool: ToolNameSchema,
    input: z
      .object({
        service: NonEmptyText,
        maxAmount: z.coerce.number().positive(),
      })
      .strict(),
  })
  .strict();

const AgentOutputSchema = z
  .object({
    ok: z.boolean(),
    action: ActionSchema,
    riskLevel: RiskLevelSchema,
    confidence: z.coerce.number().min(0).max(1),
    requiresApproval: z.boolean(),
    reasons: z.array(NonEmptyText),
  })
  .strict();

type Env = z.infer<typeof EnvSchema>;
type TaskIntent = z.infer<typeof TaskIntentSchema>;
type ToolInput = z.infer<typeof ToolInputSchema>;
type AgentOutput = z.infer<typeof AgentOutputSchema>;

function formatIssue(issue: z.core.$ZodIssue): { path: string; message: string } {
  return {
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  };
}

function report<T>(
  label: string,
  result: { success: true; data: T } | { success: false; error: z.ZodError },
): void {
  if (result.success) {
    console.log(JSON.stringify({ label, ok: true, data: result.data }, null, 2));
    return;
  }

  console.log(
    JSON.stringify(
      {
        label,
        ok: false,
        issues: result.error.issues.map(formatIssue),
      },
      null,
      2,
    ),
  );
}

function showJsonSchema(label: string, schema: z.ZodTypeAny): void {
  console.log(JSON.stringify({ label, jsonSchema: z.toJSONSchema(schema) }, null, 2));
}

function main(): void {
  const envCandidate: unknown = {
    RPC_URL: "https://base-sepolia.example",
    CHAIN_ID: "84532",
  };

  const taskIntentCandidate: unknown = {
    taskId: "task_001",
    action: "quote",
    service: "risk-check",
    maxAmount: "5",
    expiresAt: String(Date.now() + 60_000),
    nonce: "nonce_001",
  };

  const toolInputCandidate: unknown = {
    requestId: "req_001",
    tool: "mockHttpTool",
    input: {
      service: "risk-check",
      maxAmount: "5",
    },
  };

  const agentOutputCandidate: unknown = {
    ok: true,
    action: "quote",
    riskLevel: "low",
    confidence: "0.92",
    requiresApproval: false,
    reasons: ["fee is within limit"],
  };

  const badAgentOutputCandidate: unknown = {
    ok: "yes",
    action: "quote",
    riskLevel: "extreme",
    confidence: 1.5,
    requiresApproval: "no",
    reasons: ["", 123],
  };

  showJsonSchema("ToolInputSchema", ToolInputSchema);

  const envResult = EnvSchema.safeParse(envCandidate);
  report("EnvSchema", envResult);

  if (envResult.success) {
    const env: Env = envResult.data;
    console.log(JSON.stringify({ label: "Env typed", chainId: env.CHAIN_ID }, null, 2));
  }

  const taskIntentResult = TaskIntentSchema.safeParse(taskIntentCandidate);
  report("TaskIntentSchema", taskIntentResult);

  if (taskIntentResult.success) {
    const taskIntent: TaskIntent = taskIntentResult.data;
    console.log(
      JSON.stringify(
        {
          label: "TaskIntent typed",
          taskId: taskIntent.taskId,
          action: taskIntent.action,
          maxAmount: taskIntent.maxAmount,
        },
        null,
        2,
      ),
    );
  }

  const toolInputResult = ToolInputSchema.safeParse(toolInputCandidate);
  report("ToolInputSchema", toolInputResult);

  if (toolInputResult.success) {
    const toolInput: ToolInput = toolInputResult.data;
    console.log(
      JSON.stringify(
        {
          label: "ToolInput typed",
          requestId: toolInput.requestId,
          tool: toolInput.tool,
        },
        null,
        2,
      ),
    );
  }

  const agentOutputResult = AgentOutputSchema.safeParse(agentOutputCandidate);
  report("AgentOutputSchema", agentOutputResult);

  if (agentOutputResult.success) {
    const agentOutput: AgentOutput = agentOutputResult.data;
    console.log(
      JSON.stringify(
        {
          label: "AgentOutput typed",
          riskLevel: agentOutput.riskLevel,
          requiresApproval: agentOutput.requiresApproval,
        },
        null,
        2,
      ),
    );
  }

  const badAgentOutputResult = AgentOutputSchema.safeParse(badAgentOutputCandidate);
  report("AgentOutputSchema: bad", badAgentOutputResult);
}

main();
```

4. 运行示例脚本。

```bash
pnpm tsx src/playground/module5-schemas.ts
```

你应该看到几类输出：

- `ToolInputSchema` 转出来的 JSON Schema。
- `EnvSchema` / `TaskIntentSchema` / `ToolInputSchema` / `AgentOutputSchema` 的成功校验结果。
- `AgentOutputSchema: bad` 的失败校验结果，里面会列出 `ok`、`riskLevel`、`confidence`、`requiresApproval`、`reasons` 的错误。

5. 运行类型检查。

```bash
pnpm typecheck
```

说明：模块 5 的重点是把“外部边界”统一成 schema。`.env`、CLI 参数、HTTP 返回、LLM 输出、MCP tool input 都不要在业务逻辑里散落手写 `if` 校验，而是先过 zod schema；通过后再用 `z.infer` 得到 TypeScript 类型。

验收：`.env`、CLI 参数、HTTP 返回、LLM 输出、MCP tool input 都有 schema。

## 模块 6：异步与错误处理

目标：外部调用失败时可恢复、可定位。

工具：原生 `async/await` + `p-retry` + `p-timeout`。

学什么：

- `async/await`
- `Promise.all`
- 用 `p-timeout` 做 timeout
- 用 `p-retry` 做 retry
- 错误分类
- `Result` 风格返回
- 不吞异常

建议返回结构：

```ts
type AppResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; cause?: unknown } };
```

操作步骤：

1. 安装成熟的 retry / timeout 工具库。

```bash
pnpm add p-retry p-timeout
```

2. 创建模块 6 示例文件。

```bash
touch src/playground/module6-async-errors.ts
```

3. 在 `src/playground/module6-async-errors.ts` 里实现这些部分：

- `AppErrorCode`：错误类型枚举，例如 `INVALID_INPUT` / `TOOL_FAILED` / `TIMEOUT` / `UNKNOWN_ERROR`。
- `AppResult<T>`：成功 / 失败联合类型。
- `validateQuoteRequest`：先校验输入，非法输入直接返回 `INVALID_INPUT`，不重试。
- `mockQuoteApi`：模拟外部 HTTP/RPC 工具，有成功、临时失败、超时三种情况。
- `callQuoteToolWithTimeout`：用 `p-timeout` 给异步工具调用加超时控制。
- `getQuoteWithRetry`：用 `p-retry` 组合输入校验、工具调用、超时、重试。
- `classifyToolFailure`：把工具库抛出的异常整理成自己的 `AppError`。
- `Promise.all` 示例：并发跑一个 quote 请求和一个 task status 查询。
- `report`：把成功 / 失败都输出成结构化 JSON。

4. 运行示例。

```bash
pnpm demo:module6
```

等价于：

```bash
pnpm tsx src/playground/module6-async-errors.ts
```

你应该看到几类输出：

- `success`：普通外部调用一次成功。
- `retry succeeds`：第一次模拟上游失败，第二次重试成功。
- `timeout fails`：模拟慢接口超时，重试后仍失败，输出 `TIMEOUT`。
- `invalid input fails without retry`：输入非法，直接返回 `INVALID_INPUT`，不会重试。
- `Promise.all quote` / `Promise.all status`：两个异步任务并发完成。

5. 运行类型检查。

```bash
pnpm typecheck
```

说明：模块 6 的重点不是接真实 HTTP/RPC，而是先把“异步外部调用”的错误处理形状练稳。retry / timeout 这种通用机制优先用成熟库，本示例直接使用 `p-retry` / `p-timeout`；自己写的部分只负责输入校验、错误分类、结构化输出和业务编排。

验收：HTTP/RPC/mock 工具失败时，CLI 输出结构化错误，而不是直接抛一屏 stack trace；`pnpm typecheck` 和 `pnpm demo:module6` 都能通过。

## 模块 7：日志与可观测性基础

目标：能复盘一次 agent 任务做了什么。

工具：`pino` 优先，`winston` 可选。本路线先用 `pino`，不要手写 logger。

学什么：

- log level
- structured log
- task id / request id
- error log
- 日志脱敏

示例日志：

```json
{
  "level": "info",
  "taskId": "task_001",
  "action": "quote",
  "tool": "mockRiskApi",
  "status": "success"
}
```

操作步骤：

1. 安装结构化日志库。

```bash
pnpm add pino
```

2. 创建模块 7 示例文件。

```bash
touch src/playground/module7-logging.ts
```

3. 在 `package.json` 里加入演示脚本。

```json
{
  "scripts": {
    "demo:module7": "tsx src/playground/module7-logging.ts"
  }
}
```

4. 在 `src/playground/module7-logging.ts` 里实现这些部分：

- `createLogger`：用 `pino` 创建 logger，支持 `LOG_LEVEL`。
- `TaskContext`：把 `requestId` / `taskId` / `action` 作为日志上下文。
- `logger.child(context)`：让同一个任务的每条日志都自动带上上下文字段。
- `maskSecret` / `maskUrl`：打印日志前先脱敏 API key 和 RPC URL。
- `mockQuoteTool`：模拟一个外部工具，既能成功，也能失败。
- `runTask`：串起 `task.started`、`tool.input.prepared`、`tool.completed`、`task.requires_approval`、`task.completed` / `task.failed`。

5. 运行示例。

```bash
pnpm demo:module7
```

你应该看到多行 JSON 日志。重点观察这些字段：

- `level`：日志级别，`30` 是 info，`40` 是 warn，`50` 是 error。
- `time`：日志时间。
- `requestId` / `taskId` / `action`：同一次任务的追踪字段。
- `event`：这条日志代表哪个步骤，例如 `task.started`、`tool.completed`、`task.failed`。
- `apiKey` / `rpcUrl`：应该是脱敏后的值，不能出现完整密钥。

6. 换日志级别运行。

```bash
LOG_LEVEL=info pnpm demo:module7
LOG_LEVEL=debug pnpm demo:module7
```

`LOG_LEVEL=info` 时不会显示 `debug` 日志；`LOG_LEVEL=debug` 时会显示更细的 `tool.input.prepared`。

验收：一次 CLI 调用的关键步骤都能通过日志串起来；日志里能看到 `requestId` / `taskId`；失败路径有 error log；密钥和 RPC URL 不会原样泄漏。

## 模块 8：测试、Mock 与质量工具

目标：脚手架有基本回归保护。

工具：`Vitest` / `Jest`、`msw` / `nock`、`ESLint`、`Prettier`、`lint-staged`、`husky`。本路线先用 `Vitest` + `nock` + `ESLint` + `Prettier`，不要手写测试 runner 或 HTTP mock。

学什么：

- happy path
- invalid input
- external API failure
- timeout
- mock HTTP
- typecheck / lint / format

必须覆盖：

- `.env` 缺字段
- CLI 参数错误
- mock API 成功
- mock API 失败
- zod 输出校验失败

操作步骤：

1. 安装测试、HTTP mock、lint、format 工具。

```bash
pnpm add -D vitest nock eslint @eslint/js typescript-eslint prettier
```

2. 在 `package.json` 里加入质量脚本。

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint .",
    "format:check": "prettier . --check"
  }
}
```

3. 创建 ESLint 和 Prettier 配置。

```bash
touch eslint.config.js .prettierrc.json
```

`eslint.config.js`：

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ["node_modules/**", "coverage/**", "dist/**"],
});
```

`.prettierrc.json`：

```json
{
  "printWidth": 100,
  "trailingComma": "all"
}
```

4. 创建一个可测试的小模块。

```bash
touch src/playground/module8-quality.ts
```

这个文件里实现这些部分：

- `EnvSchema`：校验 `SERVICE_BASE_URL` 和 `SERVICE_API_KEY`。
- `QuoteInputSchema`：校验工具输入，例如 `service` 和 `amount`。
- `QuoteResponseSchema`：校验 HTTP API 返回值。
- `loadEnv`：把 `.env` / `process.env` 变成结构化配置结果。
- `fetchQuote`：调用 `/quote` HTTP API，并用 zod 校验输入和响应。
- `AppResult<T>`：统一表达成功 / 失败。

核心示例：

```ts
const response = await fetch(new URL("/quote", env.SERVICE_BASE_URL), {
  method: "POST",
  headers: {
    authorization: `Bearer ${env.SERVICE_API_KEY}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(inputResult.data),
});
```

说明：这里用的是 Node 内置 `fetch`，不是自己封装 HTTP 客户端。模块 8 的重点是“怎么测试 HTTP 调用”，不是手写网络库。

5. 创建测试文件。

```bash
mkdir -p test
touch test/module8-quality.test.ts
```

测试里覆盖这些路径：

- `loads env successfully`：环境变量合法。
- `fails bad env`：环境变量缺失或格式错误。
- `fetches quote successfully`：用 `nock` mock 成功 HTTP 响应。
- `fails invalid input before HTTP`：输入非法时不应该发 HTTP。
- `fails when response shape is wrong`：HTTP 返回结构不对时返回 `INVALID_RESPONSE`。

`nock` 的核心用法：

```ts
nock("https://quote.example").post("/quote", { service: "risk-check", amount: 5 }).reply(200, {
  price: "0.10",
  currency: "USDC",
  requiresApproval: false,
});
```

说明：`nock` 会拦截这次 HTTP 请求并返回假响应，所以测试不需要真的访问外网。

6. 运行类型检查。

```bash
pnpm typecheck
```

7. 运行测试。

```bash
pnpm test
```

你应该看到 `module8-quality.test.ts` 里的测试通过。

8. 运行 lint 和 format check。

```bash
pnpm lint
pnpm format:check
```

如果 `format:check` 提示格式不一致，可以运行：

```bash
pnpm prettier . --write
```

9. 最终验收命令。

验收命令：

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

说明：模块 8 的重点是建立最小质量闭环。代码改动后，至少跑 `typecheck`、`lint`、`test`；涉及格式时再跑 `format:check`。HTTP mock、测试 runner、lint、format 都用成熟工具，不要自己手写。

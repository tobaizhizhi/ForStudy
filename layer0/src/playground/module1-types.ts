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

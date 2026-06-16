import pino from "pino";

type LogLevel = "debug" | "info" | "warn" | "error";

type TaskContext = {
  requestId: string;
  taskId: string;
  action: "quote" | "execute" | "status";
};

type ToolInput = {
  service: string;
  amount: number;
  apiKey: string;
  rpcUrl: string;
};

type ToolOutput = {
  price: string;
  currency: "USDC";
  requiresApproval: boolean;
};

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

function createLogger(level: LogLevel): pino.Logger {
  return pino({
    level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function mockQuoteTool(input: ToolInput): Promise<ToolOutput> {
  await sleep(30);

  if (input.amount > 10) {
    throw new Error("amount exceeds demo limit");
  }

  return {
    price: input.amount > 5 ? "0.25" : "0.10",
    currency: "USDC",
    requiresApproval: input.amount > 5,
  };
}

async function runTask(logger: pino.Logger, context: TaskContext, input: ToolInput): Promise<void> {
  const taskLogger = logger.child(context);

  taskLogger.info({
    event: "task.started",
    service: input.service,
    amount: input.amount,
  });

  taskLogger.debug({
    event: "tool.input.prepared",
    tool: "mockQuoteTool",
    service: input.service,
    amount: input.amount,
    apiKey: maskSecret(input.apiKey),
    rpcUrl: maskUrl(input.rpcUrl),
  });

  try {
    const output = await mockQuoteTool(input);

    taskLogger.info({
      event: "tool.completed",
      tool: "mockQuoteTool",
      output,
    });

    if (output.requiresApproval) {
      taskLogger.warn({
        event: "task.requires_approval",
        reason: "amount is above auto-execute threshold",
      });
    }

    taskLogger.info({
      event: "task.completed",
      status: "success",
    });
  } catch (error) {
    taskLogger.error({
      event: "task.failed",
      status: "failed",
      err: error,
    });
  }
}

async function main(): Promise<void> {
  const logLevel = (process.env.LOG_LEVEL ?? "debug") as LogLevel;
  const logger = createLogger(logLevel);

  await runTask(
    logger,
    { requestId: "req_001", taskId: "task_001", action: "quote" },
    {
      service: "risk-check",
      amount: 8,
      apiKey: "sk-demo-1234567890",
      rpcUrl: "https://base-sepolia.example/rpc/private-token",
    },
  );

  await runTask(
    logger,
    { requestId: "req_002", taskId: "task_002", action: "quote" },
    {
      service: "risk-check",
      amount: 12,
      apiKey: "sk-demo-1234567890",
      rpcUrl: "https://base-sepolia.example/rpc/private-token",
    },
  );
}

await main();

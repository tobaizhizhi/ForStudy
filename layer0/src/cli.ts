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

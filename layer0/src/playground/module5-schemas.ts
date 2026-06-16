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

  const badEnvCandidate: unknown = {
    RPC_URL: "not-a-url",
    CHAIN_ID: "-1",
    LOG_LEVEL: "verbose",
  };

  const taskIntentCandidate: unknown = {
    taskId: "task_001",
    action: "quote",
    service: "risk-check",
    maxAmount: "5",
    expiresAt: String(Date.now() + 60_000),
    nonce: "nonce_001",
  };

  const badTaskIntentCandidate: unknown = {
    taskId: "",
    action: "pay",
    service: "",
    maxAmount: "0",
    expiresAt: "abc",
    nonce: "",
  };

  const toolInputCandidate: unknown = {
    requestId: "req_001",
    tool: "mockHttpTool",
    input: {
      service: "risk-check",
      maxAmount: "5",
    },
  };

  const badToolInputCandidate: unknown = {
    requestId: "",
    tool: "unknownTool",
    input: {
      service: "",
      maxAmount: "-3",
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
  report("EnvSchema: good", envResult);

  if (envResult.success) {
    const env: Env = envResult.data;
    console.log(
      JSON.stringify(
        {
          label: "Env typed",
          chainId: env.CHAIN_ID,
          logLevel: env.LOG_LEVEL,
        },
        null,
        2,
      ),
    );
  }

  const badEnvResult = EnvSchema.safeParse(badEnvCandidate);
  report("EnvSchema: bad", badEnvResult);

  const taskIntentResult = TaskIntentSchema.safeParse(taskIntentCandidate);
  report("TaskIntentSchema: good", taskIntentResult);

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

  const badTaskIntentResult = TaskIntentSchema.safeParse(badTaskIntentCandidate);
  report("TaskIntentSchema: bad", badTaskIntentResult);

  const toolInputResult = ToolInputSchema.safeParse(toolInputCandidate);
  report("ToolInputSchema: good", toolInputResult);

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

  const badToolInputResult = ToolInputSchema.safeParse(badToolInputCandidate);
  report("ToolInputSchema: bad", badToolInputResult);

  const agentOutputResult = AgentOutputSchema.safeParse(agentOutputCandidate);
  report("AgentOutputSchema: good", agentOutputResult);

  if (agentOutputResult.success) {
    const agentOutput: AgentOutput = agentOutputResult.data;
    console.log(
      JSON.stringify(
        {
          label: "AgentOutput typed",
          action: agentOutput.action,
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

import { z } from "zod";

const EnvSchema = z.object({
  RPC_URL: z.url(),
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

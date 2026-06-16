import { z } from "zod";

export const EnvSchema = z
  .object({
    SERVICE_BASE_URL: z.string().url(),
    SERVICE_API_KEY: z.string().min(1),
  })
  .strict();

export const QuoteInputSchema = z
  .object({
    service: z.string().min(1),
    amount: z.number().positive(),
  })
  .strict();

export const QuoteResponseSchema = z
  .object({
    price: z.string().min(1),
    currency: z.literal("USDC"),
    requiresApproval: z.boolean(),
  })
  .strict();

export type Env = z.infer<typeof EnvSchema>;
export type QuoteInput = z.infer<typeof QuoteInputSchema>;
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

export type AppResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };

export function loadEnv(source: NodeJS.ProcessEnv): AppResult<Env> {
  const parsed = EnvSchema.safeParse(source);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_ENV",
        message: parsed.error.issues.map((issue) => issue.path.join(".")).join(", "),
      },
    };
  }

  return { ok: true, value: parsed.data };
}

export async function fetchQuote(env: Env, input: unknown): Promise<AppResult<QuoteResponse>> {
  const inputResult = QuoteInputSchema.safeParse(input);

  if (!inputResult.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: inputResult.error.issues.map((issue) => issue.path.join(".")).join(", "),
      },
    };
  }

  const response = await fetch(new URL("/quote", env.SERVICE_BASE_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.SERVICE_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(inputResult.data),
  });

  if (!response.ok) {
    return {
      ok: false,
      error: {
        code: "HTTP_FAILED",
        message: `quote service returned ${response.status}`,
      },
    };
  }

  const body = (await response.json()) as unknown;
  const outputResult = QuoteResponseSchema.safeParse(body);

  if (!outputResult.success) {
    return {
      ok: false,
      error: {
        code: "INVALID_RESPONSE",
        message: outputResult.error.issues.map((issue) => issue.path.join(".")).join(", "),
      },
    };
  }

  return { ok: true, value: outputResult.data };
}

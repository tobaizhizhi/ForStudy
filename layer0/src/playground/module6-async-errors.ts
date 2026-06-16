import pRetry from "p-retry";
import pTimeout, { TimeoutError as PTimeoutError } from "p-timeout";

type AppErrorCode = "INVALID_INPUT" | "TOOL_FAILED" | "TIMEOUT" | "UNKNOWN_ERROR";

type AppError = {
  code: AppErrorCode;
  message: string;
  retryable: boolean;
  cause?: string | undefined;
};

type AppResult<T> = { ok: true; value: T } | { ok: false; error: AppError };

type ServiceName = "risk-check" | "unstable-risk-check" | "slow-risk-check";

type QuoteRequest = {
  requestId: string;
  service: ServiceName;
  amount: number;
  timeoutMs: number;
};

type Quote = {
  requestId: string;
  service: ServiceName;
  price: string;
  currency: "USDC";
  requiresApproval: boolean;
  attempt: number;
};

type TaskStatus = {
  taskId: string;
  status: "pending" | "complete";
};

function ok<T>(value: T): AppResult<T> {
  return { ok: true, value };
}

function fail<T>(error: AppError): AppResult<T> {
  return { ok: false, error };
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }

  return String(cause);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function validateQuoteRequest(request: QuoteRequest): AppResult<QuoteRequest> {
  if (request.amount <= 0) {
    return fail({
      code: "INVALID_INPUT",
      message: "amount must be greater than 0",
      retryable: false,
    });
  }

  if (request.timeoutMs <= 0) {
    return fail({
      code: "INVALID_INPUT",
      message: "timeoutMs must be greater than 0",
      retryable: false,
    });
  }

  return ok(request);
}

async function mockQuoteApi(request: QuoteRequest, attempt: number): Promise<Quote> {
  if (request.service === "slow-risk-check") {
    await sleep(request.timeoutMs + 50);
  } else {
    await sleep(30);
  }

  if (request.service === "unstable-risk-check" && attempt === 1) {
    throw new Error("temporary upstream 503");
  }

  return {
    requestId: request.requestId,
    service: request.service,
    price: request.amount > 5 ? "0.25" : "0.10",
    currency: "USDC",
    requiresApproval: request.amount > 5,
    attempt,
  };
}

function classifyToolFailure(cause: unknown, attempts: number): AppError {
  if (cause instanceof PTimeoutError) {
    return {
      code: "TIMEOUT",
      message: `failed after ${attempts} attempt(s)`,
      retryable: false,
      cause: errorMessage(cause),
    };
  }

  return {
    code: cause instanceof Error ? "TOOL_FAILED" : "UNKNOWN_ERROR",
    message: `failed after ${attempts} attempt(s)`,
    retryable: false,
    cause: errorMessage(cause),
  };
}

function callQuoteToolWithTimeout(request: QuoteRequest, attempt: number): Promise<Quote> {
  return pTimeout(mockQuoteApi(request, attempt), {
    milliseconds: request.timeoutMs,
    message: `operation timed out after ${request.timeoutMs}ms`,
  });
}

async function getQuoteWithRetry(
  request: QuoteRequest,
  attempts: number,
): Promise<AppResult<Quote>> {
  const validation = validateQuoteRequest(request);

  if (!validation.ok) {
    return validation;
  }

  if (!Number.isInteger(attempts) || attempts <= 0) {
    return fail({
      code: "INVALID_INPUT",
      message: "attempts must be a positive integer",
      retryable: false,
    });
  }

  try {
    const quote = await pRetry(
      (attemptNumber) => callQuoteToolWithTimeout(validation.value, attemptNumber),
      {
        retries: attempts - 1,
        minTimeout: 25,
        factor: 1,
      },
    );

    return ok(quote);
  } catch (cause) {
    return fail(classifyToolFailure(cause, attempts));
  }
}

async function getMockTaskStatus(taskId: string): Promise<AppResult<TaskStatus>> {
  await sleep(20);

  return ok({ taskId, status: "complete" });
}

function report<T>(label: string, result: AppResult<T>): void {
  if (result.ok) {
    console.log(JSON.stringify({ label, ok: true, value: result.value }, null, 2));
    return;
  }

  console.log(JSON.stringify({ label, ok: false, error: result.error }, null, 2));
}

async function main(): Promise<void> {
  const success = await getQuoteWithRetry(
    { requestId: "req_success", service: "risk-check", amount: 5, timeoutMs: 200 },
    2,
  );
  report("success", success);

  const unstable = await getQuoteWithRetry(
    { requestId: "req_retry", service: "unstable-risk-check", amount: 8, timeoutMs: 200 },
    3,
  );
  report("retry succeeds", unstable);

  const timeout = await getQuoteWithRetry(
    { requestId: "req_timeout", service: "slow-risk-check", amount: 3, timeoutMs: 20 },
    2,
  );
  report("timeout fails", timeout);

  const invalid = await getQuoteWithRetry(
    { requestId: "req_invalid", service: "risk-check", amount: -1, timeoutMs: 200 },
    2,
  );
  report("invalid input fails without retry", invalid);

  const [quoteResult, statusResult] = await Promise.all([
    getQuoteWithRetry(
      { requestId: "req_parallel", service: "risk-check", amount: 2, timeoutMs: 200 },
      2,
    ),
    getMockTaskStatus("task_001"),
  ]);

  report("Promise.all quote", quoteResult);
  report("Promise.all status", statusResult);
}

await main();

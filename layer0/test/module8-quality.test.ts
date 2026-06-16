import nock from "nock";
import { afterEach, describe, expect, it } from "vitest";
import { fetchQuote, loadEnv } from "../src/playground/module8-quality.js";

describe("module8-quality", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("loads env successfully", () => {
    const result = loadEnv({
      SERVICE_BASE_URL: "https://quote.example",
      SERVICE_API_KEY: "sk-demo",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.SERVICE_BASE_URL).toBe("https://quote.example");
    }
  });

  it("fails bad env", () => {
    const result = loadEnv({
      SERVICE_BASE_URL: "not-a-url",
      SERVICE_API_KEY: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_ENV");
    }
  });

  it("fetches quote successfully", async () => {
    const scope = nock("https://quote.example")
      .post("/quote", { service: "risk-check", amount: 5 })
      .reply(200, {
        price: "0.10",
        currency: "USDC",
        requiresApproval: false,
      });

    const result = await fetchQuote(
      {
        SERVICE_BASE_URL: "https://quote.example",
        SERVICE_API_KEY: "sk-demo",
      },
      { service: "risk-check", amount: 5 },
    );

    expect(result.ok).toBe(true);
    expect(scope.isDone()).toBe(true);
    if (result.ok) {
      expect(result.value.price).toBe("0.10");
    }
  });

  it("fails invalid input before HTTP", async () => {
    const result = await fetchQuote(
      {
        SERVICE_BASE_URL: "https://quote.example",
        SERVICE_API_KEY: "sk-demo",
      },
      { service: "risk-check", amount: -1 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_INPUT");
    }
  });

  it("fails when response shape is wrong", async () => {
    nock("https://quote.example").post("/quote").reply(200, {
      price: 0.1,
      currency: "USDC",
      requiresApproval: false,
    });

    const result = await fetchQuote(
      {
        SERVICE_BASE_URL: "https://quote.example",
        SERVICE_API_KEY: "sk-demo",
      },
      { service: "risk-check", amount: 5 },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_RESPONSE");
    }
  });
});

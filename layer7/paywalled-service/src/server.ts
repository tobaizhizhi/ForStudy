import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { FACILITATOR_URL, NETWORK, PAY_TO, PORT, PRICE } from "./config.js";

// ============================================================================
// 进程①：x402 付费服务 —— 用官方中间件把 /premium 变成付费资源。
// 不手写 402 握手 / proof 解析 / 结算撮合：paymentMiddleware + facilitator 全包了。
//
// 起：pnpm start:server（不需要私钥；收款地址 PAY_TO 建议填成你的测试钱包）
// ============================================================================

const app = express();

// facilitator 负责验证付款、上链结算；用公共测试 facilitator，不自建。
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });

// resource server：为 Base Sepolia 注册 exact-evm 结算方案。
const resourceServer = new x402ResourceServer(facilitator).register(NETWORK, new ExactEvmScheme());

// 把 /premium 挂上付费闸门：每次 GET 收 PRICE 的 USDC 到 PAY_TO。
app.use(
  paymentMiddleware(
    {
      "GET /premium": {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: "一条付费的链上数据分析结果（教学示例）",
      },
    },
    resourceServer,
  ),
);

// 付费通过后才会走到这里，返回真正的资源。
app.get("/premium", (_req, res) => {
  res.json({
    result: "这是付费内容：agent B 的链上分析结果",
    generatedAt: "2026-07-09T00:00:00Z",
  });
});

// 免费的健康检查（不挂闸门）。
app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] x402 付费服务已上线：http://127.0.0.1:${PORT}`);
  console.log(`[server] 付费资源：GET /premium  价格：${PRICE}  收款：${PAY_TO}`);
  console.log(`[server] facilitator：${FACILITATOR_URL}（${NETWORK}）`);
  if (PAY_TO === "0x0000000000000000000000000000000000000000") {
    console.log("[server] ⚠️ PAY_TO 还是零地址——请在 .env 填成你的测试收款钱包。");
  }
});

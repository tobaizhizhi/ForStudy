// ============================================================================
// paywalled-service 统一配置。
// 真连 Base Sepolia 公共 facilitator + 测网 USDC。
// 私钥只用测网、只进 .env（.gitignore 已排除），不要提交、不要用主网私钥。
// ============================================================================

/** Base Sepolia 公共 RPC。 */
export const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";

/** CAIP-2 网络标识：Base Sepolia = eip155:84532（x402 v2 用 CAIP-2）。 */
export const NETWORK = "eip155:84532";

/** 公共测试 facilitator（Base Sepolia + Solana devnet，免自建）。 */
export const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "https://x402.org/facilitator";

/** 付费服务端口。 */
export const PORT = Number(process.env.PORT ?? 41207);

/** 服务地址（client 请求这里）。 */
export const SERVICE_URL = process.env.SERVICE_URL ?? `http://127.0.0.1:${PORT}`;

/** 收款地址（server 卖服务、收 USDC 到这里）。必须填成你自己的测试钱包。 */
export const PAY_TO = process.env.PAY_TO ?? "0x0000000000000000000000000000000000000000";

/** 单次调用价格（美元字符串，x402 会换算成 USDC 原子单位）。 */
export const PRICE = process.env.PRICE ?? "$0.001";

/**
 * client 付款用的测试钱包私钥（只有 start:client 需要）。
 * inspect（看 402 握手）和 start:server 都不需要它。
 */
export const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY ?? "";

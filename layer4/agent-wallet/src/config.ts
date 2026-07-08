import "dotenv/config";
import { createPublicClient, http, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { createPimlicoClient } from "permissionless/clients/pimlico";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}，请在 .env 里配置（参考 .env.example）`);
  }
  return value;
}

function optionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  return value && value.startsWith("0x") ? (value as Address) : undefined;
}

export const CHAIN = baseSepolia;
export const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

// Pimlico 同一个 endpoint 同时充当 bundler 和 paymaster。
export const PIMLICO_URL = `https://api.pimlico.io/v2/${CHAIN.id}/rpc?apikey=${required("PIMLICO_API_KEY")}`;

// 本课程用 EntryPoint v0.7；要用 v0.8 就换成 entryPoint08Address 并把 version 改成 "0.8"。
export const ENTRY_POINT = { address: entryPoint07Address, version: "0.7" } as const;

export const OWNER_PRIVATE_KEY = required("OWNER_PRIVATE_KEY") as Hex;
export const AGENT_PRIVATE_KEY = (process.env.AGENT_PRIVATE_KEY ?? "") as Hex;

export const ESCROW_ADDRESS = optionalAddress("ESCROW_ADDRESS");
export const TOKEN_ADDRESS = optionalAddress("TOKEN_ADDRESS");
export const AGENT_SMART_ACCOUNT_ADDRESS = optionalAddress("AGENT_SMART_ACCOUNT_ADDRESS");

// 只读链客户端（不签名、不发交易）。
export const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });

// Pimlico 客户端：拿 gas price、赞助 UserOperation。
export const pimlicoClient = createPimlicoClient({
  transport: http(PIMLICO_URL),
  entryPoint: ENTRY_POINT,
});

export function explorerTx(hash: string): string {
  return `https://sepolia.basescan.org/tx/${hash}`;
}

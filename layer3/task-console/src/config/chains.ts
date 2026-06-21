export const BASE_SEPOLIA_CHAIN_ID = 84532;

export const BASE_SEPOLIA = {
  id: BASE_SEPOLIA_CHAIN_ID,
  name: "Base Sepolia",
  rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL,
  explorerUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_EXPLORER_URL,
} as const;
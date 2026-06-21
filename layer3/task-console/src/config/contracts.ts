import { isAddress } from "viem";

function optionalAddress(value: string | undefined): `0x${string}` | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }

  return value;
}

function optionalBlock(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return BigInt(value);
}

export const CONTRACTS = {
  escrow: {
    name: "AgentTaskEscrowWithPermit",
    address: optionalAddress(process.env.NEXT_PUBLIC_AGENT_TASK_ESCROW_ADDRESS),
    deployBlock: optionalBlock(process.env.NEXT_PUBLIC_AGENT_TASK_ESCROW_DEPLOY_BLOCK),
  },
  usdc: {
    name: "Base Sepolia USDC",
    address: optionalAddress(process.env.NEXT_PUBLIC_USDC_ADDRESS),
  },
  permitToken: {
    name: "Permit Token",
    address: optionalAddress(process.env.NEXT_PUBLIC_PERMIT_TOKEN_ADDRESS),
    deployBlock: optionalBlock(process.env.NEXT_PUBLIC_PERMIT_TOKEN_DEPLOY_BLOCK),
  },
} as const;

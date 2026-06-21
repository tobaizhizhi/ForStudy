import { useReadContract, useReadContracts } from "wagmi";

import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { CONTRACTS } from "@/config/contracts";

type HookOptions = {
  enabled?: boolean;
};

export function useEscrowStatus({ enabled = true }: HookOptions = {}) {
  const address = CONTRACTS.escrow.address;
  const contracts =
    address === undefined
      ? []
      : [
          { address, abi: agentTaskEscrowAbi, functionName: "taskCount" },
          { address, abi: agentTaskEscrowAbi, functionName: "paused" },
          { address, abi: agentTaskEscrowAbi, functionName: "PAUSER_ROLE" },
        ];

  return useReadContracts({
    allowFailure: false,
    contracts,
    query: {
      enabled: enabled && Boolean(address),
      staleTime: 10_000,
      refetchInterval: 15_000,
    },
  });
}

export function useHasPauserRole(
  role: `0x${string}` | undefined,
  account: `0x${string}` | undefined,
  { enabled = true }: HookOptions = {},
) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "hasRole",
    args: role && account ? [role, account] : undefined,
    query: {
      enabled: enabled && Boolean(escrow && role && account),
      staleTime: 10_000,
    },
  });
}

export function useTask(taskId: bigint | undefined, { enabled = true }: HookOptions = {}) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "tasks",
    args: taskId ? [taskId] : undefined,
    query: {
      enabled: enabled && Boolean(escrow && taskId && taskId > BigInt(0)),
      staleTime: 5_000,
    },
  });
}

export function useClientNonce(
  client: `0x${string}` | undefined,
  { enabled = true }: HookOptions = {},
) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "nonces",
    args: client ? [client] : undefined,
    query: {
      enabled: enabled && Boolean(escrow && client),
      staleTime: 5_000,
    },
  });
}

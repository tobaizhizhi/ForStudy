import type { Address } from "viem";

import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";

export const TASK_INTENT_ACTION = "complete" as const;

export const taskIntentTypes = {
  TaskIntent: [
    { name: "client", type: "address" },
    { name: "taskId", type: "uint256" },
    { name: "operator", type: "address" },
    { name: "action", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export type TaskIntentMessage = {
  client: Address;
  taskId: bigint;
  operator: Address;
  action: typeof TASK_INTENT_ACTION;
  nonce: bigint;
  deadline: bigint;
};

export function buildTaskIntentDomain(escrow: Address) {
  return {
    name: "AgentTaskEscrow",
    version: "1",
    chainId: BASE_SEPOLIA_CHAIN_ID,
    verifyingContract: escrow,
  } as const;
}

export function buildTaskIntentMessage({
  client,
  taskId,
  operator,
  nonce,
  deadline,
}: Omit<TaskIntentMessage, "action">): TaskIntentMessage {
  return {
    client,
    taskId,
    operator,
    action: TASK_INTENT_ACTION,
    nonce,
    deadline,
  };
}

export function getDefaultIntentDeadline(validForSeconds = 10 * 60) {
  return BigInt(Math.floor(Date.now() / 1000) + validForSeconds);
}

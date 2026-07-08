import { parseEventLogs, type Address, type Hex, type TransactionReceipt } from "viem";

import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";

export type TaskIntentUsedEvent = {
  client: Address;
  taskId: bigint;
  operator: Address;
  action: string;
  nonce: bigint;
};

export type TaskCompletedEvent = {
  taskId: bigint;
  client: Address;
  operator: Address;
  resultURI: string;
};

export type TaskCompletionEvents = {
  taskIntentUsed?: TaskIntentUsedEvent;
  taskCompleted?: TaskCompletedEvent;
};

export function parseTaskCompletionEvents(receipt: TransactionReceipt): TaskCompletionEvents {
  const logs = parseEventLogs({
    abi: agentTaskEscrowAbi,
    logs: receipt.logs,
  });
  const events: TaskCompletionEvents = {};

  for (const log of logs) {
    if (log.eventName === "TaskIntentUsed") {
      const args = log.args as {
        client: Address;
        taskId: bigint;
        operator: Address;
        action: string;
        nonce: bigint;
      };

      events.taskIntentUsed = {
        client: args.client,
        taskId: args.taskId,
        operator: args.operator,
        action: args.action,
        nonce: args.nonce,
      };
    }

    if (log.eventName === "TaskCompleted") {
      const args = log.args as {
        taskId: bigint;
        client: Address;
        operator: Address;
        resultURI: string;
      };

      events.taskCompleted = {
        taskId: args.taskId,
        client: args.client,
        operator: args.operator,
        resultURI: args.resultURI,
      };
    }
  }

  return events;
}

export function getExplorerTxUrl(explorerUrl: string | undefined, hash: Hex) {
  return explorerUrl ? `${explorerUrl}/tx/${hash}` : undefined;
}

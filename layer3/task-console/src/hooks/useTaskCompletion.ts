"use client";

import { useState } from "react";
import type { Address, Hex, Hash, TransactionReceipt } from "viem";
import { usePublicClient, useReadContract, useWalletClient } from "wagmi";

import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { CONTRACTS } from "@/config/contracts";
import { parseTaskCompletionEvents, type TaskCompletionEvents } from "@/lib/events";
import { getReadableError } from "@/lib/errors";
import type { TaskIntentMessage } from "@/lib/eip712";

type HookOptions = {
  enabled?: boolean;
};

export type TaskCompletionStep =
  | "idle"
  | "simulating"
  | "signing"
  | "pending"
  | "success"
  | "failed";

export type TaskCompletionState = {
  step: TaskCompletionStep;
  message: string;
  hash?: Hash;
  receipt?: TransactionReceipt;
  events?: TaskCompletionEvents;
  error?: string;
};

export type CompleteTaskInput = {
  account: Address;
  escrow: Address;
  intent: TaskIntentMessage;
  signature: Hex;
  resultURI: string;
};

const initialState: TaskCompletionState = {
  step: "idle",
  message: "准备好模块 6 的签名后，可以由 operator 提交 completeTask。",
};

export function useVerifyCompleteIntent(
  intent: TaskIntentMessage | undefined,
  signature: Hex | undefined,
  { enabled = true }: HookOptions = {},
) {
  const escrow = CONTRACTS.escrow.address;

  return useReadContract({
    address: escrow,
    abi: agentTaskEscrowAbi,
    functionName: "verifyCompleteIntent",
    args: intent && signature ? [intent, signature] : undefined,
    query: {
      enabled: enabled && Boolean(escrow && intent && signature),
      staleTime: 3_000,
    },
  });
}

export function useTaskCompletion() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<TaskCompletionState>(initialState);

  function patchState(next: Partial<TaskCompletionState>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function completeTask(input: CompleteTaskInput) {
    if (!publicClient || !walletClient) {
      throw new Error("钱包或 RPC 客户端还没有准备好。");
    }

    setState({
      step: "simulating",
      message: "正在模拟 completeTask，检查签名、nonce、任务状态和 resultURI。",
    });

    try {
      const simulation = await publicClient.simulateContract({
        account: input.account,
        address: input.escrow,
        abi: agentTaskEscrowAbi,
        functionName: "completeTask",
        args: [input.intent, input.signature, input.resultURI],
      });

      patchState({
        step: "signing",
        message: "请在 operator 钱包里确认 completeTask 交易。",
      });
      const hash = await walletClient.writeContract(simulation.request);

      patchState({
        step: "pending",
        message: "completeTask 已提交，等待链上确认。",
        hash,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      assertSuccessfulReceipt(receipt);

      const events = parseTaskCompletionEvents(receipt);
      setState({
        step: "success",
        message: `任务 ${input.intent.taskId.toString()} 已完成，签名 nonce 已被使用。`,
        hash,
        receipt,
        events,
      });

      return { hash, receipt, events };
    } catch (error) {
      const message = getReadableError(error);
      patchState({
        step: "failed",
        message,
        error: message,
      });
      throw error;
    }
  }

  function reset() {
    setState(initialState);
  }

  return {
    state,
    completeTask,
    reset,
  };
}

function assertSuccessfulReceipt(receipt: TransactionReceipt) {
  if (receipt.status !== "success") {
    throw new Error("completeTask 交易已上链，但执行失败。");
  }
}

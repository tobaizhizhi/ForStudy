"use client";

import { useState } from "react";
import { verifyTypedData, type Address, type Hex } from "viem";
import { useSignTypedData } from "wagmi";

import {
  buildTaskIntentDomain,
  buildTaskIntentMessage,
  taskIntentTypes,
  type TaskIntentMessage,
} from "@/lib/eip712";
import { getReadableError } from "@/lib/errors";

export type TaskIntentStep = "idle" | "signing" | "success" | "failed";

export type SignedTaskIntent = {
  domain: ReturnType<typeof buildTaskIntentDomain>;
  types: typeof taskIntentTypes;
  message: TaskIntentMessage;
  signature: Hex;
  signedAt: bigint;
  locallyVerified: boolean;
};

export type SignTaskIntentInput = {
  escrow: Address;
  client: Address;
  taskId: bigint;
  operator: Address;
  nonce: bigint;
  deadline: bigint;
};

export type TaskIntentState = {
  step: TaskIntentStep;
  message: string;
  signed?: SignedTaskIntent;
  error?: string;
};

const initialState: TaskIntentState = {
  step: "idle",
  message: "选择一个已注资任务后，可以生成 EIP-712 TaskIntent 签名。",
};

export function useTaskIntent() {
  const { signTypedDataAsync, isPending } = useSignTypedData();
  const [state, setState] = useState<TaskIntentState>(initialState);

  async function signTaskIntent(input: SignTaskIntentInput) {
    const domain = buildTaskIntentDomain(input.escrow);
    const message = buildTaskIntentMessage({
      client: input.client,
      taskId: input.taskId,
      operator: input.operator,
      nonce: input.nonce,
      deadline: input.deadline,
    });

    setState({
      step: "signing",
      message: "请在钱包里确认 TaskIntent 签名。这不是交易，不会花 gas。",
    });

    try {
      const signature = await signTypedDataAsync({
        domain,
        types: taskIntentTypes,
        primaryType: "TaskIntent",
        message,
      });
      const locallyVerified = await verifyTypedData({
        address: input.client,
        domain,
        types: taskIntentTypes,
        primaryType: "TaskIntent",
        message,
        signature,
      });
      const signed = {
        domain,
        types: taskIntentTypes,
        message,
        signature,
        signedAt: BigInt(Math.floor(Date.now() / 1000)),
        locallyVerified,
      };

      setState({
        step: "success",
        message: "TaskIntent 已签名。链上状态还没有变化，模块 7 才会提交 completeTask。",
        signed,
      });

      return signed;
    } catch (error) {
      const messageText = getReadableError(error);
      setState({
        step: "failed",
        message: messageText,
        error: messageText,
      });
      throw error;
    }
  }

  function reset() {
    setState(initialState);
  }

  return {
    state,
    isPending,
    signTaskIntent,
    reset,
  };
}

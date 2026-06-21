"use client";

import { useState } from "react";
import { parseEventLogs, type Address, type Hash, type TransactionReceipt } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";

import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";
import { erc20Abi } from "@/abi/erc20";
import { getReadableError } from "@/lib/errors";

export type TaskFundingStep =
  | "idle"
  | "simulatingCreate"
  | "signingCreate"
  | "pendingCreate"
  | "checkingAllowance"
  | "simulatingApprove"
  | "signingApprove"
  | "pendingApprove"
  | "simulatingFund"
  | "signingFund"
  | "pendingFund"
  | "success"
  | "failed";

export type TaskFundingState = {
  step: TaskFundingStep;
  message: string;
  createHash?: Hash;
  approveHash?: Hash;
  fundHash?: Hash;
  taskId?: bigint;
  allowanceBefore?: bigint;
  error?: string;
};

export type TaskFundingInput = {
  account: Address;
  escrow: Address;
  token: Address;
  operator: Address;
  amount: bigint;
  service: string;
  refundAfter: bigint;
};

export type TaskFundingResult = {
  taskId: bigint;
  createHash: Hash;
  approveHash?: Hash;
  fundHash: Hash;
};

const initialState: TaskFundingState = {
  step: "idle",
  message: "填写任务信息后，可以创建并注资。",
};

export function useTaskFunding() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<TaskFundingState>(initialState);

  function patchState(next: Partial<TaskFundingState>) {
    setState((current) => ({ ...current, ...next }));
  }

  async function createAndFundTask(input: TaskFundingInput): Promise<TaskFundingResult> {
    if (!publicClient || !walletClient) {
      throw new Error("钱包或 RPC 客户端还没有准备好。");
    }

    setState({
      step: "simulatingCreate",
      message: "正在模拟 createTask，检查参数和合约状态。",
    });

    try {
      const createSimulation = await publicClient.simulateContract({
        account: input.account,
        address: input.escrow,
        abi: agentTaskEscrowAbi,
        functionName: "createTask",
        args: [input.operator, input.token, input.amount, input.service, input.refundAfter],
      });

      patchState({
        step: "signingCreate",
        message: "请在钱包里确认 createTask 交易。",
      });
      const createHash = await walletClient.writeContract(createSimulation.request);

      patchState({
        step: "pendingCreate",
        message: "createTask 已提交，等待链上确认。",
        createHash,
      });
      const createReceipt = await publicClient.waitForTransactionReceipt({ hash: createHash });
      assertSuccessfulReceipt(createReceipt, "createTask");

      const taskId = getCreatedTaskId(createReceipt) ?? createSimulation.result;
      patchState({
        step: "checkingAllowance",
        message: `任务 ${taskId.toString()} 已创建，正在读取 token 授权额度。`,
        taskId,
      });

      const allowanceBefore = await publicClient.readContract({
        address: input.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [input.account, input.escrow],
      });

      patchState({ allowanceBefore });

      let approveHash: Hash | undefined;
      if (allowanceBefore < input.amount) {
        patchState({
          step: "simulatingApprove",
          message: "当前授权不足，正在模拟 approve。",
        });
        const approveSimulation = await publicClient.simulateContract({
          account: input.account,
          address: input.token,
          abi: erc20Abi,
          functionName: "approve",
          args: [input.escrow, input.amount],
        });

        patchState({
          step: "signingApprove",
          message: "请在钱包里确认 approve 授权交易。",
        });
        approveHash = await walletClient.writeContract(approveSimulation.request);

        patchState({
          step: "pendingApprove",
          message: "approve 已提交，等待链上确认。",
          approveHash,
        });
        const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
        assertSuccessfulReceipt(approveReceipt, "approve");
      }

      patchState({
        step: "simulatingFund",
        message:
          allowanceBefore < input.amount
            ? "授权已确认，正在模拟 fundTask。"
            : "授权额度足够，正在模拟 fundTask。",
      });
      const fundSimulation = await publicClient.simulateContract({
        account: input.account,
        address: input.escrow,
        abi: agentTaskEscrowAbi,
        functionName: "fundTask",
        args: [taskId],
      });

      patchState({
        step: "signingFund",
        message: "请在钱包里确认 fundTask 注资交易。",
      });
      const fundHash = await walletClient.writeContract(fundSimulation.request);

      patchState({
        step: "pendingFund",
        message: "fundTask 已提交，等待链上确认。",
        fundHash,
      });
      const fundReceipt = await publicClient.waitForTransactionReceipt({ hash: fundHash });
      assertSuccessfulReceipt(fundReceipt, "fundTask");

      setState({
        step: "success",
        message: `任务 ${taskId.toString()} 已创建并注资成功。`,
        createHash,
        approveHash,
        fundHash,
        taskId,
        allowanceBefore,
      });

      return { taskId, createHash, approveHash, fundHash };
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
    createAndFundTask,
    reset,
  };
}

function assertSuccessfulReceipt(receipt: TransactionReceipt, action: string) {
  if (receipt.status !== "success") {
    throw new Error(`${action} 交易已上链，但执行失败。`);
  }
}

function getCreatedTaskId(receipt: TransactionReceipt) {
  const logs = parseEventLogs({
    abi: agentTaskEscrowAbi,
    logs: receipt.logs,
    eventName: "TaskCreated",
  });
  const args = logs[0]?.args as { taskId?: bigint } | undefined;

  return args?.taskId;
}

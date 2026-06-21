"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAccount, useChainId } from "wagmi";

import { CONTRACTS } from "@/config/contracts";
import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";
import { useEscrowStatus, useHasPauserRole, useTask } from "@/hooks/useEscrow";
import { useErc20Summary, useNativeBalance } from "@/hooks/useToken";
import {
  formatTaskStatus,
  formatTokenAmount,
  formatUnixTimestamp,
  shortAddress,
} from "@/lib/format";

export function ReadPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const canReadAccount = isConnected && isBaseSepolia;
  const [taskIdInput, setTaskIdInput] = useState("1");
  const taskId = useMemo(() => parseTaskId(taskIdInput), [taskIdInput]);
  const tokenAddress = CONTRACTS.permitToken.address ?? CONTRACTS.usdc.address;
  const nativeBalance = useNativeBalance(address, { enabled: canReadAccount });
  const tokenSummary = useErc20Summary(tokenAddress, address, {
    enabled: isBaseSepolia && Boolean(tokenAddress),
  });
  const escrowStatus = useEscrowStatus({
    enabled: isBaseSepolia && Boolean(CONTRACTS.escrow.address),
  });

  const taskCount = typeof escrowStatus.data?.[0] === "bigint" ? escrowStatus.data[0] : undefined;
  const paused = typeof escrowStatus.data?.[1] === "boolean" ? escrowStatus.data[1] : undefined;
  const pauserRole =
    typeof escrowStatus.data?.[2] === "string" && escrowStatus.data[2].startsWith("0x")
      ? (escrowStatus.data[2] as `0x${string}`)
      : undefined;
  const hasPauserRole = useHasPauserRole(pauserRole, address, {
    enabled: canReadAccount && Boolean(pauserRole),
  });
  const taskDetail = useTask(taskId, {
    enabled:
      isBaseSepolia &&
      Boolean(CONTRACTS.escrow.address && taskId && taskCount && taskId <= taskCount),
  });

  const tokenSymbol = typeof tokenSummary.data?.[0] === "string" ? tokenSummary.data[0] : undefined;
  const tokenDecimals =
    typeof tokenSummary.data?.[1] === "number" ? tokenSummary.data[1] : undefined;
  const tokenBalance = typeof tokenSummary.data?.[2] === "bigint" ? tokenSummary.data[2] : undefined;

  async function refreshAll() {
    await Promise.all([
      nativeBalance.refetch(),
      tokenSummary.refetch(),
      escrowStatus.refetch(),
      hasPauserRole.refetch(),
      taskDetail.refetch(),
    ]);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-300 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
            Module 4
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">wagmi 读链面板</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            使用 `useReadContract` / `useReadContracts` / `useBalance` 读取链上状态。
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={refreshAll}
          disabled={!isBaseSepolia}
        >
          <RefreshCw aria-hidden="true" size={16} />
          手动刷新
        </button>
      </div>

      <GateMessage
        isConnected={isConnected}
        isBaseSepolia={isBaseSepolia}
        hasEscrow={Boolean(CONTRACTS.escrow.address)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="账户余额">
          <Detail label="当前账户">{address ? shortAddress(address) : "-"}</Detail>
          <Detail label="ETH balance">
            {nativeBalance.data ? `${nativeBalance.data.formatted} ${nativeBalance.data.symbol}` : "-"}
          </Detail>
          <Detail label="Token">
            {tokenAddress ? `${tokenSymbol ?? "-"} / ${shortAddress(tokenAddress)}` : "未配置 token 地址"}
          </Detail>
          <Detail label="Token decimals">
            {tokenDecimals === undefined ? "-" : tokenDecimals.toString()}
          </Detail>
          <Detail label="Token balance">
            {tokenBalance !== undefined && tokenDecimals !== undefined
              ? `${formatTokenAmount(tokenBalance, tokenDecimals)} ${tokenSymbol ?? ""}`
              : "-"}
          </Detail>
          <QueryState
            isLoading={nativeBalance.isLoading || tokenSummary.isLoading}
            error={nativeBalance.error ?? tokenSummary.error}
          />
        </Panel>

        <Panel title="Escrow 状态">
          <Detail label="Escrow 地址">
            {CONTRACTS.escrow.address ? shortAddress(CONTRACTS.escrow.address) : "未配置"}
          </Detail>
          <Detail label="taskCount">{taskCount === undefined ? "-" : taskCount.toString()}</Detail>
          <Detail label="paused">{paused === undefined ? "-" : String(paused)}</Detail>
          <Detail label="当前账户 PAUSER_ROLE">
            {typeof hasPauserRole.data === "boolean" ? String(hasPauserRole.data) : "-"}
          </Detail>
          <QueryState
            isLoading={escrowStatus.isLoading || hasPauserRole.isLoading}
            error={escrowStatus.error ?? hasPauserRole.error}
          />
        </Panel>
      </div>

      <Panel title="Task Reader">
        <label className="block max-w-xs">
          <span className="text-sm font-medium text-zinc-700">Task ID</span>
          <input
            className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
            inputMode="numeric"
            pattern="[0-9]+"
            value={taskIdInput}
            onChange={(event) => setTaskIdInput(event.target.value)}
          />
        </label>
        <TaskDetails task={taskDetail.data} tokenDecimals={tokenDecimals} tokenSymbol={tokenSymbol} />
        <QueryState isLoading={taskDetail.isLoading} error={taskDetail.error} />
      </Panel>
    </section>
  );
}

function GateMessage({
  isConnected,
  isBaseSepolia,
  hasEscrow,
}: {
  isConnected: boolean;
  isBaseSepolia: boolean;
  hasEscrow: boolean;
}) {
  if (!isConnected) {
    return <Notice tone="warn">请先连接钱包。账户余额、角色和任务详情会在连接后读取。</Notice>;
  }

  if (!isBaseSepolia) {
    return <Notice tone="warn">当前不是 Base Sepolia。为避免误读，本面板会暂停合约读取。</Notice>;
  }

  if (!hasEscrow) {
    return <Notice tone="warn">还没有配置 escrow 地址，Escrow 和 Task Reader 会保持空状态。</Notice>;
  }

  return <Notice tone="good">网络正确。读链 hook 已启用，数据会缓存并可手动刷新。</Notice>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <div className="mt-4 grid gap-3">{children}</div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</dt>
      <dd className="mt-2 break-words font-mono text-sm text-zinc-900">{children}</dd>
    </div>
  );
}

function Notice({ tone, children }: { tone: "good" | "warn"; children: ReactNode }) {
  const className =
    tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : "border-amber-300 bg-amber-50 text-amber-950";

  return <div className={`rounded-lg border p-4 text-sm leading-6 ${className}`}>{children}</div>;
}

function QueryState({ isLoading, error }: { isLoading: boolean; error: Error | null }) {
  if (isLoading) {
    return <p className="text-sm text-zinc-500">读取中...</p>;
  }

  if (error) {
    return <p className="break-words text-sm leading-6 text-rose-700">{error.message}</p>;
  }

  return null;
}

function TaskDetails({
  task,
  tokenDecimals,
  tokenSymbol,
}: {
  task:
    | readonly [
        `0x${string}`,
        `0x${string}`,
        `0x${string}`,
        bigint,
        string,
        string,
        bigint,
        number,
      ]
    | undefined;
  tokenDecimals: number | undefined;
  tokenSymbol: string | undefined;
}) {
  if (!task) {
    return <p className="text-sm text-zinc-500">输入存在的 taskId 后会显示任务详情。</p>;
  }

  const [client, operator, token, amount, service, resultURI, refundAfter, status] = task;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Detail label="client">{shortAddress(client)}</Detail>
      <Detail label="operator">{shortAddress(operator)}</Detail>
      <Detail label="token">{shortAddress(token)}</Detail>
      <Detail label="amount">
        {tokenDecimals === undefined
          ? amount.toString()
          : `${formatTokenAmount(amount, tokenDecimals)} ${tokenSymbol ?? ""}`}
      </Detail>
      <Detail label="service">{service || "-"}</Detail>
      <Detail label="resultURI">{resultURI || "-"}</Detail>
      <Detail label="refundAfter">{formatUnixTimestamp(refundAfter)}</Detail>
      <Detail label="status">{formatTaskStatus(status)}</Detail>
    </div>
  );
}

function parseTaskId(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const taskId = BigInt(value);
  return taskId > BigInt(0) ? taskId : undefined;
}

"use client";

import { CheckCircle2, CircleDot, Clock3, ExternalLink } from "lucide-react";

import { BASE_SEPOLIA } from "@/config/chains";
import { filterTaskEvents, sortHistoryEvents, type TaskHistoryEvent } from "@/lib/event-history";
import { getExplorerTxUrl } from "@/lib/explorer";
import { formatUnixTimestamp, shortAddress } from "@/lib/format";

export function TaskTimeline({
  events,
  taskId,
}: {
  events: TaskHistoryEvent[];
  taskId: bigint | undefined;
}) {
  if (taskId === undefined) {
    return <p className="text-sm text-zinc-500">输入 taskId 后会显示单个任务时间线。</p>;
  }

  const taskEvents = sortHistoryEvents(filterTaskEvents(events, taskId), "asc");

  if (taskEvents.length === 0) {
    return <p className="text-sm text-zinc-500">还没有查询到 task #{taskId.toString()} 的事件。</p>;
  }

  return (
    <ol className="relative grid gap-3 border-l border-zinc-300 pl-4">
      {taskEvents.map((event) => (
        <li className="relative" key={event.id}>
          <span className="absolute -left-[23px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white">
            {event.kind === "TaskCompleted" ? (
              <CheckCircle2 aria-hidden="true" className="text-emerald-700" size={16} />
            ) : event.kind === "TaskIntentUsed" ? (
              <Clock3 aria-hidden="true" className="text-amber-700" size={16} />
            ) : (
              <CircleDot aria-hidden="true" className="text-zinc-500" size={16} />
            )}
          </span>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {event.kind}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-800">{describeTimelineEvent(event)}</p>
              </div>
              <TxLink hash={event.transactionHash} />
            </div>
            <p className="mt-2 font-mono text-xs text-zinc-500">
              block {event.blockNumber.toString()}
              {event.blockTimestamp ? ` / ${formatUnixTimestamp(event.blockTimestamp)}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function describeTimelineEvent(event: TaskHistoryEvent) {
  if (event.kind === "TaskCreated") {
    return `client ${formatAddress(event.client)} 创建任务，operator ${formatAddress(event.operator)}`;
  }

  if (event.kind === "TaskFunded" || event.kind === "TaskFundedWithPermit") {
    return `注资 raw amount ${event.amount?.toString() ?? "-"}，token ${formatAddress(event.token)}`;
  }

  if (event.kind === "TaskIntentUsed") {
    return `授权被使用，action ${event.action ?? "-"}，nonce ${event.nonce?.toString() ?? "-"}`;
  }

  if (event.kind === "TaskCompleted") {
    return `任务完成，resultURI ${event.resultURI ?? "-"}`;
  }

  if (event.kind === "TaskRefunded") {
    return `退款 raw amount ${event.amount?.toString() ?? "-"} 给 client ${formatAddress(event.client)}`;
  }

  if (event.kind === "TaskCancelled") {
    return `任务被 client ${formatAddress(event.client)} 取消`;
  }

  return "合约级状态变化";
}

function TxLink({ hash }: { hash: `0x${string}` }) {
  const txUrl = getExplorerTxUrl(BASE_SEPOLIA.explorerUrl, hash);

  if (!txUrl) {
    return <span className="font-mono text-xs text-zinc-500">{shortAddress(hash)}</span>;
  }

  return (
    <a
      className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700 underline-offset-4 hover:underline"
      href={txUrl}
      target="_blank"
      rel="noreferrer"
    >
      {shortAddress(hash)}
      <ExternalLink aria-hidden="true" size={13} />
    </a>
  );
}

function formatAddress(address: `0x${string}` | undefined) {
  return address ? shortAddress(address) : "-";
}

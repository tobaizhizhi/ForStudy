"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { TaskTimeline } from "@/components/task-timeline";
import { BASE_SEPOLIA } from "@/config/chains";
import { CONTRACTS } from "@/config/contracts";
import { useEscrowEvents } from "@/hooks/useTaskEvents";
import { sortHistoryEvents, type TaskHistoryEvent } from "@/lib/event-history";
import { getReadableError } from "@/lib/errors";
import {
  getExplorerAddressUrl,
  getExplorerBlockUrl,
  getExplorerTxUrl,
} from "@/lib/explorer";
import { formatUnixTimestamp, shortAddress } from "@/lib/format";

const DEFAULT_RANGE_SIZE = "1000";

export function EventsPanel() {
  const escrow = CONTRACTS.escrow.address;
  const deployBlock = CONTRACTS.escrow.deployBlock;
  const [fromBlockInput, setFromBlockInput] = useState(() => deployBlock?.toString() ?? "");
  const [toBlockInput, setToBlockInput] = useState("");
  const [rangeSizeInput, setRangeSizeInput] = useState(DEFAULT_RANGE_SIZE);
  const [taskIdInput, setTaskIdInput] = useState("1");
  const fromBlock = useMemo(() => parseRequiredBlock(fromBlockInput), [fromBlockInput]);
  const toBlock = useMemo(() => parseOptionalBlock(toBlockInput), [toBlockInput]);
  const rangeSize = useMemo(() => parseRequiredBlock(rangeSizeInput), [rangeSizeInput]);
  const taskId = useMemo(() => parseOptionalTaskId(taskIdInput), [taskIdInput]);
  const validationMessages = useMemo(
    () =>
      validateEventForm({
        escrow,
        fromBlock,
        toBlock,
        rangeSize,
        taskIdInput,
        taskId,
      }),
    [escrow, fromBlock, toBlock, rangeSize, taskIdInput, taskId],
  );
  const eventsQuery = useEscrowEvents({ fromBlock, toBlock, rangeSize });
  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data?.events]);
  const newestEvents = useMemo(() => sortHistoryEvents(events, "desc"), [events]);
  const canRefresh = validationMessages.length === 0 && !eventsQuery.isFetching;

  function handleRefresh(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canRefresh) {
      return;
    }

    void eventsQuery.refetch();
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Module 8
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">事件流、交易历史与任务时间线</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              从 escrow 部署块开始按区间读取 logs，解析任务事件，并把全局事件流和单个任务时间线对齐到 BaseScan。
            </p>
          </div>
          <StatusPill tone={events.length > 0 ? "good" : "warn"}>
            events：{events.length.toString()}
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <form className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm" onSubmit={handleRefresh}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="fromBlock">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
                pattern="[0-9]*"
                value={fromBlockInput}
                onChange={(event) => setFromBlockInput(event.target.value)}
                placeholder="escrow deploy block"
              />
            </Field>
            <Field label="toBlock">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
                pattern="[0-9]*"
                value={toBlockInput}
                onChange={(event) => setToBlockInput(event.target.value)}
                placeholder="留空表示 latest"
              />
            </Field>
            <Field label="rangeSize">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
                pattern="[0-9]*"
                value={rangeSizeInput}
                onChange={(event) => setRangeSizeInput(event.target.value)}
              />
            </Field>
            <Field label="taskId timeline">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
                pattern="[0-9]*"
                value={taskIdInput}
                onChange={(event) => setTaskIdInput(event.target.value)}
                placeholder="可留空"
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Detail label="escrow">{escrow ? <AddressLink address={escrow} /> : "未配置"}</Detail>
            <Detail label="deployBlock">{deployBlock?.toString() ?? "未配置"}</Detail>
            <Detail label="latestBlock">{eventsQuery.data?.latestBlock.toString() ?? "-"}</Detail>
            <Detail label="scanned ranges">{eventsQuery.data?.ranges.length.toString() ?? "-"}</Detail>
          </div>

          {validationMessages.length > 0 ? (
            <Notice tone="warn">{validationMessages[0]}</Notice>
          ) : eventsQuery.error ? (
            <Notice tone="error">{getReadableError(eventsQuery.error)}</Notice>
          ) : events.length === 0 && !eventsQuery.isFetching ? (
            <Notice tone="neutral">点击刷新事件后，会从 fromBlock 按 rangeSize 分页查询历史 logs。</Notice>
          ) : (
            <Notice tone="good">
              已查询 block {eventsQuery.data?.fromBlock.toString() ?? "-"} 到{" "}
              {eventsQuery.data?.toBlock.toString() ?? "-"}。
            </Notice>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canRefresh}
            >
              {eventsQuery.isFetching ? (
                <Loader2 className="animate-spin" aria-hidden="true" size={16} />
              ) : (
                <RefreshCw aria-hidden="true" size={16} />
              )}
              刷新事件
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                setFromBlockInput(deployBlock?.toString() ?? "");
                setToBlockInput("");
                setRangeSizeInput(DEFAULT_RANGE_SIZE);
              }}
              disabled={eventsQuery.isFetching}
            >
              重置区间
            </button>
          </div>
        </form>

        <Panel title="Task Timeline">
          <TaskTimeline events={events} taskId={taskId} />
        </Panel>
      </div>

      <Panel title="Escrow Event Stream">
        <HistoryEventList events={newestEvents} isLoading={eventsQuery.isFetching} />
      </Panel>
    </section>
  );
}

function HistoryEventList({
  events,
  isLoading,
}: {
  events: TaskHistoryEvent[];
  isLoading: boolean;
}) {
  if (isLoading && events.length === 0) {
    return <p className="text-sm text-zinc-500">正在查询事件...</p>;
  }

  if (events.length === 0) {
    return <p className="text-sm text-zinc-500">还没有查询到事件。</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200">
      <div className="divide-y divide-zinc-200">
        {events.map((event) => (
          <EventRow event={event} key={event.id} />
        ))}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: TaskHistoryEvent }) {
  return (
    <article className="bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-medium text-zinc-800">
              {event.kind}
            </span>
            {event.taskId !== undefined ? (
              <span className="font-mono text-xs text-zinc-500">task #{event.taskId.toString()}</span>
            ) : (
              <span className="font-mono text-xs text-zinc-500">contract event</span>
            )}
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-800">{describeEvent(event)}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 font-mono text-xs text-zinc-500">
            <BlockLink blockNumber={event.blockNumber} />
            <span>txIndex {event.transactionIndex}</span>
            <span>logIndex {event.logIndex}</span>
            {event.blockTimestamp ? <span>{formatUnixTimestamp(event.blockTimestamp)}</span> : null}
          </div>
        </div>
        <TxLink hash={event.transactionHash} />
      </div>
    </article>
  );
}

function describeEvent(event: TaskHistoryEvent) {
  if (event.kind === "TaskCreated") {
    return (
      <>
        client <AddressLink address={event.client} /> 创建任务，operator{" "}
        <AddressLink address={event.operator} />，token <AddressLink address={event.token} />，raw amount{" "}
        {event.amount?.toString() ?? "-"}，service {event.service ?? "-"}
      </>
    );
  }

  if (event.kind === "TaskFunded" || event.kind === "TaskFundedWithPermit") {
    return (
      <>
        client <AddressLink address={event.client} /> 注资 raw amount {event.amount?.toString() ?? "-"}，
        token <AddressLink address={event.token} />
      </>
    );
  }

  if (event.kind === "TaskIntentUsed") {
    return (
      <>
        client <AddressLink address={event.client} /> 的授权被 operator{" "}
        <AddressLink address={event.operator} /> 使用，action {event.action ?? "-"}，nonce{" "}
        {event.nonce?.toString() ?? "-"}
      </>
    );
  }

  if (event.kind === "TaskCompleted") {
    return (
      <>
        task 完成，client <AddressLink address={event.client} />，operator{" "}
        <AddressLink address={event.operator} />，resultURI {event.resultURI ?? "-"}
      </>
    );
  }

  if (event.kind === "TaskRefunded") {
    return (
      <>
        client <AddressLink address={event.client} /> 退款 raw amount {event.amount?.toString() ?? "-"}，
        token <AddressLink address={event.token} />
      </>
    );
  }

  if (event.kind === "TaskCancelled") {
    return (
      <>
        client <AddressLink address={event.client} /> 取消任务
      </>
    );
  }

  return (
    <>
      account <AddressLink address={event.account} /> 触发合约级事件
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <div className="mt-4">{children}</div>
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

function StatusPill({ tone, children }: { tone: "good" | "warn"; children: ReactNode }) {
  const className =
    tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : "border-amber-300 bg-amber-50 text-amber-950";

  return (
    <div className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium ${className}`}>
      {children}
    </div>
  );
}

function Notice({ tone, children }: { tone: "good" | "warn" | "error" | "neutral"; children: ReactNode }) {
  const className =
    tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : tone === "error"
        ? "border-rose-300 bg-rose-50 text-rose-950"
        : tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-zinc-300 bg-zinc-50 text-zinc-700";

  return <div className={`mt-5 rounded-md border p-4 text-sm leading-6 ${className}`}>{children}</div>;
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

function BlockLink({ blockNumber }: { blockNumber: bigint }) {
  const blockUrl = getExplorerBlockUrl(BASE_SEPOLIA.explorerUrl, blockNumber);

  if (!blockUrl) {
    return <span>block {blockNumber.toString()}</span>;
  }

  return (
    <a
      className="inline-flex items-center gap-1 text-emerald-700 underline-offset-4 hover:underline"
      href={blockUrl}
      target="_blank"
      rel="noreferrer"
    >
      block {blockNumber.toString()}
      <ExternalLink aria-hidden="true" size={13} />
    </a>
  );
}

function AddressLink({ address }: { address: `0x${string}` | undefined }) {
  if (!address) {
    return <span>-</span>;
  }

  const addressUrl = getExplorerAddressUrl(BASE_SEPOLIA.explorerUrl, address);

  if (!addressUrl) {
    return <span>{shortAddress(address)}</span>;
  }

  return (
    <a
      className="inline-flex items-center gap-1 text-emerald-700 underline-offset-4 hover:underline"
      href={addressUrl}
      target="_blank"
      rel="noreferrer"
    >
      {shortAddress(address)}
      <ExternalLink aria-hidden="true" size={13} />
    </a>
  );
}

function validateEventForm({
  escrow,
  fromBlock,
  toBlock,
  rangeSize,
  taskIdInput,
  taskId,
}: {
  escrow: `0x${string}` | undefined;
  fromBlock: bigint | undefined;
  toBlock: bigint | undefined;
  rangeSize: bigint | undefined;
  taskIdInput: string;
  taskId: bigint | undefined;
}) {
  const messages: string[] = [];

  if (!escrow) {
    messages.push("缺少 escrow 合约地址。");
  }

  if (fromBlock === undefined) {
    messages.push("fromBlock 必须是大于等于 0 的整数。");
  }

  if (rangeSize === undefined || rangeSize <= BigInt(0)) {
    messages.push("rangeSize 必须是大于 0 的整数。");
  }

  if (fromBlock !== undefined && toBlock !== undefined && fromBlock > toBlock) {
    messages.push("fromBlock 不能大于 toBlock。");
  }

  if (taskIdInput.trim() && taskId === undefined) {
    messages.push("taskId 必须是大于 0 的整数，或者留空。");
  }

  return messages;
}

function parseRequiredBlock(value: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }

  return BigInt(trimmed);
}

function parseOptionalBlock(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  return parseRequiredBlock(value);
}

function parseOptionalTaskId(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const block = parseRequiredBlock(value);
  return block !== undefined && block > BigInt(0) ? block : undefined;
}

"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CheckCircle2, Copy, FileSignature, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { isAddressEqual, zeroAddress, type Address } from "viem";
import { useAccount, useChainId } from "wagmi";

import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";
import { CONTRACTS } from "@/config/contracts";
import { useClientNonce, useEscrowStatus, useTask } from "@/hooks/useEscrow";
import { useHydrated } from "@/hooks/useHydrated";
import { useTaskIntent, type SignedTaskIntent } from "@/hooks/useTaskIntent";
import { formatTaskStatus, formatUnixTimestamp, shortAddress } from "@/lib/format";

const FUNDED_STATUS = 1;

type EscrowTask = readonly [
  Address,
  Address,
  Address,
  bigint,
  string,
  string,
  bigint,
  number,
];

export function IntentPanel({ onSigned }: { onSigned?: (signed: SignedTaskIntent) => void }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const canUseWallet = isConnected && isBaseSepolia;
  const escrow = CONTRACTS.escrow.address;
  const hydrated = useHydrated();
  const [taskIdInput, setTaskIdInput] = useState("1");
  const [deadlineInput, setDeadlineInput] = useState<string | undefined>();
  const [copyStatus, setCopyStatus] = useState("");
  const hydratedDeadlineInput = useMemo(
    () => (hydrated ? toDatetimeLocal(defaultDeadline()) : ""),
    [hydrated],
  );
  const effectiveDeadlineInput = deadlineInput ?? hydratedDeadlineInput;
  const taskId = useMemo(() => parseTaskId(taskIdInput), [taskIdInput]);
  const deadline = useMemo(() => parseDeadline(effectiveDeadlineInput), [effectiveDeadlineInput]);
  const escrowStatus = useEscrowStatus({
    enabled: isBaseSepolia && Boolean(escrow),
  });
  const taskCount = typeof escrowStatus.data?.[0] === "bigint" ? escrowStatus.data[0] : undefined;
  const taskDetail = useTask(taskId, {
    enabled: isBaseSepolia && Boolean(escrow && taskId),
  });
  const task = isTaskTuple(taskDetail.data) ? taskDetail.data : undefined;
  const nonce = useClientNonce(address, {
    enabled: canUseWallet && Boolean(escrow && address),
  });
  const intent = useTaskIntent();
  const validationMessages = useMemo(
    () =>
      validateIntentForm({
        isConnected,
        isBaseSepolia,
        account: address,
        escrow,
        taskId,
        taskCount,
        task,
        nonce: nonce.data,
        deadline,
      }),
    [isConnected, isBaseSepolia, address, escrow, taskId, taskCount, task, nonce.data, deadline],
  );
  const canSign =
    validationMessages.length === 0 &&
    address !== undefined &&
    escrow !== undefined &&
    taskId !== undefined &&
    task !== undefined &&
    nonce.data !== undefined &&
    deadline !== undefined &&
    !intent.isPending;

  async function handleSign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !canSign ||
      !address ||
      !escrow ||
      taskId === undefined ||
      task === undefined ||
      nonce.data === undefined ||
      deadline === undefined
    ) {
      return;
    }

    try {
      const signed = await intent.signTaskIntent({
        escrow,
        client: address,
        taskId,
        operator: task[1],
        nonce: nonce.data,
        deadline,
      });
      setCopyStatus("");
      onSigned?.(signed);
    } catch {
      // The hook already stores a readable error for the UI.
    }
  }

  async function copySignature() {
    const signature = intent.state.signed?.signature;

    if (!signature) {
      return;
    }

    await navigator.clipboard.writeText(signature);
    setCopyStatus("已复制");
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Module 6
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">EIP-712 TaskIntent 签名</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              当前模块只生成签名。签名不是交易，不会产生 tx hash，也不会改变链上任务状态。
            </p>
          </div>
          <StatusPill tone={canUseWallet ? "good" : "warn"}>
            签名：{canUseWallet ? "允许" : "禁止"}
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <form className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm" onSubmit={handleSign}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="taskId">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                inputMode="numeric"
                pattern="[0-9]+"
                value={taskIdInput}
                onChange={(event) => setTaskIdInput(event.target.value)}
              />
            </Field>

            <Field label="signature deadline">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                type="datetime-local"
                value={effectiveDeadlineInput}
                onChange={(event) => setDeadlineInput(event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Detail label="client">{address ? shortAddress(address) : "-"}</Detail>
            <Detail label="escrow">{escrow ? shortAddress(escrow) : "未配置"}</Detail>
            <Detail label="nonce">{nonce.data === undefined ? "-" : nonce.data.toString()}</Detail>
            <Detail label="action">complete</Detail>
            <Detail label="chainId">{BASE_SEPOLIA_CHAIN_ID.toString()}</Detail>
            <Detail label="deadline">
              {deadline === undefined
                ? "-"
                : `${formatUnixTimestamp(deadline)} / ${deadline.toString()}`}
            </Detail>
          </div>

          {validationMessages.length > 0 ? (
            <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {validationMessages[0]}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              这份签名允许任务 operator 在 deadline 前提交 completeTask。
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canSign}
            >
              {intent.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" size={16} />
              ) : (
                <FileSignature aria-hidden="true" size={16} />
              )}
              签署 TaskIntent
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={intent.reset}
              disabled={intent.isPending}
            >
              <RotateCcw aria-hidden="true" size={16} />
              重置签名
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <Panel title="任务摘要">
            <TaskSummary task={task} taskCount={taskCount} taskId={taskId} />
            <QueryState
              isLoading={escrowStatus.isLoading || taskDetail.isLoading || nonce.isLoading}
              error={escrowStatus.error ?? taskDetail.error ?? nonce.error}
            />
          </Panel>

          <Panel title="签名结果">
            <div className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              {intent.state.step === "success" ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" size={18} />
              ) : intent.isPending ? (
                <Loader2 className="mt-0.5 shrink-0 animate-spin text-emerald-700" aria-hidden="true" size={18} />
              ) : (
                <ShieldCheck className="mt-0.5 shrink-0 text-zinc-500" aria-hidden="true" size={18} />
              )}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {intent.state.step}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{intent.state.message}</p>
              </div>
            </div>

            <Detail label="local verify">
              {intent.state.signed === undefined ? "-" : String(intent.state.signed.locallyVerified)}
            </Detail>
            <Detail label="signedAt">
              {intent.state.signed === undefined
                ? "-"
                : formatUnixTimestamp(intent.state.signed.signedAt)}
            </Detail>
            <Detail label="signature">
              {intent.state.signed?.signature ? (
                <div className="grid gap-2">
                  <span>{intent.state.signed.signature}</span>
                  <button
                    className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:border-emerald-700 hover:text-emerald-800"
                    type="button"
                    onClick={copySignature}
                  >
                    <Copy aria-hidden="true" size={15} />
                    复制签名{copyStatus ? `：${copyStatus}` : ""}
                  </button>
                </div>
              ) : (
                "-"
              )}
            </Detail>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function TaskSummary({
  task,
  taskCount,
  taskId,
}: {
  task: EscrowTask | undefined;
  taskCount: bigint | undefined;
  taskId: bigint | undefined;
}) {
  if (taskId === undefined) {
    return <p className="text-sm text-zinc-500">输入 taskId 后会读取任务摘要。</p>;
  }

  if (taskCount !== undefined && taskId > taskCount) {
    return <p className="text-sm text-zinc-500">当前 taskId 大于 taskCount。</p>;
  }

  if (!task) {
    return <p className="text-sm text-zinc-500">任务读取中或不存在。</p>;
  }

  const [client, operator, token, amount, service, resultURI, refundAfter, status] = task;

  return (
    <div className="grid gap-3">
      <Detail label="client">{shortAddress(client)}</Detail>
      <Detail label="operator">{shortAddress(operator)}</Detail>
      <Detail label="token">{shortAddress(token)}</Detail>
      <Detail label="raw amount">{amount.toString()}</Detail>
      <Detail label="service">{service || "-"}</Detail>
      <Detail label="resultURI">{resultURI || "-"}</Detail>
      <Detail label="refundAfter">{formatUnixTimestamp(refundAfter)}</Detail>
      <Detail label="status">{formatTaskStatus(status)}</Detail>
    </div>
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

function QueryState({ isLoading, error }: { isLoading: boolean; error: Error | null }) {
  if (isLoading) {
    return <p className="text-sm text-zinc-500">读取中...</p>;
  }

  if (error) {
    return <p className="break-words text-sm leading-6 text-rose-700">{error.message}</p>;
  }

  return null;
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

function validateIntentForm({
  isConnected,
  isBaseSepolia,
  account,
  escrow,
  taskId,
  taskCount,
  task,
  nonce,
  deadline,
}: {
  isConnected: boolean;
  isBaseSepolia: boolean;
  account: Address | undefined;
  escrow: Address | undefined;
  taskId: bigint | undefined;
  taskCount: bigint | undefined;
  task: EscrowTask | undefined;
  nonce: bigint | undefined;
  deadline: bigint | undefined;
}) {
  const messages: string[] = [];

  if (!isConnected || !account) {
    messages.push("请先连接钱包。");
  }

  if (!isBaseSepolia) {
    messages.push("请先切换到 Base Sepolia。");
  }

  if (!escrow) {
    messages.push("缺少 escrow 合约地址。");
  }

  if (taskId === undefined) {
    messages.push("taskId 必须是大于 0 的整数。");
  } else if (taskCount !== undefined && taskId > taskCount) {
    messages.push("taskId 大于当前 taskCount。");
  }

  if (!task) {
    messages.push("还没有读取到任务详情。");
  } else {
    const [client, operator, , , , , , status] = task;

    if (client === zeroAddress) {
      messages.push("任务不存在或 client 是零地址。");
    } else if (account && !isAddressEqual(client, account)) {
      messages.push("当前钱包不是 task.client，不能签 client 授权。");
    }

    if (operator === zeroAddress) {
      messages.push("task.operator 是零地址，不能签名。");
    }

    if (status !== FUNDED_STATUS) {
      messages.push(`任务状态是 ${formatTaskStatus(status)}，只有 Funded 才能签 complete 意图。`);
    }
  }

  if (nonce === undefined) {
    messages.push("还没有读取到 client nonce。");
  }

  if (deadline === undefined) {
    messages.push("signature deadline 无效。");
  } else if (deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    messages.push("signature deadline 必须晚于当前时间。");
  }

  return messages;
}

function isTaskTuple(value: unknown): value is EscrowTask {
  return (
    Array.isArray(value) &&
    value.length === 8 &&
    typeof value[0] === "string" &&
    typeof value[1] === "string" &&
    typeof value[2] === "string" &&
    typeof value[3] === "bigint" &&
    typeof value[4] === "string" &&
    typeof value[5] === "string" &&
    typeof value[6] === "bigint" &&
    typeof value[7] === "number"
  );
}

function parseTaskId(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }

  const taskId = BigInt(value);
  return taskId > BigInt(0) ? taskId : undefined;
}

function parseDeadline(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return BigInt(Math.floor(timestamp / 1000));
}

function defaultDeadline() {
  return BigInt(Math.floor(Date.now() / 1000) + 10 * 60);
}

function toDatetimeLocal(timestamp: bigint) {
  const date = new Date(Number(timestamp) * 1000);
  date.setSeconds(0, 0);

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

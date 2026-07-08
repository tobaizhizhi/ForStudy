"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RotateCcw, SendHorizontal } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { isAddressEqual, type Address } from "viem";
import { useAccount, useChainId } from "wagmi";

import { BASE_SEPOLIA, BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";
import { CONTRACTS } from "@/config/contracts";
import { useClientNonce, useTask } from "@/hooks/useEscrow";
import { useTaskCompletion, useVerifyCompleteIntent } from "@/hooks/useTaskCompletion";
import type { SignedTaskIntent } from "@/hooks/useTaskIntent";
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

export function CompletionPanel({ signedIntent }: { signedIntent: SignedTaskIntent | undefined }) {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const escrow = CONTRACTS.escrow.address;
  const completion = useTaskCompletion();
  const intent = signedIntent?.message;
  const signature = signedIntent?.signature;
  const [resultURI, setResultURI] = useState(() => "demo-result://task-1");
  const taskDetail = useTask(intent?.taskId, {
    enabled: isBaseSepolia && Boolean(escrow && intent?.taskId),
  });
  const task = isTaskTuple(taskDetail.data) ? taskDetail.data : undefined;
  const currentNonce = useClientNonce(intent?.client, {
    enabled: isBaseSepolia && Boolean(escrow && intent?.client),
  });
  const verify = useVerifyCompleteIntent(intent, signature, {
    enabled: isBaseSepolia && Boolean(escrow && intent && signature),
  });
  const validationMessages = useMemo(
    () =>
      validateCompletionForm({
        isConnected,
        isBaseSepolia,
        account: address,
        escrow,
        signedIntent,
        task,
        currentNonce: currentNonce.data,
        resultURI,
        verifyResult: verify.data,
      }),
    [
      isConnected,
      isBaseSepolia,
      address,
      escrow,
      signedIntent,
      task,
      currentNonce.data,
      resultURI,
      verify.data,
    ],
  );
  const isBusy = !["idle", "success", "failed"].includes(completion.state.step);
  const canSubmit =
    validationMessages.length === 0 &&
    address !== undefined &&
    escrow !== undefined &&
    intent !== undefined &&
    signature !== undefined &&
    !isBusy;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit || !address || !escrow || !intent || !signature) {
      return;
    }

    try {
      await completion.completeTask({
        account: address,
        escrow,
        intent,
        signature,
        resultURI: resultURI.trim(),
      });
      await Promise.all([taskDetail.refetch(), currentNonce.refetch(), verify.refetch()]);
      await queryClient.invalidateQueries();
    } catch {
      // The hook already stores a readable error for the UI.
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Module 7
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">提交签名并完成任务</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              当前模块由 operator 提交模块 6 的 TaskIntent 签名。这里是写链交易，会花 gas，
              成功后任务会进入 Completed。
            </p>
          </div>
          <StatusPill tone={canSubmit ? "good" : "warn"}>
            completeTask：{canSubmit ? "允许" : "禁止"}
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
        <form className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
          <Field label="resultURI">
            <input
              className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              value={resultURI}
              onChange={(event) => setResultURI(event.target.value)}
              placeholder="demo-result://task-1"
            />
          </Field>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Detail label="当前钱包">{address ? shortAddress(address) : "-"}</Detail>
            <Detail label="escrow">{escrow ? shortAddress(escrow) : "未配置"}</Detail>
            <Detail label="verifyCompleteIntent">
              {verify.data === undefined ? "-" : String(verify.data)}
            </Detail>
            <Detail label="current nonce">
              {currentNonce.data === undefined ? "-" : currentNonce.data.toString()}
            </Detail>
          </div>

          {validationMessages.length > 0 ? (
            <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {validationMessages[0]}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              预检查通过。提交后会消耗 nonce，并把任务资金转给 operator。
            </div>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canSubmit}
            >
              {isBusy ? (
                <Loader2 className="animate-spin" aria-hidden="true" size={16} />
              ) : (
                <SendHorizontal aria-hidden="true" size={16} />
              )}
              提交 completeTask
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={completion.reset}
              disabled={isBusy}
            >
              <RotateCcw aria-hidden="true" size={16} />
              重置状态
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <Panel title="签名包摘要">
            <IntentSummary signedIntent={signedIntent} />
            <QueryState
              isLoading={taskDetail.isLoading || currentNonce.isLoading || verify.isLoading}
              error={taskDetail.error ?? currentNonce.error ?? verify.error}
            />
          </Panel>

          <Panel title="任务完成状态">
            <div className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              {completion.state.step === "success" ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" size={18} />
              ) : isBusy ? (
                <Loader2 className="mt-0.5 shrink-0 animate-spin text-emerald-700" aria-hidden="true" size={18} />
              ) : null}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {completion.state.step}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{completion.state.message}</p>
              </div>
            </div>

            <TxDetail label="completeTask tx" hash={completion.state.hash} />
            <Detail label="receipt status">{completion.state.receipt?.status ?? "-"}</Detail>
            <Detail label="block number">
              {completion.state.receipt?.blockNumber?.toString() ?? "-"}
            </Detail>
            <Detail label="gas used">{completion.state.receipt?.gasUsed?.toString() ?? "-"}</Detail>
            <CompletionEvents events={completion.state.events} />
          </Panel>
        </div>
      </div>
    </section>
  );
}

function IntentSummary({ signedIntent }: { signedIntent: SignedTaskIntent | undefined }) {
  if (!signedIntent) {
    return <p className="text-sm text-zinc-500">先在模块 6 签署 TaskIntent。</p>;
  }

  const { message, signature, locallyVerified } = signedIntent;

  return (
    <div className="grid gap-3">
      <Detail label="client">{shortAddress(message.client)}</Detail>
      <Detail label="taskId">{message.taskId.toString()}</Detail>
      <Detail label="operator">{shortAddress(message.operator)}</Detail>
      <Detail label="action">{message.action}</Detail>
      <Detail label="nonce">{message.nonce.toString()}</Detail>
      <Detail label="deadline">
        {formatUnixTimestamp(message.deadline)} / {message.deadline.toString()}
      </Detail>
      <Detail label="local verify">{String(locallyVerified)}</Detail>
      <Detail label="signature">{signature}</Detail>
    </div>
  );
}

function CompletionEvents({ events }: { events: ReturnType<typeof useTaskCompletion>["state"]["events"] }) {
  if (!events) {
    return null;
  }

  return (
    <>
      <Detail label="TaskIntentUsed">
        {events.taskIntentUsed
          ? `${shortAddress(events.taskIntentUsed.client)} / task ${events.taskIntentUsed.taskId.toString()} / nonce ${events.taskIntentUsed.nonce.toString()}`
          : "-"}
      </Detail>
      <Detail label="TaskCompleted">
        {events.taskCompleted
          ? `task ${events.taskCompleted.taskId.toString()} / ${events.taskCompleted.resultURI}`
          : "-"}
      </Detail>
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

function TxDetail({ label, hash }: { label: string; hash: `0x${string}` | undefined }) {
  if (!hash) {
    return <Detail label={label}>-</Detail>;
  }

  return (
    <Detail label={label}>
      <a
        className="inline-flex items-center gap-1 text-emerald-700 underline-offset-4 hover:underline"
        href={`${BASE_SEPOLIA.explorerUrl}/tx/${hash}`}
        target="_blank"
        rel="noreferrer"
      >
        {shortAddress(hash)}
        <ExternalLink aria-hidden="true" size={14} />
      </a>
    </Detail>
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

function validateCompletionForm({
  isConnected,
  isBaseSepolia,
  account,
  escrow,
  signedIntent,
  task,
  currentNonce,
  resultURI,
  verifyResult,
}: {
  isConnected: boolean;
  isBaseSepolia: boolean;
  account: Address | undefined;
  escrow: Address | undefined;
  signedIntent: SignedTaskIntent | undefined;
  task: EscrowTask | undefined;
  currentNonce: bigint | undefined;
  resultURI: string;
  verifyResult: boolean | undefined;
}) {
  const messages: string[] = [];

  if (!isConnected || !account) {
    messages.push("请先连接 operator 钱包。");
  }

  if (!isBaseSepolia) {
    messages.push("请先切换到 Base Sepolia。");
  }

  if (!escrow) {
    messages.push("缺少 escrow 合约地址。");
  }

  if (!signedIntent) {
    messages.push("还没有模块 6 的 TaskIntent 签名。");
  }

  if (!resultURI.trim()) {
    messages.push("resultURI 不能为空。");
  }

  if (signedIntent && currentNonce !== undefined && signedIntent.message.nonce !== currentNonce) {
    messages.push("nonce 已变化，这份签名可能已经使用过，请重新签名。");
  }

  if (signedIntent && signedIntent.message.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    messages.push("签名已过期，请回模块 6 重新签名。");
  }

  if (!task) {
    messages.push("还没有读取到任务详情。");
  } else if (signedIntent) {
    const [client, operator, , , , , , status] = task;

    if (!isAddressEqual(client, signedIntent.message.client)) {
      messages.push("intent.client 和链上 task.client 不一致。");
    }

    if (!isAddressEqual(operator, signedIntent.message.operator)) {
      messages.push("intent.operator 和链上 task.operator 不一致。");
    }

    if (account && !isAddressEqual(account, operator)) {
      messages.push("当前钱包不是 task.operator，不能提交 completeTask。");
    }

    if (status !== FUNDED_STATUS) {
      messages.push(`任务状态是 ${formatTaskStatus(status)}，只有 Funded 才能 complete。`);
    }
  }

  if (verifyResult === false) {
    messages.push("verifyCompleteIntent 返回 false，请检查签名、nonce、deadline 和任务状态。");
  }

  if (verifyResult === undefined) {
    messages.push("还没有完成 verifyCompleteIntent 预检查。");
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

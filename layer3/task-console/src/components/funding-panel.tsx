"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RotateCcw, Send, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress, parseUnits, zeroAddress, type Address, type Hash } from "viem";
import { useAccount, useChainId } from "wagmi";

import { BASE_SEPOLIA, BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";
import { CONTRACTS } from "@/config/contracts";
import { useHydrated } from "@/hooks/useHydrated";
import { useTaskFunding } from "@/hooks/useTaskFunding";
import { useErc20Summary, useNativeBalance, useTokenAllowance } from "@/hooks/useToken";
import { formatTokenAmount, shortAddress } from "@/lib/format";

export function FundingPanel() {
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const isBaseSepolia = chainId === BASE_SEPOLIA_CHAIN_ID;
  const canWrite = isConnected && isBaseSepolia;
  const escrow = CONTRACTS.escrow.address;
  const defaultToken = CONTRACTS.permitToken.address ?? CONTRACTS.usdc.address ?? "";
  const hydrated = useHydrated();
  const [operatorInput, setOperatorInput] = useState("");
  const [tokenInput, setTokenInput] = useState(defaultToken);
  const [amountInput, setAmountInput] = useState("1");
  const [serviceInput, setServiceInput] = useState("research-summary");
  const [refundAfterInput, setRefundAfterInput] = useState<string | undefined>();
  const funding = useTaskFunding();
  const hydratedRefundAfterInput = useMemo(
    () => (hydrated ? getDefaultRefundAfterInput() : ""),
    [hydrated],
  );
  const effectiveRefundAfterInput = refundAfterInput ?? hydratedRefundAfterInput;

  const operator = useMemo(() => parseAddress(operatorInput), [operatorInput]);
  const token = useMemo(() => parseAddress(tokenInput), [tokenInput]);
  const nativeBalance = useNativeBalance(address, { enabled: canWrite });
  const tokenSummary = useErc20Summary(token, address, {
    enabled: isBaseSepolia && Boolean(token),
  });
  const allowance = useTokenAllowance(token, address, escrow, {
    enabled: canWrite && Boolean(token && escrow),
  });

  const tokenSymbol = typeof tokenSummary.data?.[0] === "string" ? tokenSummary.data[0] : undefined;
  const tokenDecimals =
    typeof tokenSummary.data?.[1] === "number" ? tokenSummary.data[1] : undefined;
  const tokenBalance = typeof tokenSummary.data?.[2] === "bigint" ? tokenSummary.data[2] : undefined;
  const amount = useMemo(
    () => parseTokenAmount(amountInput, tokenDecimals),
    [amountInput, tokenDecimals],
  );
  const refundAfter = useMemo(
    () => parseRefundAfter(effectiveRefundAfterInput),
    [effectiveRefundAfterInput],
  );

  const validationMessages = useMemo(
    () =>
      validateFundingForm({
        isConnected,
        isBaseSepolia,
        account: address,
        escrow,
        operator,
        token,
        amount,
        amountInput,
        tokenBalance,
        tokenDecimals,
        service: serviceInput,
        refundAfter,
      }),
    [
      isConnected,
      isBaseSepolia,
      address,
      escrow,
      operator,
      token,
      amount,
      amountInput,
      tokenBalance,
      tokenDecimals,
      serviceInput,
      refundAfter,
    ],
  );
  const needsApprove =
    amount.value !== undefined && allowance.data !== undefined
      ? allowance.data < amount.value
      : undefined;
  const isBusy = isFundingBusy(funding.state.step);
  const canSubmit =
    validationMessages.length === 0 &&
    address !== undefined &&
    escrow !== undefined &&
    operator !== undefined &&
    token !== undefined &&
    amount.value !== undefined &&
    refundAfter !== undefined &&
    !isBusy;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !canSubmit ||
      address === undefined ||
      escrow === undefined ||
      operator === undefined ||
      token === undefined ||
      amount.value === undefined ||
      refundAfter === undefined
    ) {
      return;
    }

    await funding.createAndFundTask({
      account: address,
      escrow,
      token,
      operator,
      amount: amount.value,
      service: serviceInput.trim(),
      refundAfter,
    });
    await Promise.all([allowance.refetch(), tokenSummary.refetch(), nativeBalance.refetch()]);
    await queryClient.invalidateQueries();
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Module 5
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">ERC-20 授权与任务注资</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
              当前实现普通 ERC-20 路线：createTask，必要时 approve，然后 fundTask。
            </p>
          </div>
          <StatusPill tone={canWrite ? "good" : "warn"}>
            写链：{canWrite ? "允许" : "禁止"}
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <form className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <Field label="operator 地址">
              <div className="flex gap-2">
                <input
                  className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  value={operatorInput}
                  onChange={(event) => {
                    setOperatorInput(event.target.value);
                  }}
                  placeholder="0x..."
                  spellCheck={false}
                />
                <button
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-zinc-700 transition hover:border-emerald-700 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  title="填入当前钱包地址"
                  onClick={() => {
                    if (address) {
                      setOperatorInput(address);
                    }
                  }}
                  disabled={!address}
                >
                  <UserRound aria-hidden="true" size={16} />
                </button>
              </div>
            </Field>

            <Field label="token 地址">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                value={tokenInput}
                onChange={(event) => setTokenInput(event.target.value)}
                placeholder="0x..."
                spellCheck={false}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="金额">
                <input
                  className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  inputMode="decimal"
                  placeholder="1"
                />
              </Field>

              <Field label="refundAfter">
                <input
                  className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                  value={effectiveRefundAfterInput}
                  onChange={(event) => setRefundAfterInput(event.target.value)}
                  type="datetime-local"
                />
              </Field>
            </div>

            <Field label="service">
              <input
                className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                value={serviceInput}
                onChange={(event) => setServiceInput(event.target.value)}
                placeholder="research-summary"
              />
            </Field>
          </div>

          {validationMessages.length > 0 ? (
            <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {validationMessages[0]}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canSubmit}
            >
              {isBusy ? <Loader2 className="animate-spin" aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
              创建并注资
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={funding.reset}
              disabled={isBusy}
            >
              <RotateCcw aria-hidden="true" size={16} />
              重置状态
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <Panel title="交易预览">
            <Detail label="account">{address ? shortAddress(address) : "-"}</Detail>
            <Detail label="escrow">{escrow ? shortAddress(escrow) : "未配置"}</Detail>
            <Detail label="token">
              {token ? `${tokenSymbol ?? "-"} / ${shortAddress(token)}` : "未配置"}
            </Detail>
            <Detail label="token balance">
              {tokenBalance !== undefined && tokenDecimals !== undefined
                ? `${formatTokenAmount(tokenBalance, tokenDecimals)} ${tokenSymbol ?? ""}`
                : "-"}
            </Detail>
            <Detail label="allowance">
              {allowance.data !== undefined && tokenDecimals !== undefined
                ? `${formatTokenAmount(allowance.data, tokenDecimals)} ${tokenSymbol ?? ""}`
                : "-"}
            </Detail>
            <Detail label="raw amount">{amount.value?.toString() ?? "-"}</Detail>
            <Detail label="需要 approve">
              {needsApprove === undefined ? "-" : needsApprove ? "是" : "否"}
            </Detail>
          </Panel>

          <Panel title="写链状态">
            <div className="flex gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              {funding.state.step === "success" ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" size={18} />
              ) : isBusy ? (
                <Loader2 className="mt-0.5 shrink-0 animate-spin text-emerald-700" aria-hidden="true" size={18} />
              ) : null}
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  {funding.state.step}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{funding.state.message}</p>
              </div>
            </div>
            <TxDetail label="createTask tx" hash={funding.state.createHash} />
            <TxDetail label="approve tx" hash={funding.state.approveHash} />
            <TxDetail label="fundTask tx" hash={funding.state.fundHash} />
            <Detail label="created taskId">
              {funding.state.taskId === undefined ? "-" : funding.state.taskId.toString()}
            </Detail>
          </Panel>
        </div>
      </div>
    </section>
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

function TxDetail({ label, hash }: { label: string; hash: Hash | undefined }) {
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

function parseAddress(value: string): Address | undefined {
  const trimmed = value.trim();

  if (!isAddress(trimmed)) {
    return undefined;
  }

  return trimmed;
}

function parseTokenAmount(value: string, decimals: number | undefined) {
  const trimmed = value.trim();

  if (!trimmed || decimals === undefined) {
    return { value: undefined, error: undefined };
  }

  try {
    return { value: parseUnits(trimmed, decimals), error: undefined };
  } catch {
    return { value: undefined, error: "金额格式不正确。" };
  }
}

function parseRefundAfter(value: string) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return BigInt(Math.floor(timestamp / 1000));
}

function getDefaultRefundAfterInput() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setSeconds(0, 0);

  const timezoneOffset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function validateFundingForm({
  isConnected,
  isBaseSepolia,
  account,
  escrow,
  operator,
  token,
  amount,
  amountInput,
  tokenBalance,
  tokenDecimals,
  service,
  refundAfter,
}: {
  isConnected: boolean;
  isBaseSepolia: boolean;
  account: Address | undefined;
  escrow: Address | undefined;
  operator: Address | undefined;
  token: Address | undefined;
  amount: { value: bigint | undefined; error: string | undefined };
  amountInput: string;
  tokenBalance: bigint | undefined;
  tokenDecimals: number | undefined;
  service: string;
  refundAfter: bigint | undefined;
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

  if (!token) {
    messages.push("token 地址为空或格式不正确。");
  }

  if (!operator) {
    messages.push("operator 地址为空或格式不正确。");
  } else if (operator === zeroAddress) {
    messages.push("operator 不能是零地址。");
  }

  if (!service.trim()) {
    messages.push("service 不能为空。");
  }

  if (tokenDecimals === undefined) {
    messages.push("还没有读取到 token decimals。");
  }

  if (!amountInput.trim()) {
    messages.push("金额不能为空。");
  } else if (amount.error) {
    messages.push(amount.error);
  } else if (amount.value !== undefined && amount.value <= BigInt(0)) {
    messages.push("金额必须大于 0。");
  } else if (
    amount.value !== undefined &&
    tokenBalance !== undefined &&
    amount.value > tokenBalance
  ) {
    messages.push("token 余额不足。");
  }

  if (refundAfter === undefined) {
    messages.push("refundAfter 时间无效。");
  } else if (refundAfter <= BigInt(Math.floor(Date.now() / 1000))) {
    messages.push("refundAfter 必须晚于当前时间。");
  }

  return messages;
}

function isFundingBusy(step: string) {
  return !["idle", "success", "failed"].includes(step);
}

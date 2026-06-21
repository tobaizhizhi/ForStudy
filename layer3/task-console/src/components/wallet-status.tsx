"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Network, ShieldCheck, Wallet } from "lucide-react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";

export function WalletStatus() {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const isWrongChain = isConnected && chainId !== BASE_SEPOLIA_CHAIN_ID;
  const canWrite = isConnected && chainId === BASE_SEPOLIA_CHAIN_ID;

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
              Wallet
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">连接状态</h2>
          </div>
          <ConnectButton showBalance={false} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          icon={<Wallet aria-hidden="true" size={22} />}
          label="当前地址"
          value={address ?? "-"}
          help={status}
        />
        <StatusCard
          icon={<Network aria-hidden="true" size={22} />}
          label="当前 chain ID"
          value={isConnected ? chainId.toString() : "-"}
          help={`目标：${BASE_SEPOLIA_CHAIN_ID}`}
        />
        <StatusCard
          icon={<ShieldCheck aria-hidden="true" size={22} />}
          label="写链是否允许"
          value={canWrite ? "允许" : "禁止"}
          help={getWriteHelp(isConnected, isWrongChain)}
          tone={canWrite ? "good" : "warn"}
        />
      </div>

      {isWrongChain ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" size={20} />
              <div>
                <p className="font-semibold">当前钱包不在 Base Sepolia</p>
                <p className="mt-1 text-sm leading-6">
                  当前 chain ID 是 {chainId}，后续签名和交易入口都应该保持禁用。
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-950 px-4 text-sm font-medium text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => switchChain({ chainId: BASE_SEPOLIA_CHAIN_ID })}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="animate-spin" aria-hidden="true" size={16} /> : null}
              切换到 Base Sepolia
            </button>
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-5 text-emerald-950">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0" aria-hidden="true" size={20} />
            <div>
              <p className="font-semibold">钱包已连接，并且网络正确</p>
              <p className="mt-1 text-sm leading-6">
                后续模块里的签名和交易按钮可以在这个条件成立时启用。
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatusCard({
  icon,
  label,
  value,
  help,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  help: string;
  tone?: "default" | "good" | "warn";
}) {
  const toneClassName =
    tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-zinc-950";

  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-5 shadow-sm">
      <div className={toneClassName}>{icon}</div>
      <p className="mt-4 text-sm font-medium text-zinc-600">{label}</p>
      <p className={`mt-1 break-words font-mono text-lg font-semibold ${toneClassName}`}>
        {value}
      </p>
      <p className="mt-2 break-words text-sm text-zinc-500">{help}</p>
    </div>
  );
}

function getWriteHelp(isConnected: boolean, isWrongChain: boolean) {
  if (!isConnected) {
    return "未连接钱包";
  }

  if (isWrongChain) {
    return "链不对，必须切到 Base Sepolia";
  }

  return "isConnected && chainId === 84532";
}

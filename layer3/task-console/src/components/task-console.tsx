"use client";

import { useState } from "react";

import { CompletionPanel } from "@/components/completion-panel";
import { EventsPanel } from "@/components/events-panel";
import { FundingPanel } from "@/components/funding-panel";
import { IntentPanel } from "@/components/intent-panel";
import { ReadPanel } from "@/components/read-panel";
import { WalletStatus } from "@/components/wallet-status";
import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";
import type { SignedTaskIntent } from "@/hooks/useTaskIntent";

export function TaskConsole() {
  const [signedIntent, setSignedIntent] = useState<SignedTaskIntent | undefined>();

  return (
    <main className="min-h-screen bg-[#f7f4ee] text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-zinc-300 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
            Module 8
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            事件流、交易历史与任务时间线
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
            当前模块把 receipt 里的单次事件扩展成历史事件流。写链入口仍然服从钱包状态和网络状态：
            isConnected && chainId === {BASE_SEPOLIA_CHAIN_ID}；事件流则从 escrow 部署块开始分页读取。
          </p>
        </header>

        <WalletStatus />
        <FundingPanel />
        <IntentPanel onSigned={setSignedIntent} />
        <CompletionPanel signedIntent={signedIntent} />
        <EventsPanel />
        <ReadPanel />
      </div>
    </main>
  );
}

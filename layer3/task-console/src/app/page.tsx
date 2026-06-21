import { FundingPanel } from "@/components/funding-panel";
import { IntentPanel } from "@/components/intent-panel";
import { ReadPanel } from "@/components/read-panel";
import { WalletStatus } from "@/components/wallet-status";
import { BASE_SEPOLIA_CHAIN_ID } from "@/config/chains";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f4ee] text-zinc-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
        <header className="border-b border-zinc-300 pb-6">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-emerald-700">
            Module 6
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            EIP-712 任务意图签名
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
            当前模块生成 TaskIntent 签名。签名入口仍然服从钱包状态和网络状态：
            isConnected && chainId === {BASE_SEPOLIA_CHAIN_ID} 时才允许签名；签名本身不是交易，
            不会花 gas，也不会改变链上状态。
          </p>
        </header>

        <WalletStatus />
        <FundingPanel />
        <IntentPanel />
        <ReadPanel />
      </div>
    </main>
  );
}

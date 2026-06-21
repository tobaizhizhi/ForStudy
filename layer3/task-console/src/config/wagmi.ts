import { http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!walletConnectProjectId) {
  throw new Error("Missing NEXT_PUBLIC_WC_PROJECT_ID");
}

export const wagmiConfig = getDefaultConfig({
  appName: "Task Console",
  projectId: walletConnectProjectId,
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
import { createPublicClient, http, isAddress, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { RPC_URL } from "./config.js";

// ============================================================================
// MCP 工具的实际实现：viem 真连 Base Sepolia 公共 RPC，只读。
// 这些函数被 mcp-server.ts 注册成 MCP tools，也被 a2a-agent 间接调用。
// 只读、不写链、不碰私钥。
// ============================================================================

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export async function getBalance(address: string): Promise<{ address: string; balanceWei: string; balanceEth: string }> {
  if (!isAddress(address)) throw new Error(`不是合法地址: ${address}`);
  const wei = await publicClient.getBalance({ address });
  return {
    address,
    balanceWei: wei.toString(),
    balanceEth: formatEther(wei),
  };
}

export async function getBlockNumber(): Promise<{ blockNumber: string }> {
  const bn = await publicClient.getBlockNumber();
  return { blockNumber: bn.toString() };
}

export async function getTxCount(address: string): Promise<{ address: string; txCount: number }> {
  if (!isAddress(address)) throw new Error(`不是合法地址: ${address}`);
  const count = await publicClient.getTransactionCount({ address });
  return { address, txCount: count };
}

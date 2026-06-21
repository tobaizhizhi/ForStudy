import { formatUnits } from "viem";

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value: bigint, decimals: number) {
  return formatUnits(value, decimals);
}

export function formatTaskStatus(status: number) {
  return ["Created", "Funded", "Completed", "Refunded", "Cancelled"][status] ?? `Unknown(${status})`;
}

export function formatUnixTimestamp(timestamp: bigint) {
  if (timestamp === BigInt(0)) {
    return "-";
  }

  return new Date(Number(timestamp) * 1000).toLocaleString("zh-CN", {
    hour12: false,
  });
}

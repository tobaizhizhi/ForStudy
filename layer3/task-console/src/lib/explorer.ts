import type { Address, Hash } from "viem";

export function getExplorerTxUrl(explorerUrl: string | undefined, hash: Hash) {
  return explorerUrl ? `${explorerUrl}/tx/${hash}` : undefined;
}

export function getExplorerBlockUrl(explorerUrl: string | undefined, blockNumber: bigint) {
  return explorerUrl ? `${explorerUrl}/block/${blockNumber.toString()}` : undefined;
}

export function getExplorerAddressUrl(explorerUrl: string | undefined, address: Address) {
  return explorerUrl ? `${explorerUrl}/address/${address}` : undefined;
}

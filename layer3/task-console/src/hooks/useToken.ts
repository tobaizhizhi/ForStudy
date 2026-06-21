import { useBalance, useReadContract, useReadContracts } from "wagmi";

import { erc20Abi } from "@/abi/erc20";

type HookOptions = {
  enabled?: boolean;
};

export function useNativeBalance(
  address: `0x${string}` | undefined,
  { enabled = true }: HookOptions = {},
) {
  return useBalance({
    address,
    query: {
      enabled: enabled && Boolean(address),
      staleTime: 10_000,
    },
  });
}

export function useErc20Summary(
  token: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  { enabled = true }: HookOptions = {},
) {
  const contracts = [
    ...(token === undefined
      ? []
      : [
          { address: token, abi: erc20Abi, functionName: "symbol" },
          { address: token, abi: erc20Abi, functionName: "decimals" },
        ]),
    ...(token === undefined || owner === undefined
      ? []
      : [{ address: token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }]),
  ] as const;

  return useReadContracts({
    allowFailure: false,
    contracts,
    query: {
      enabled: enabled && Boolean(token),
      staleTime: 10_000,
    },
  });
}

export function useTokenAllowance(
  token: `0x${string}` | undefined,
  owner: `0x${string}` | undefined,
  spender: `0x${string}` | undefined,
  { enabled = true }: HookOptions = {},
) {
  return useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    query: {
      enabled: enabled && Boolean(token && owner && spender),
      staleTime: 5_000,
    },
  });
}

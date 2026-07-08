"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";

import { CONTRACTS } from "@/config/contracts";
import { readEscrowHistory } from "@/lib/event-history";

type UseEscrowEventsInput = {
  fromBlock: bigint | undefined;
  toBlock: bigint | undefined;
  rangeSize: bigint | undefined;
};

export function useEscrowEvents({ fromBlock, toBlock, rangeSize }: UseEscrowEventsInput) {
  const publicClient = usePublicClient();
  const escrow = CONTRACTS.escrow.address;

  return useQuery({
    queryKey: [
      "escrow-events",
      escrow,
      fromBlock?.toString() ?? "",
      toBlock?.toString() ?? "latest",
      rangeSize?.toString() ?? "",
    ],
    enabled: false,
    retry: false,
    staleTime: 10_000,
    queryFn: async () => {
      if (!publicClient) {
        throw new Error("RPC client 还没有准备好。");
      }

      if (!escrow) {
        throw new Error("缺少 escrow 合约地址。");
      }

      if (fromBlock === undefined) {
        throw new Error("缺少 escrow deployBlock，不能查询历史事件。");
      }

      if (rangeSize === undefined || rangeSize <= BigInt(0)) {
        throw new Error("事件查询区间必须大于 0。");
      }

      return readEscrowHistory({
        publicClient,
        escrow,
        fromBlock,
        toBlock,
        rangeSize,
      });
    },
  });
}

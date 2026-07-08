import { parseEventLogs, type Address, type Hash, type PublicClient } from "viem";

import { agentTaskEscrowAbi } from "@/abi/AgentTaskEscrowWithPermit";

export type TaskHistoryEventKind =
  | "TaskCreated"
  | "TaskFunded"
  | "TaskFundedWithPermit"
  | "TaskIntentUsed"
  | "TaskCompleted"
  | "TaskRefunded"
  | "TaskCancelled"
  | "Paused"
  | "Unpaused";

export type TaskHistoryEvent = {
  id: string;
  kind: TaskHistoryEventKind;
  taskId?: bigint;
  client?: Address;
  operator?: Address;
  token?: Address;
  account?: Address;
  amount?: bigint;
  service?: string;
  resultURI?: string;
  action?: string;
  nonce?: bigint;
  refundAfter?: bigint;
  blockNumber: bigint;
  blockTimestamp?: bigint;
  transactionHash: Hash;
  transactionIndex: number;
  logIndex: number;
};

export type BlockRange = {
  fromBlock: bigint;
  toBlock: bigint;
};

export type ReadEscrowHistoryInput = {
  publicClient: PublicClient;
  escrow: Address;
  fromBlock: bigint;
  toBlock?: bigint;
  rangeSize: bigint;
};

export type ReadEscrowHistoryResult = {
  events: TaskHistoryEvent[];
  latestBlock: bigint;
  fromBlock: bigint;
  toBlock: bigint;
  rangeSize: bigint;
  ranges: BlockRange[];
};

type ParsedEscrowLog = {
  eventName: string;
  args: unknown;
  blockNumber: bigint;
  transactionHash: Hash;
  transactionIndex: number;
  logIndex: number;
};

export function buildBlockRanges(fromBlock: bigint, toBlock: bigint, rangeSize: bigint) {
  if (rangeSize <= BigInt(0)) {
    throw new Error("事件查询区间必须大于 0。");
  }

  if (fromBlock > toBlock) {
    return [];
  }

  const ranges: BlockRange[] = [];

  for (let start = fromBlock; start <= toBlock; start += rangeSize) {
    const end = start + rangeSize - BigInt(1);
    ranges.push({
      fromBlock: start,
      toBlock: end > toBlock ? toBlock : end,
    });
  }

  return ranges;
}

export async function readEscrowHistory({
  publicClient,
  escrow,
  fromBlock,
  toBlock,
  rangeSize,
}: ReadEscrowHistoryInput): Promise<ReadEscrowHistoryResult> {
  const latestBlock = await publicClient.getBlockNumber();
  const safeToBlock = toBlock ?? latestBlock;

  if (fromBlock > safeToBlock) {
    throw new Error("fromBlock 不能大于 toBlock。");
  }

  const ranges = buildBlockRanges(fromBlock, safeToBlock, rangeSize);
  const events: TaskHistoryEvent[] = [];

  for (const range of ranges) {
    const logs = await publicClient.getLogs({
      address: escrow,
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
    });
    const parsed = parseEventLogs({
      abi: agentTaskEscrowAbi,
      logs,
      strict: false,
    }) as ParsedEscrowLog[];

    for (const log of parsed) {
      const event = normalizeEscrowLog(log);

      if (event) {
        events.push(event);
      }
    }
  }

  const sorted = sortHistoryEvents(events, "asc");
  const timestamps = await readBlockTimestamps(publicClient, sorted.map((event) => event.blockNumber));
  const eventsWithTimestamps = sorted.map((event) => ({
    ...event,
    blockTimestamp: timestamps.get(event.blockNumber.toString()),
  }));

  return {
    events: eventsWithTimestamps,
    latestBlock,
    fromBlock,
    toBlock: safeToBlock,
    rangeSize,
    ranges,
  };
}

export function sortHistoryEvents(events: TaskHistoryEvent[], direction: "asc" | "desc" = "asc") {
  const sorted = [...events].sort(compareHistoryEvents);
  return direction === "asc" ? sorted : sorted.reverse();
}

export function filterTaskEvents(events: TaskHistoryEvent[], taskId: bigint | undefined) {
  if (taskId === undefined) {
    return [];
  }

  return events.filter((event) => event.taskId === taskId);
}

function normalizeEscrowLog(log: ParsedEscrowLog): TaskHistoryEvent | undefined {
  const meta = getLogMeta(log);

  if (log.eventName === "TaskCreated") {
    const args = log.args as {
      taskId: bigint;
      client: Address;
      operator: Address;
      token: Address;
      amount: bigint;
      service: string;
      refundAfter: bigint;
    };

    return {
      ...meta,
      kind: "TaskCreated",
      taskId: args.taskId,
      client: args.client,
      operator: args.operator,
      token: args.token,
      amount: args.amount,
      service: args.service,
      refundAfter: args.refundAfter,
    };
  }

  if (log.eventName === "TaskFunded" || log.eventName === "TaskFundedWithPermit") {
    const args = log.args as {
      taskId: bigint;
      client: Address;
      token: Address;
      amount: bigint;
    };

    return {
      ...meta,
      kind: log.eventName,
      taskId: args.taskId,
      client: args.client,
      token: args.token,
      amount: args.amount,
    };
  }

  if (log.eventName === "TaskIntentUsed") {
    const args = log.args as {
      client: Address;
      taskId: bigint;
      operator: Address;
      action: string;
      nonce: bigint;
    };

    return {
      ...meta,
      kind: "TaskIntentUsed",
      taskId: args.taskId,
      client: args.client,
      operator: args.operator,
      action: args.action,
      nonce: args.nonce,
    };
  }

  if (log.eventName === "TaskCompleted") {
    const args = log.args as {
      taskId: bigint;
      client: Address;
      operator: Address;
      resultURI: string;
    };

    return {
      ...meta,
      kind: "TaskCompleted",
      taskId: args.taskId,
      client: args.client,
      operator: args.operator,
      resultURI: args.resultURI,
    };
  }

  if (log.eventName === "TaskRefunded") {
    const args = log.args as {
      taskId: bigint;
      client: Address;
      token: Address;
      amount: bigint;
    };

    return {
      ...meta,
      kind: "TaskRefunded",
      taskId: args.taskId,
      client: args.client,
      token: args.token,
      amount: args.amount,
    };
  }

  if (log.eventName === "TaskCancelled") {
    const args = log.args as {
      taskId: bigint;
      client: Address;
    };

    return {
      ...meta,
      kind: "TaskCancelled",
      taskId: args.taskId,
      client: args.client,
    };
  }

  if (log.eventName === "Paused" || log.eventName === "Unpaused") {
    const args = log.args as {
      account: Address;
    };

    return {
      ...meta,
      kind: log.eventName,
      account: args.account,
    };
  }

  return undefined;
}

function getLogMeta(log: ParsedEscrowLog) {
  return {
    id: `${log.transactionHash}:${log.logIndex}`,
    blockNumber: log.blockNumber,
    transactionHash: log.transactionHash,
    transactionIndex: log.transactionIndex,
    logIndex: log.logIndex,
  };
}

function compareHistoryEvents(left: TaskHistoryEvent, right: TaskHistoryEvent) {
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber < right.blockNumber ? -1 : 1;
  }

  if (left.transactionIndex !== right.transactionIndex) {
    return left.transactionIndex - right.transactionIndex;
  }

  return left.logIndex - right.logIndex;
}

async function readBlockTimestamps(publicClient: PublicClient, blockNumbers: bigint[]) {
  const uniqueBlockNumbers = [...new Set(blockNumbers.map((blockNumber) => blockNumber.toString()))];
  const timestamps = new Map<string, bigint>();

  await Promise.all(
    uniqueBlockNumbers.map(async (blockNumberText) => {
      const blockNumber = BigInt(blockNumberText);
      const block = await publicClient.getBlock({ blockNumber });
      timestamps.set(blockNumberText, block.timestamp);
    }),
  );

  return timestamps;
}

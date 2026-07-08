// AgentTaskEscrowWithPermit 的最小 ABI 子集（Layer 4 脚本用到的部分）。
// 完整 ABI 请从 Layer 2 用 `forge inspect` 导出，合约接口一改就要重新同步。
export const escrowAbi = [
  {
    type: "function",
    name: "createTask",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "service", type: "string" },
      { name: "refundAfter", type: "uint256" },
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundTask",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  { type: "function", name: "taskCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "tasks",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      { name: "client", type: "address" },
      { name: "operator", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "service", type: "string" },
      { name: "resultURI", type: "string" },
      { name: "refundAfter", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "event",
    name: "TaskCreated",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "service", type: "string", indexed: false },
      { name: "refundAfter", type: "uint256", indexed: false },
    ],
  },
] as const;

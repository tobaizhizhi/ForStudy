// 选修模块 07 里 AgentSmartAccount / SessionKeyManager 的最小 ABI 子集。
// 用于 session-key 脚本：人类 owner 注册 / 撤销 agent 钥匙，并读回策略。
export const agentSmartAccountAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "registerSessionKey",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "validAfter", type: "uint48" },
      { name: "validUntil", type: "uint48" },
      { name: "perCallCap", type: "uint256" },
      { name: "dailyCap", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeSessionKey",
    stateMutability: "nonpayable",
    inputs: [{ name: "key", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setSessionKeyTarget",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "target", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSessionKeySelector",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "selector", type: "bytes4" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSessionKeyErc20Cap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", type: "address" },
      { name: "token", type: "address" },
      { name: "cap", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isSessionKeyActive",
    stateMutability: "view",
    inputs: [{ name: "key", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "sessionKey",
    stateMutability: "view",
    inputs: [{ name: "key", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "registered", type: "bool" },
          { name: "revoked", type: "bool" },
          { name: "validAfter", type: "uint48" },
          { name: "validUntil", type: "uint48" },
          { name: "perCallCap", type: "uint256" },
          { name: "dailyCap", type: "uint256" },
          { name: "spentToday", type: "uint256" },
          { name: "daySlot", type: "uint48" },
        ],
      },
    ],
  },
] as const;

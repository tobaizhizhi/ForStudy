import { pathToFileURL } from "node:url";
import type { Address, Hex } from "viem";
import { toFunctionSelector } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const CHAIN_ID = 84532n; // Base Sepolia
export const ENTRY_POINT_07 = "0x0000000071727de22e5e9d8baf0edac6f37da032" as Address;

export const OWNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
export const AGENT_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f094538f6e2e58d9739c6d7e5f687cb5d08c5f60" as Hex;

export const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);
export const agent = privateKeyToAccount(AGENT_PRIVATE_KEY);

export const ADDRESSES = {
  smartAccount: "0x1111111111111111111111111111111111111111" as Address,
  factory: "0x1212121212121212121212121212121212121212" as Address,
  escrow: "0x2222222222222222222222222222222222222222" as Address,
  token: "0x3333333333333333333333333333333333333333" as Address,
  piggyBank: "0x4444444444444444444444444444444444444444" as Address,
  implementation: "0x5555555555555555555555555555555555555555" as Address,
  relayer: "0x6666666666666666666666666666666666666666" as Address,
  bob: "0x7777777777777777777777777777777777777777" as Address,
  bad: "0xbad0000000000000000000000000000000000000" as Address,
} as const;

export const accountAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [{ name: "ret", type: "bytes" }],
  },
] as const;

export const factoryAbi = [
  {
    type: "function",
    name: "createAccount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "salt", type: "uint256" },
    ],
    outputs: [{ name: "account", type: "address" }],
  },
] as const;

export const escrowAbi = [
  {
    type: "function",
    name: "createTask",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "metadataURI", type: "string" },
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
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;

export const piggyBankAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

export const SELECTORS = {
  execute: toFunctionSelector("execute(address,uint256,bytes)"),
  createTask: toFunctionSelector("createTask(address,address,uint256,string,uint256)"),
  fundTask: toFunctionSelector("fundTask(uint256)"),
  deposit: toFunctionSelector("deposit()"),
  approve: toFunctionSelector("approve(address,uint256)"),
  transfer: toFunctionSelector("transfer(address,uint256)"),
} as const;

export function selectorOf(data: Hex): Hex {
  return data.length >= 10 ? (data.slice(0, 10) as Hex) : "0x";
}

export function bytesLength(data: Hex): number {
  return (data.length - 2) / 2;
}

export function shortHex(hex: Hex | Address, head = 10, tail = 6): string {
  if (hex.length <= head + tail) return hex;
  return `${hex.slice(0, head)}...${hex.slice(-tail)}`;
}

export function section(title: string): void {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

export function printKV(label: string, value: unknown): void {
  const rendered =
    typeof value === "bigint" ? value.toString() : typeof value === "string" && value.startsWith("0x") ? shortHex(value as Hex) : value;
  console.log(`${label.padEnd(22)}: ${rendered}`);
}

export function runIfMain(metaUrl: string, fn: () => void | Promise<void>): void {
  if (process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href) {
    Promise.resolve(fn()).catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
  }
}

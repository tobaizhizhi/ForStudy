import { hashTypedData, keccak256, recoverAddress, stringToHex, type Hex } from "viem";
import { ADDRESSES, CHAIN_ID, agent, owner, printKV, runIfMain, section } from "./shared.js";

const MAGIC_VALUE = "0x1626ba7e";
const INVALID_VALUE = "0xffffffff";

const taskIntentTypes = {
  TaskIntent: [
    { name: "client", type: "address" },
    { name: "operator", type: "address" },
    { name: "taskId", type: "uint256" },
    { name: "resultHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

const domain = {
  name: "AgentTaskEscrow",
  version: "1",
  chainId: Number(CHAIN_ID),
  verifyingContract: ADDRESSES.escrow,
} as const;

async function isValidSignature(hash: Hex, signature: Hex): Promise<typeof MAGIC_VALUE | typeof INVALID_VALUE> {
  const recovered = await recoverAddress({ hash, signature });
  return recovered.toLowerCase() === owner.address.toLowerCase() ? MAGIC_VALUE : INVALID_VALUE;
}

export async function runDemo(): Promise<void> {
  section("练习 5：EIP-1271 让“合约账户作为 client”也能验签");

  const message = {
    client: ADDRESSES.smartAccount,
    operator: ADDRESSES.bob,
    taskId: 7n,
    resultHash: keccak256(stringToHex("ipfs://result/demo")),
    nonce: 1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  } as const;

  const digest = hashTypedData({
    domain,
    types: taskIntentTypes,
    primaryType: "TaskIntent",
    message,
  });

  const ownerSignature = await owner.signTypedData({
    domain,
    types: taskIntentTypes,
    primaryType: "TaskIntent",
    message,
  });

  const agentSignature = await agent.signTypedData({
    domain,
    types: taskIntentTypes,
    primaryType: "TaskIntent",
    message,
  });

  printKV("client", message.client);
  printKV("client 是谁", "智能账户合约，不是 owner EOA");
  printKV("owner", owner.address);
  printKV("TaskIntent digest", digest);

  const ok = await isValidSignature(digest, ownerSignature);
  const bad = await isValidSignature(digest, agentSignature);

  console.log("\nescrow 如果用 SignatureChecker.isValidSignatureNow(client, digest, sig)：");
  printKV("owner 签名结果", ok);
  printKV("agent 签名结果", bad);

  console.log("\n解释：");
  console.log("client 是合约账户时，escrow 不能用 ecrecover(sig) == client，因为合约没有私钥。");
  console.log("正确做法是调用 client.isValidSignature(digest, sig)，让智能账户自己回答这份签名是否代表它。");
}

runIfMain(import.meta.url, runDemo);

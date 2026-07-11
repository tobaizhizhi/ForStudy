import {
  concatHex,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseUnits,
  toHex,
  type Hex,
} from "viem";
import {
  ADDRESSES,
  CHAIN_ID,
  ENTRY_POINT_07,
  accountAbi,
  escrowAbi,
  factoryAbi,
  owner,
  printKV,
  runIfMain,
  section,
  selectorOf,
  shortHex,
} from "./shared.js";

interface PackedUserOperation {
  sender: Hex;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

function packTwoUint128(high: bigint, low: bigint): Hex {
  return toHex((high << 128n) | low, { size: 32 });
}

function pseudoUserOpHash(op: PackedUserOperation): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { name: "sender", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "initCodeHash", type: "bytes32" },
        { name: "callDataHash", type: "bytes32" },
        { name: "paymasterHash", type: "bytes32" },
        { name: "entryPoint", type: "address" },
        { name: "chainId", type: "uint256" },
      ],
      [
        op.sender,
        op.nonce,
        keccak256(op.initCode),
        keccak256(op.callData),
        keccak256(op.paymasterAndData),
        ENTRY_POINT_07,
        CHAIN_ID,
      ],
    ),
  );
}

async function buildUserOperation(accountAlreadyDeployed: boolean): Promise<{ op: PackedUserOperation; hash: Hex }> {
  const innerCall = encodeFunctionData({
    abi: escrowAbi,
    functionName: "fundTask",
    args: [1n],
  });

  const callData = encodeFunctionData({
    abi: accountAbi,
    functionName: "execute",
    args: [ADDRESSES.escrow, 0n, innerCall],
  });

  const factoryCall = encodeFunctionData({
    abi: factoryAbi,
    functionName: "createAccount",
    args: [owner.address, 0n],
  });

  const initCode = accountAlreadyDeployed ? "0x" : concatHex([ADDRESSES.factory, factoryCall]);

  const opWithoutSig: PackedUserOperation = {
    sender: ADDRESSES.smartAccount,
    nonce: 0n,
    initCode,
    callData,
    accountGasLimits: packTwoUint128(500_000n, 120_000n),
    preVerificationGas: 55_000n,
    gasFees: packTwoUint128(2_000_000_000n, 100_000_000n),
    paymasterAndData: concatHex([ADDRESSES.implementation, toHex(parseUnits("0.02", 18), { size: 32 })]),
    signature: "0x",
  };

  const hash = pseudoUserOpHash(opWithoutSig);
  const signature = await owner.signMessage({ message: { raw: hash } });

  return { op: { ...opWithoutSig, signature }, hash };
}

export async function runDemo(): Promise<void> {
  section("练习 1：UserOperation 不是普通交易，而是“智能账户想做什么”的意图");

  const first = await buildUserOperation(false);
  printKV("sender", first.op.sender);
  printKV("sender 含义", "智能账户地址，不是 owner EOA");
  printKV("owner EOA", owner.address);
  printKV("callData 外层 selector", selectorOf(first.op.callData));
  printKV("callData 外层含义", "account.execute(target,value,data)");
  printKV("initCode 是否为空", first.op.initCode === "0x" ? "空：账户已部署" : "非空：首笔 UserOp 会顺手部署账户");
  printKV("paymasterAndData", first.op.paymasterAndData);
  printKV("userOpHash", first.hash);
  printKV("signature", first.op.signature);

  console.log("\n如果 Bundler 接收它，会把它放进一笔外层普通交易：");
  printKV("outer tx from", "Bundler/Relayer");
  printKV("outer tx to", ENTRY_POINT_07);
  printKV("outer tx data", "EntryPoint.handleOps([这个 UserOperation], beneficiary)");
  printKV("你拿到的 txHash", "外层 handleOps 交易 hash，不等于 userOpHash");

  const second = await buildUserOperation(true);
  console.log("\n同一个账户第二次再发 UserOp：");
  printKV("initCode", second.op.initCode);
  printKV("原因", "账户已经部署，不需要再带 factory + createAccount calldata");

  console.log(`\n观察重点：签名在 signature 字段里，业务动作藏在 callData 里：${shortHex(first.op.callData)}`);
}

runIfMain(import.meta.url, runDemo);

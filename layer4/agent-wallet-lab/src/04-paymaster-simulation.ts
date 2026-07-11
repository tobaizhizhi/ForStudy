import { encodeFunctionData, parseUnits, type Address, type Hex } from "viem";
import {
  ADDRESSES,
  SELECTORS,
  erc20Abi,
  escrowAbi,
  printKV,
  runIfMain,
  section,
  selectorOf,
} from "./shared.js";

interface SimulatedUserOperation {
  label: string;
  sender: Address;
  target: Address;
  innerCall: Hex;
  signedBy: "owner" | "agent" | "stranger";
  maxGasCost: bigint;
}

interface PaymasterPolicy {
  allowedSenders: Set<Address>;
  allowedTargets: Set<Address>;
  allowedSelectors: Set<Hex>;
  remainingGasBudgetWei: bigint;
}

function accountValidate(op: SimulatedUserOperation): { ok: true } | { ok: false; reason: string } {
  if (op.signedBy !== "agent" && op.signedBy !== "owner") return { ok: false, reason: "账户验签失败" };
  if (op.signedBy === "owner") return { ok: true };
  if (op.target !== ADDRESSES.escrow && op.target !== ADDRESSES.token) return { ok: false, reason: "session key 不允许这个目标" };
  const selector = selectorOf(op.innerCall);
  if (![SELECTORS.fundTask, SELECTORS.approve].includes(selector)) {
    return { ok: false, reason: `session key 不允许这个函数：${selector}` };
  }
  return { ok: true };
}

function paymasterValidate(
  op: SimulatedUserOperation,
  policy: PaymasterPolicy,
): { ok: true } | { ok: false; reason: string } {
  if (!policy.allowedSenders.has(op.sender)) return { ok: false, reason: "paymaster 不赞助这个 sender" };
  if (!policy.allowedTargets.has(op.target)) return { ok: false, reason: "paymaster 不赞助这个 target" };
  const selector = selectorOf(op.innerCall);
  if (!policy.allowedSelectors.has(selector)) return { ok: false, reason: `paymaster 不赞助这个 selector：${selector}` };
  if (op.maxGasCost > policy.remainingGasBudgetWei) return { ok: false, reason: "paymaster 预算不足" };
  policy.remainingGasBudgetWei -= op.maxGasCost;
  return { ok: true };
}

function bundlerSimulate(op: SimulatedUserOperation, policy: PaymasterPolicy): void {
  console.log(`\nBundler 收到：${op.label}`);
  printKV("sender", op.sender);
  printKV("target", op.target);
  printKV("selector", selectorOf(op.innerCall));

  const accountResult = accountValidate(op);
  if (!accountResult.ok) {
    printKV("模拟结果", `拒绝：${accountResult.reason}`);
    printKV("为什么不上链", "Bundler 先模拟，避免自己垫 gas 后收不回来");
    return;
  }

  const paymasterResult = paymasterValidate(op, policy);
  if (!paymasterResult.ok) {
    printKV("模拟结果", `拒绝：${paymasterResult.reason}`);
    printKV("为什么不上链", "paymaster 不签赞助，Bundler 不会打包");
    return;
  }

  printKV("模拟结果", "通过");
  printKV("下一步", "Bundler 打包到 EntryPoint.handleOps");
  printKV("paymaster 剩余预算", `${policy.remainingGasBudgetWei} wei`);
}

export function runDemo(): void {
  section("练习 4：Bundler 为什么要先模拟，Paymaster 为什么不能乱赞助");

  const policy: PaymasterPolicy = {
    allowedSenders: new Set([ADDRESSES.smartAccount]),
    allowedTargets: new Set([ADDRESSES.escrow]),
    allowedSelectors: new Set([SELECTORS.fundTask]),
    remainingGasBudgetWei: 3_000_000_000_000_000n,
  };

  const goodFundTask = encodeFunctionData({ abi: escrowAbi, functionName: "fundTask", args: [1n] });
  const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ADDRESSES.escrow, parseUnits("1", 18)] });
  const transfer = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [ADDRESSES.bad, parseUnits("1", 18)] });

  const ops: SimulatedUserOperation[] = [
    {
      label: "正常：agent 让智能账户调 escrow.fundTask",
      sender: ADDRESSES.smartAccount,
      target: ADDRESSES.escrow,
      innerCall: goodFundTask,
      signedBy: "agent",
      maxGasCost: 1_000_000_000_000_000n,
    },
    {
      label: "账户允许 approve，但 paymaster 策略不赞助 approve",
      sender: ADDRESSES.smartAccount,
      target: ADDRESSES.token,
      innerCall: approve,
      signedBy: "agent",
      maxGasCost: 1_000_000_000_000_000n,
    },
    {
      label: "恶意：陌生签名者想让 paymaster 给转账付 gas",
      sender: ADDRESSES.smartAccount,
      target: ADDRESSES.token,
      innerCall: transfer,
      signedBy: "stranger",
      maxGasCost: 1_000_000_000_000_000n,
    },
  ];

  for (const op of ops) bundlerSimulate(op, policy);

  console.log("\n结论：session key policy 保护账户资产；paymaster policy 保护 gas 预算。两道闸都要过。");
}

runIfMain(import.meta.url, runDemo);

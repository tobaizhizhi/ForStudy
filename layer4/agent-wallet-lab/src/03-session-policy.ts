import { decodeFunctionData, encodeFunctionData, formatEther, formatUnits, parseEther, parseUnits, type Address, type Hex } from "viem";
import {
  ADDRESSES,
  SELECTORS,
  bytesLength,
  erc20Abi,
  piggyBankAbi,
  printKV,
  runIfMain,
  section,
  selectorOf,
} from "./shared.js";

interface SessionKeyPolicy {
  registered: boolean;
  revoked: boolean;
  validAfter: number;
  validUntil: number;
  perCallCap: bigint;
  dailyCap: bigint;
  spentToday: bigint;
  daySlot: number;
  allowedTargets: Set<Address>;
  allowedSelectors: Set<Hex>;
  erc20CapByToken: Map<Address, bigint>;
}

interface Attempt {
  target: Address;
  value: bigint;
  innerCall: Hex;
  now: number;
}

function makePolicy(now: number): SessionKeyPolicy {
  return {
    registered: true,
    revoked: false,
    validAfter: now,
    validUntil: now + 7 * 24 * 3600,
    perCallCap: parseEther("1"),
    dailyCap: parseEther("2"),
    spentToday: 0n,
    daySlot: Math.floor(now / 86_400),
    allowedTargets: new Set([ADDRESSES.piggyBank, ADDRESSES.token]),
    allowedSelectors: new Set([SELECTORS.deposit, SELECTORS.approve]),
    erc20CapByToken: new Map([[ADDRESSES.token, parseUnits("100", 18)]]),
  };
}

function consumeDailyBudget(policy: SessionKeyPolicy, value: bigint, now: number): { ok: true } | { ok: false; reason: string } {
  const slot = Math.floor(now / 86_400);
  if (policy.daySlot !== slot) {
    policy.daySlot = slot;
    policy.spentToday = 0n;
  }

  const next = policy.spentToday + value;
  if (next > policy.dailyCap) {
    return { ok: false, reason: `超每日 native 额度：${formatEther(next)} > ${formatEther(policy.dailyCap)} ETH` };
  }
  policy.spentToday = next;
  return { ok: true };
}

function checkScope(policy: SessionKeyPolicy, attempt: Attempt): { ok: true } | { ok: false; reason: string } {
  if (!policy.registered) return { ok: false, reason: "session key 未登记" };
  if (policy.revoked) return { ok: false, reason: "session key 已撤销" };
  if (attempt.now < policy.validAfter) return { ok: false, reason: "session key 还没生效" };
  if (attempt.now > policy.validUntil) return { ok: false, reason: "session key 已过期" };
  if (!policy.allowedTargets.has(attempt.target)) return { ok: false, reason: "目标合约不在白名单" };
  if (attempt.value > policy.perCallCap) return { ok: false, reason: "单笔 native value 超限" };

  const selector = selectorOf(attempt.innerCall);
  if (!policy.allowedSelectors.has(selector)) return { ok: false, reason: `函数 selector 不在白名单：${selector}` };

  if (selector === SELECTORS.approve) {
    if (bytesLength(attempt.innerCall) !== 68) {
      return { ok: false, reason: `approve calldata 长度必须是 68 字节，实际 ${bytesLength(attempt.innerCall)} 字节` };
    }
    const decoded = decodeFunctionData({ abi: erc20Abi, data: attempt.innerCall });
    const amount = decoded.args[1];
    const cap = policy.erc20CapByToken.get(attempt.target) ?? 0n;
    if (amount > cap) {
      return { ok: false, reason: `approve 金额超限：${formatUnits(amount, 18)} > ${formatUnits(cap, 18)} token` };
    }
  }

  return consumeDailyBudget(policy, attempt.value, attempt.now);
}

function tryAttempt(label: string, policy: SessionKeyPolicy, attempt: Attempt): void {
  const result = checkScope(policy, attempt);
  const prefix = result.ok ? "✅ 通过" : "⛔ 拒绝";
  const selector = selectorOf(attempt.innerCall);
  console.log(`${prefix} | ${label}`);
  printKV("target", attempt.target);
  printKV("selector", selector);
  printKV("value", `${formatEther(attempt.value)} ETH`);
  if (!result.ok) printKV("原因", result.reason);
  printKV("今日已花 native", `${formatEther(policy.spentToday)} ETH`);
  console.log("");
}

export function runDemo(): void {
  section("练习 3：session key policy 是链上的“限额子卡规则”");

  const now = Math.floor(Date.now() / 1000);
  const policy = makePolicy(now);

  const deposit = encodeFunctionData({ abi: piggyBankAbi, functionName: "deposit" });
  const approve50 = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ADDRESSES.escrow, parseUnits("50", 18)] });
  const approve200 = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [ADDRESSES.escrow, parseUnits("200", 18)] });
  const malformedApprove = `${approve50}00` as Hex;

  tryAttempt("白名单目标 + 白名单函数 + 0.5 ETH value", policy, {
    target: ADDRESSES.piggyBank,
    value: parseEther("0.5"),
    innerCall: deposit,
    now,
  });

  tryAttempt("单笔 2 ETH，超过 perCallCap=1 ETH", policy, {
    target: ADDRESSES.piggyBank,
    value: parseEther("2"),
    innerCall: deposit,
    now,
  });

  tryAttempt("approve 50 token，在单笔 ERC-20 授权上限内", policy, {
    target: ADDRESSES.token,
    value: 0n,
    innerCall: approve50,
    now,
  });

  tryAttempt("approve 200 token，超过 ERC-20 授权上限", policy, {
    target: ADDRESSES.token,
    value: 0n,
    innerCall: approve200,
    now,
  });

  tryAttempt("approve 带了一个多余尾字节，教学策略严格拒绝", policy, {
    target: ADDRESSES.token,
    value: 0n,
    innerCall: malformedApprove,
    now,
  });

  tryAttempt("错误目标合约，即使函数 selector 对也拒绝", policy, {
    target: ADDRESSES.bad,
    value: 0n,
    innerCall: approve50,
    now,
  });

  policy.revoked = true;
  tryAttempt("owner 撤销后，旧 session key 立刻失效", policy, {
    target: ADDRESSES.piggyBank,
    value: parseEther("0.1"),
    innerCall: deposit,
    now,
  });
}

runIfMain(import.meta.url, runDemo);

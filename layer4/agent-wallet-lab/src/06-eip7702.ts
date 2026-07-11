import { formatEther, parseEther, type Address } from "viem";
import { ADDRESSES, owner, printKV, runIfMain, section } from "./shared.js";

interface AccountState {
  address: Address;
  balance: bigint;
  codePointer?: Address;
}

interface MessageCall {
  from: Address;
  to: Address;
  value: bigint;
  data: string;
}

function eip7702Pointer(implementation: Address): string {
  return `委托标记 0xef0100 + ${implementation}`;
}

function executeImplementation(alice: AccountState, tx: MessageCall): void {
  console.log("  -> EVM 发现 Alice 有 7702 委托指针");
  console.log("  -> 执行实现合约代码，但余额/storage/身份用 Alice 自己的");

  if (tx.data === "execute(Bob,0.1 ETH)") {
    alice.balance -= parseEther("0.1");
    printKV("实现合约动作", "从 Alice 余额里转 0.1 ETH 给 Bob");
    printKV("Alice 剩余余额", `${formatEther(alice.balance)} ETH`);
  } else {
    printKV("实现合约动作", `收到未知 data：${tx.data}`);
  }
}

function sendMessage(alice: AccountState, tx: MessageCall): void {
  console.log(`\n消息：from=${tx.from}, to=${tx.to}, value=${formatEther(tx.value)} ETH, data=${tx.data}`);

  if (tx.to !== alice.address) {
    console.log("  -> to 不是 Alice，所以不会执行 Alice 的 7702 委托代码。");
    return;
  }

  if (!alice.codePointer) {
    alice.balance += tx.value;
    console.log("  -> Alice 没有代码：这就是普通转账/普通消息，收钱后结束。");
    printKV("Alice 余额", `${formatEther(alice.balance)} ETH`);
    return;
  }

  executeImplementation(alice, tx);
}

export function runDemo(): void {
  section("练习 6：ERC-7702 里“调用 Alice”到底是什么意思");

  const alice: AccountState = {
    address: owner.address,
    balance: parseEther("1"),
  };

  printKV("Alice 地址", alice.address);
  printKV("初始代码", "0x（普通 EOA，没有代码）");
  printKV("初始余额", `${formatEther(alice.balance)} ETH`);

  sendMessage(alice, {
    from: ADDRESSES.bob,
    to: alice.address,
    value: parseEther("0.2"),
    data: "0x",
  });

  console.log("\nAlice 签一份 7702 authorization：把自己的代码委托到 SmartWalletImplementation");
  alice.codePointer = ADDRESSES.implementation;
  printKV("Alice 代码字段", eip7702Pointer(ADDRESSES.implementation));

  sendMessage(alice, {
    from: ADDRESSES.relayer,
    to: alice.address,
    value: 0n,
    data: "execute(Bob,0.1 ETH)",
  });

  sendMessage(alice, {
    from: alice.address,
    to: ADDRESSES.bob,
    value: parseEther("0.05"),
    data: "0x",
  });

  console.log("\n关键区别：");
  console.log("from = Alice：Alice 自己发交易。");
  console.log("to = Alice：这笔消息打到 Alice 地址；如果 Alice 有 7702 指针，就会执行委托的智能账户代码。");
}

runIfMain(import.meta.url, runDemo);

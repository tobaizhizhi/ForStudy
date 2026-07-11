import { printKV, runIfMain, section, verdict } from "./shared.js";

// ============================================================================
// 练习 4：结算对账 —— 把"付了一笔钱"和"提供了一次服务"串成一条可审计记录
//   一条对账记录要能把 task id / mandate id / tx hash / 收款方 / 金额 串起来，
//   并能处理重复通知、迟到回执、部分失败。只看"最后一笔 tx"是不够的。
// ============================================================================

interface LedgerEntry {
  taskId: string;
  mandateId: string | null;
  txHash: string | null;
  payTo: string;
  asset: string;
  network: string;
  amount: string;
  state: "authorized" | "submitted" | "settled" | "failed";
}

// 对账簿：以 taskId 为主键，收到事件时更新/校验
class Ledger {
  private entries = new Map<string, LedgerEntry>();
  private seenTx = new Set<string>();

  open(e: LedgerEntry): void {
    this.entries.set(e.taskId, e);
  }

  /** 收到一个结算回执（可能重复、可能迟到）。 */
  onReceipt(taskId: string, txHash: string): { ok: true; dup: boolean } | { ok: false; reason: string } {
    const e = this.entries.get(taskId);
    if (!e) return { ok: false, reason: `未知 taskId：${taskId}（迷失回执）` };
    if (this.seenTx.has(txHash)) return { ok: true, dup: true }; // 重复通知：幂等，不重复入账
    this.seenTx.add(txHash);
    e.txHash = txHash;
    e.state = "settled";
    return { ok: true, dup: false };
  }

  get(taskId: string): LedgerEntry | undefined {
    return this.entries.get(taskId);
  }
}

export function runDemo(): void {
  section("练习 4：结算对账（task ↔ mandate ↔ tx ↔ 金额 串起来）");

  const ledger = new Ledger();
  ledger.open({
    taskId: "task-42",
    mandateId: "mnd-0001",
    txHash: null,
    payTo: "0xServiceBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    network: "eip155:84532",
    amount: "80000000",
    state: "submitted",
  });

  // 正常回执
  const r1 = ledger.onReceipt("task-42", "0xtxhash_aaa");
  verdict(r1.ok, "收到 task-42 的结算回执", r1.ok ? undefined : r1.reason);
  const e = ledger.get("task-42")!;
  console.log("对账记录串起来了：");
  printKV("taskId", e.taskId);
  printKV("mandateId", e.mandateId);
  printKV("txHash", e.txHash);
  printKV("amount", `${Number(e.amount) / 1e6} USDC`);
  printKV("state", e.state);
  console.log("");

  // 重复通知（同一 tx 又来一次）：幂等
  const r2 = ledger.onReceipt("task-42", "0xtxhash_aaa");
  verdict(r2.ok, "同一 tx 的回执重复到达 → 幂等，不重复入账" + (r2.ok && r2.dup ? "（识别为重复）" : ""));

  // 迷失回执：不认识的 taskId
  const r3 = ledger.onReceipt("task-999", "0xtxhash_bbb");
  verdict(r3.ok, "收到不认识的 taskId 的回执", r3.ok ? undefined : r3.reason);

  console.log("\n要点：对账不是'看最后一笔 tx'，而是让 task/mandate/tx/金额/收款方");
  console.log("      能相互印证。重复通知要幂等，迟到/迷失回执要能识别，才叫产品级。");
}

runIfMain(import.meta.url, runDemo);

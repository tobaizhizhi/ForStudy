import { runIfMain, section, verdict } from "./shared.js";

// ============================================================================
// 练习 3：支付状态机 —— 一笔支付不是"付了没付"，而是一串可审计的状态
//   quote_pending → awaiting_mandate → authorized → submitted → settled
//   任何一步都可能 failed / expired；settled 后可 refunded。非法跃迁必须被拒。
// ============================================================================

type State =
  | "quote_pending"
  | "awaiting_mandate"
  | "authorized"
  | "submitted"
  | "settled"
  | "failed"
  | "expired"
  | "refunded";

// 允许的状态跃迁（从 → 能到哪些）
const TRANSITIONS: Record<State, State[]> = {
  quote_pending: ["awaiting_mandate", "authorized", "expired", "failed"],
  awaiting_mandate: ["authorized", "expired", "failed"],
  authorized: ["submitted", "expired", "failed"],
  submitted: ["settled", "failed"],
  settled: ["refunded"],
  failed: [],
  expired: [],
  refunded: [],
};

function canTransition(from: State, to: State): boolean {
  return TRANSITIONS[from].includes(to);
}

function run(path: State[]): void {
  let cur = path[0];
  console.log(`起点：${cur}`);
  for (let i = 1; i < path.length; i++) {
    const next = path[i];
    const ok = canTransition(cur, next);
    verdict(ok, `${cur} → ${next}`, ok ? undefined : `非法跃迁（${cur} 不能直接到 ${next}）`);
    if (ok) cur = next;
  }
}

export function runDemo(): void {
  section("练习 3：支付状态机（合法路径 vs 非法跃迁）");

  console.log("① 高风险大额的完整路径（要 mandate）：");
  run(["quote_pending", "awaiting_mandate", "authorized", "submitted", "settled"]);

  console.log("\n② 小额自动路径（跳过 mandate）：");
  run(["quote_pending", "authorized", "submitted", "settled"]);

  console.log("\n③ settled 后退款：");
  run(["settled", "refunded"]);

  console.log("\n④ 非法跃迁必须被拒：");
  run(["quote_pending", "settled"]); // 没结算就想 settled
  run(["submitted", "refunded"]); // 没 settled 不能退款
  run(["failed", "settled"]); // 终态不能复活

  console.log("\n要点：每个状态都要能映射到日志和 UI。'付了没付' 是最粗的抽象——");
  console.log("      产品级支付要能回答 '这笔卡在哪一步、为什么、能不能重试/退款'。");
}

runIfMain(import.meta.url, runDemo);

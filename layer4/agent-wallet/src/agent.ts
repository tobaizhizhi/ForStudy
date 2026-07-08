/// 一个极简的“LangGraph 风格”编排器（纯本地，不联网），演示 agent 的“大脑”怎么在
/// 权限边界内决定动作。真正的“手”（发赞助交易）在 runEscrowTask.ts / sessionKey.ts 里。
///
/// 对照 chapter7 的 LangGraph：这里的 State / node / 条件边就是同一套心智，只是换成 TS，
/// 并且每个“花钱”节点前都过一遍 session key 策略闸门（policyGate）——这就是 Layer 4 的重点：
/// agent 再聪明，也只能在“作用域 + 额度 + 过期”允许的范围内动手。
///
/// 运行：pnpm agent

type Stage = "plan" | "createTask" | "fundTask" | "handoff" | "done" | "blocked";

interface AgentState {
  goal: string;
  stage: Stage;
  taskId?: number;
  spentToday: number; // 已花（token）
  log: string[];
}

// 模拟一把 session key 的策略（和链上 SessionKeyManager 对齐）
const POLICY = {
  allowedTargets: new Set(["escrow", "token"]),
  allowedActions: new Set(["createTask", "approve", "fundTask"]),
  perCallCap: 5, // 单笔 ≤ 5 token
  dailyCap: 8, // 每日 ≤ 8 token
  expiresAt: Date.now() + 7 * 24 * 3600 * 1000,
};

/// 策略闸门：任何“花钱”动作发链之前，先本地过一遍。链上还会再强制一次（双保险）。
function policyGate(
  state: AgentState,
  action: string,
  target: string,
  amount: number,
): { ok: true } | { ok: false; reason: string } {
  if (Date.now() > POLICY.expiresAt) return { ok: false, reason: "session key 已过期" };
  if (!POLICY.allowedTargets.has(target)) return { ok: false, reason: `目标不在白名单: ${target}` };
  if (!POLICY.allowedActions.has(action)) return { ok: false, reason: `动作不在白名单: ${action}` };
  if (amount > POLICY.perCallCap) return { ok: false, reason: `超单笔额度: ${amount} > ${POLICY.perCallCap}` };
  if (state.spentToday + amount > POLICY.dailyCap) return { ok: false, reason: "超每日额度" };
  return { ok: true };
}

function planNode(state: AgentState): AgentState {
  state.log.push(`🧠 规划：目标「${state.goal}」→ 先 createTask，再 fundTask，最后交给 operator`);
  return { ...state, stage: "createTask" };
}

function createTaskNode(state: AgentState): AgentState {
  const gate = policyGate(state, "createTask", "escrow", 5);
  if (!gate.ok) {
    state.log.push(`⛔ createTask 被策略拦截：${gate.reason}`);
    return { ...state, stage: "blocked" };
  }
  state.log.push("📝 createTask(operator, token, 5, 'research', +7d) —— 发赞助 UserOp");
  return { ...state, stage: "fundTask", taskId: 1 };
}

function fundTaskNode(state: AgentState): AgentState {
  const amount = 5;
  const gate = policyGate(state, "fundTask", "escrow", amount);
  if (!gate.ok) {
    state.log.push(`⛔ fundTask 被策略拦截：${gate.reason}`);
    return { ...state, stage: "blocked" };
  }
  state.log.push(`💸 approve(escrow, ${amount}) + fundTask(${state.taskId}) —— 发赞助 UserOp`);
  return { ...state, stage: "handoff", spentToday: state.spentToday + amount };
}

function handoffNode(state: AgentState): AgentState {
  state.log.push("🤝 client(智能账户) 用 EIP-1271 签 TaskIntent，交给 operator 去 completeTask");
  return { ...state, stage: "done" };
}

/// 条件边 + 循环执行，直到 done 或 blocked（对应 chapter7 的 add_conditional_edges）。
function run(goal: string): AgentState {
  let state: AgentState = { goal, stage: "plan", spentToday: 0, log: [] };
  const nodes: Record<Exclude<Stage, "done" | "blocked">, (s: AgentState) => AgentState> = {
    plan: planNode,
    createTask: createTaskNode,
    fundTask: fundTaskNode,
    handoff: handoffNode,
  };

  let steps = 0;
  while (state.stage !== "done" && state.stage !== "blocked" && steps < 10) {
    state = nodes[state.stage](state);
    steps += 1;
  }
  return state;
}

const final = run("让 agent 花不超过 5 USDC 委托一次调研任务");
console.log(final.log.join("\n"));
console.log(`\n最终阶段：${final.stage} | 今日已花：${final.spentToday} token`);

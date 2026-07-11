import { printKV, runIfMain, section, verdict } from "./shared.js";

// ============================================================================
// 练习 4：协议路由闸门 —— 一个目标可能有多种触达方式，上层不该硬编码协议
//   同一个能力，可能能用 A2A（agent↔agent）、MCP（agent↔工具）、或裸 HTTP 触达。
//   路由器的活：看“目标是什么 + 支持哪些协议 + 我偏好谁”，选出一个 adapter。
//   这是里程碑 Gateway 的核心决策逻辑，先在本地用纯数据跑通。
// ============================================================================

type Protocol = "a2a" | "mcp" | "http";

interface Target {
  name: string;
  /** 目标是另一个 agent（用 A2A）还是一个工具服务（用 MCP）。 */
  kind: "agent" | "tool";
  /** 这个目标实际支持哪些协议。 */
  supports: Protocol[];
}

// 路由偏好：agent 优先走 A2A，工具优先走 MCP，都不行退到 HTTP。
function route(target: Target): { ok: true; protocol: Protocol } | { ok: false; reason: string } {
  const preference: Protocol[] =
    target.kind === "agent" ? ["a2a", "http"] : ["mcp", "http"];
  for (const p of preference) {
    if (target.supports.includes(p)) return { ok: true, protocol: p };
  }
  return { ok: false, reason: `目标 ${target.name} 不支持任何可用协议（${target.supports.join(", ") || "无"}）` };
}

export function runDemo(): void {
  section("练习 4：协议路由闸门（MCP / A2A / HTTP 三选一）");

  const targets: Target[] = [
    { name: "chain-reader-agent", kind: "agent", supports: ["a2a", "http"] },
    { name: "mcp-chain-server", kind: "tool", supports: ["mcp"] },
    { name: "legacy-price-agent", kind: "agent", supports: ["http"] }, // 只支持 HTTP → fallback
    { name: "broken-service", kind: "tool", supports: [] }, // 无可用协议 → 拒绝
  ];

  for (const t of targets) {
    const r = route(t);
    if (r.ok) {
      verdict(true, `${t.name}（${t.kind}）→ 选用 ${r.protocol.toUpperCase()}`);
      printKV("  该目标支持", t.supports.join(", "));
    } else {
      verdict(false, `${t.name}（${t.kind}）`, r.reason);
    }
  }

  console.log("\n要点：agent 优先 A2A、工具优先 MCP，都不行才退到 HTTP fallback。");
  console.log("      路由是纯逻辑，最适合先本地跑通，再接真实进程（里程碑 gateway.ts）。");
}

runIfMain(import.meta.url, runDemo);

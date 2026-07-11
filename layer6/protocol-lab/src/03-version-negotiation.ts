import {
  negotiateVersion,
  printKV,
  runIfMain,
  section,
  verdict,
} from "./shared.js";

// ============================================================================
// 练习 3：版本协商（A2A-Version）+ v1.0 破坏性变更的迁移映射
//   client 和 server 得先就“说哪个版本的 A2A”达成一致，否则字段/枚举对不上。
//   A2A v1.0 用 `A2A-Version` header 声明版本；不兼容的版本用不同 URI 区分。
// ============================================================================

// A2A v1.0 的一个破坏性变更：任务状态枚举从 kebab-case 改成 SCREAMING_SNAKE_CASE。
// 老客户端发 "input-required"，新 server 认的是 "INPUT_REQUIRED"。
const ENUM_MIGRATION: Record<string, string> = {
  submitted: "SUBMITTED",
  working: "WORKING",
  "input-required": "INPUT_REQUIRED",
  completed: "COMPLETED",
  canceled: "CANCELED",
  failed: "FAILED",
  rejected: "REJECTED",
};

function migrateTaskState(old: string): string {
  return ENUM_MIGRATION[old] ?? old.toUpperCase().replace(/-/g, "_");
}

export function runDemo(): void {
  section("练习 3：A2A 版本协商 + v1.0 破坏性变更映射");

  console.log("server 支持的 A2A 版本：1.0");
  const cases = [
    { requested: "1.0", label: "client 请求 1.0（匹配）" },
    { requested: "0.3", label: "client 请求 0.3（server 不支持 → 拒绝或降级）" },
    { requested: "2.0", label: "client 请求 2.0（未来版本 → 拒绝）" },
  ];
  for (const c of cases) {
    const r = negotiateVersion(c.requested);
    verdict(r.ok, c.label, r.ok ? undefined : r.reason);
  }

  console.log("");
  section("v1.0 破坏性变更：任务状态枚举 kebab-case → SCREAMING_SNAKE_CASE");
  console.log("老客户端的枚举值 → v1.0 的枚举值：");
  for (const old of Object.keys(ENUM_MIGRATION)) {
    printKV(old, migrateTaskState(old));
  }

  console.log("");
  console.log("要点：v1.0 还改了其它——TaskStatusUpdateEvent 去掉 final 字段、");
  console.log("      pushNotification 操作重命名、security scheme 变判别联合、OAuth 加 Device Code/PKCE。");
  console.log("      参考旧教程/旧 SDK 会踩这些坑，认准 v1.0 文档（详见正文模块 6）。");
}

runIfMain(import.meta.url, runDemo);

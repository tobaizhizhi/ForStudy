import { randomUUID } from "node:crypto";

/** 用 Node 内置 crypto.randomUUID，避免额外依赖。 */
export function v4(): string {
  return randomUUID();
}

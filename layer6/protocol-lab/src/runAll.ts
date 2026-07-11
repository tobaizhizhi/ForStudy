import { section } from "./shared.js";
import { runDemo as card } from "./01-agent-card.js";
import { runDemo as jws } from "./02-jws-jcs.js";
import { runDemo as version } from "./03-version-negotiation.js";
import { runDemo as router } from "./04-protocol-router.js";
import { runDemo as directory } from "./05-service-directory.js";
import { runDemo as interop } from "./06-interop-rejection.js";

// 依次跑 01–06，恰好覆盖“发现 → 信任 → 协商 → 路由 → 撮合 → 拒绝”整条链路。
card();
jws();
version();
router();
directory();
interop();

section("protocol-lab 全部跑完");
console.log("这六个 demo 是 Layer 6 抽象名词的“可运行注脚”：");
console.log("  01 Agent Card 结构   02 JWS+JCS 验签   03 版本协商");
console.log("  04 协议路由         05 服务目录       06 互操作拒绝矩阵");
console.log("再回去读 03–09 正文，MCP / A2A / 发现 / 信任这些词就有抓手了。");

import { section } from "./shared.js";
import { runDemo as handshake } from "./01-x402-handshake.js";
import { runDemo as verify } from "./02-payment-verify.js";
import { runDemo as state } from "./03-state-machine.js";
import { runDemo as recon } from "./04-reconciliation.js";
import { runDemo as mandate } from "./05-ap2-mandate.js";
import { runDemo as interop } from "./06-interop-rejection.js";

// 依次跑 01–06，覆盖"报价 → 验证 → 状态机 → 对账 → 授权 → 拒绝矩阵"整条支付链路。
handshake();
verify();
state();
recon();
mandate();
interop();

section("payment-lab 全部跑完");
console.log("这六个 demo 是 Layer 7 抽象名词的可运行注脚：");
console.log("  01 x402 握手   02 payment 校验   03 状态机");
console.log("  04 对账        05 AP2 mandate    06 互操作拒绝矩阵");
console.log("再去跑 ../paywalled-service 用真实 @x402 SDK 起一个付费服务。");

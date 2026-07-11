import { runDemo as runUserOperation } from "./01-user-operation.js";
import { runDemo as runValidationData } from "./02-validation-data.js";
import { runDemo as runSessionPolicy } from "./03-session-policy.js";
import { runDemo as runPaymasterSimulation } from "./04-paymaster-simulation.js";
import { runDemo as runEip1271 } from "./05-eip1271.js";
import { runDemo as runEip7702 } from "./06-eip7702.js";

await runUserOperation();
runValidationData();
runSessionPolicy();
runPaymasterSimulation();
await runEip1271();
runEip7702();

console.log("\n全部本地练习跑完。现在再去看 layer4/*.md，抽象名词会有抓手很多。");

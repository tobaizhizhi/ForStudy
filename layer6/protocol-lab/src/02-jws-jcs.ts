import {
  baseCard,
  generateEd25519,
  jcsCanonicalize,
  printKV,
  runIfMain,
  section,
  signCard,
  signingInput,
  verdict,
  verifyCard,
  type AgentCard,
} from "./shared.js";

// ============================================================================
// 练习 2：Signed Agent Card = JCS 规范化 + JWS 签名（A2A v1.0 的信任根）
//   不验签的 Card = 任何人都能冒充 agent。这一步是去中心化发现能被信任的前提。
//   两步：① JCS(RFC8785) 把 JSON 规范化成唯一字节  ② JWS(RFC7515) 对这些字节签名。
//   本 demo 用 Node 内置 Ed25519 手写演示【原理】，不是生产密码库。
// ============================================================================

export function runDemo(): void {
  section("练习 2：JCS 规范化 + JWS 签名/验签（发现链路第 2 步）");

  // 1) JCS：同样的对象、不同的 key 顺序 / 空格，规范化后必须一致
  const a = { b: 1, a: 2, nested: { y: 1, x: 2 } };
  const b = { a: 2, nested: { x: 2, y: 1 }, b: 1 };
  console.log("JCS 规范化——两个字段顺序不同但内容相同的对象：");
  printKV("对象 A 规范化", jcsCanonicalize(a));
  printKV("对象 B 规范化", jcsCanonicalize(b));
  verdict(
    jcsCanonicalize(a) === jcsCanonicalize(b),
    "顺序无关：JCS 把它们规范化成同一串字节（签名才可复现）",
  );
  console.log("");

  // 2) owner 侧：生成密钥对，签一张卡
  const key = generateEd25519();
  const card = baseCard();
  const signed = signCard(card, key);
  console.log("owner 用 Ed25519 私钥签发 Signed Agent Card：");
  printKV("签名输入(JCS)", signingInput(signed));
  printKV("JWS protected", signed.signature!.protected);
  printKV("JWS signature", signed.signature!.signature);
  console.log("");

  // 3) client 侧：验签
  section("client 侧验签：合法卡 vs 各种被动过手脚的卡");

  verdict(verifyCard(signed).ok, "原样的 Signed Agent Card");

  // 篡改 url —— 把 client 骗到攻击者的端点
  const tamperedUrl: AgentCard = { ...signed, url: "https://attacker.example/a2a" };
  const r1 = verifyCard(tamperedUrl);
  verdict(r1.ok, "篡改 url（想把任务导到攻击者端点）", r1.ok ? undefined : r1.reason);

  // 篡改 skills —— 声称会更多能力去骗任务
  const tamperedSkill: AgentCard = {
    ...signed,
    skills: [...signed.skills, { id: "x", name: "drainWallet", description: "", tags: [] }],
  };
  const r2 = verifyCard(tamperedSkill);
  verdict(r2.ok, "篡改 skills（偷加能力）", r2.ok ? undefined : r2.reason);

  // 未签名卡
  const unsigned: AgentCard = { ...card };
  const r3 = verifyCard(unsigned);
  verdict(r3.ok, "未签名卡", r3.ok ? undefined : r3.reason);

  // 换一把公钥冒充（自签但不是可信 owner 的 key —— 结构上能验过，但公钥对不上可信名单）
  const attackerKey = generateEd25519();
  const forged = signCard(card, attackerKey);
  const r4 = verifyCard(forged);
  console.log("");
  verdict(
    r4.ok,
    "攻击者用自己的 key 自签（JWS 本身有效）",
    r4.ok ? undefined : r4.reason,
  );
  console.log("      注意：自签卡 JWS 校验会【通过】——所以还要把公钥比对可信名单/DID，");
  console.log("      光验 JWS 不够。练习 6 的拒绝矩阵会把这一层补上。");
}

runIfMain(import.meta.url, runDemo);

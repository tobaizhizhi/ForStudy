import {
  baseCard,
  printKV,
  runIfMain,
  section,
  validateCardShape,
  verdict,
  type AgentCard,
} from "./shared.js";

// ============================================================================
// 练习 1：Agent Card 是 A2A 里 agent 的“数字名片”
//   client 发现一个 agent 的第一步，就是把它的 Agent Card 拉下来、解析、校验结构。
//   本 demo 全本地：手动构造合法卡 + 几张缺字段的坏卡，看结构校验怎么拦。
// ============================================================================

export function runDemo(): void {
  section("练习 1：Agent Card 的结构与解析（发现链路第 1 步）");

  const good = baseCard();
  console.log("一张合法 Agent Card 的关键字段：");
  printKV("protocolVersion", good.protocolVersion);
  printKV("name", good.name);
  printKV("url", good.url);
  printKV("version", good.version);
  printKV("skills", good.skills.map((s) => s.name).join(", "));
  printKV("chains", (good.chains ?? []).join(", "));
  printKV("pricing", good.pricing ? JSON.stringify(good.pricing) : "免费");
  console.log("");

  const cases: { label: string; card: Partial<AgentCard> }[] = [
    { label: "合法卡：字段齐全", card: good },
    { label: "缺 url：无法定位 agent 端点", card: { ...good, url: undefined } },
    {
      label: "缺 skills：不知道它能干什么",
      card: { ...good, skills: [] },
    },
    {
      label: "url 不是 http(s)：可能是伪造/内网穿透",
      card: { ...good, url: "ftp://evil.example/a2a" },
    },
    {
      label: "缺 protocolVersion：无法做版本协商",
      card: { ...good, protocolVersion: undefined },
    },
  ];

  for (const c of cases) {
    const result = validateCardShape(c.card);
    verdict(result.ok, c.label, result.ok ? undefined : result.reason);
  }

  console.log("\n要点：结构校验只是第一道闸——它只保证“长得像一张卡”。");
  console.log("      “这张卡是不是本人签发的”要靠下一课的 JWS 验签（练习 2）。");
}

runIfMain(import.meta.url, runDemo);

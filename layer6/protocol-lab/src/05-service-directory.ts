import { printKV, runIfMain, section, verdict } from "./shared.js";

// ============================================================================
// 练习 5：服务目录（轻量 registry）—— agent 世界的“黄页”
//   多 agent 上线后，client 需要按“能力 + 链 + 预算 + 健康 + 信誉”撮合出一个 agent。
//   本 demo 是内存态教学实现；生产要持久化 + 反女巫 + 可信信誉源（见 ERC-8004 一章）。
//   reputation 字段这里用 fixture 模拟，接口留了 ERC-8004 可插拔口。
// ============================================================================

interface DirectoryEntry {
  name: string;
  url: string;
  capabilityTags: string[];
  chains: string[];
  /** 每次调用报价（教学字段）；0 = 免费。 */
  pricePerCall: number;
  healthy: boolean;
  /** 信誉分 0–100。生产里这个值应来自 ERC-8004 Reputation 注册表，而非 registry 自报。 */
  reputation: number;
}

interface Query {
  needCapability: string;
  needChain: string;
  maxPrice: number;
}

function search(dir: DirectoryEntry[], q: Query): DirectoryEntry[] {
  return dir
    .filter((e) => e.healthy) // 健康过滤
    .filter((e) => e.capabilityTags.includes(q.needCapability)) // 能力匹配
    .filter((e) => e.chains.includes(q.needChain)) // 链匹配
    .filter((e) => e.pricePerCall <= q.maxPrice) // 预算匹配
    .sort((a, b) => b.reputation - a.reputation); // 信誉高的排前面
}

export function runDemo(): void {
  section("练习 5：服务目录按能力 / 链 / 预算 / 健康 / 信誉撮合");

  const directory: DirectoryEntry[] = [
    { name: "chain-reader-A", url: "https://a.example/a2a", capabilityTags: ["onchain-read"], chains: ["base-sepolia"], pricePerCall: 0, healthy: true, reputation: 92 },
    { name: "chain-reader-B", url: "https://b.example/a2a", capabilityTags: ["onchain-read"], chains: ["base-sepolia"], pricePerCall: 0, healthy: true, reputation: 78 },
    { name: "chain-reader-C-down", url: "https://c.example/a2a", capabilityTags: ["onchain-read"], chains: ["base-sepolia"], pricePerCall: 0, healthy: false, reputation: 99 }, // 健康检查挂了，即使信誉最高也不选
    { name: "eth-mainnet-reader", url: "https://d.example/a2a", capabilityTags: ["onchain-read"], chains: ["ethereum"], pricePerCall: 0, healthy: true, reputation: 95 }, // 链不匹配
    { name: "premium-analytics", url: "https://e.example/a2a", capabilityTags: ["onchain-read"], chains: ["base-sepolia"], pricePerCall: 50, healthy: true, reputation: 100 }, // 超预算
  ];

  const query: Query = { needCapability: "onchain-read", needChain: "base-sepolia", maxPrice: 0 };
  console.log("查询：能力=onchain-read，链=base-sepolia，预算=0（免费）\n");

  const results = search(directory, query);
  console.log(`撮合出 ${results.length} 个候选（按信誉降序）：`);
  for (const r of results) {
    verdict(true, `${r.name}  信誉=${r.reputation}  价=${r.pricePerCall}`);
    printKV("  url", r.url);
  }

  console.log("\n被筛掉的：");
  console.log("  chain-reader-C-down —— 健康检查失败（信誉再高也不派任务给挂掉的 agent）");
  console.log("  eth-mainnet-reader  —— 链不匹配（要 base-sepolia）");
  console.log("  premium-analytics   —— 超预算（要免费，它要 50）");
  console.log("\n要点：reputation 目前是 registry 自报的 fixture。生产里它应来自");
  console.log("      ERC-8004 Reputation 注册表——可携带、可验证、不由被查方自吹（见模块 9）。");
}

runIfMain(import.meta.url, runDemo);

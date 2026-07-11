# protocol-lab —— Layer 6 本地可运行练习

不联网、不调 SDK 网络接口、不需要 API key。用纯本地 TypeScript 把 Agent Card、JWS+JCS 验签、版本协商、协议路由、服务目录、互操作拒绝这些抽象概念**跑出数据**（`✅通过 / ⛔拒绝`）。

## 跑起来

```bash
pnpm install
pnpm demo:all      # 依次跑 01–06
```

单独跑：

```bash
pnpm demo:card       # 01 Agent Card 的结构与解析
pnpm demo:jws        # 02 JCS 规范化 + JWS 签名/验签（核心）
pnpm demo:version    # 03 A2A 版本协商 + v1.0 破坏性变更映射
pnpm demo:router     # 04 协议路由闸门（MCP / A2A / HTTP）
pnpm demo:directory  # 05 服务目录按能力/链/预算/健康/信誉撮合
pnpm demo:interop    # 06 互操作拒绝矩阵（发现链路完整闸门，带自断言）
pnpm check           # tsc --noEmit
```

## 每个 demo 学什么

| 脚本 | 学什么 | 对应正文 |
| --- | --- | --- |
| `01-agent-card.ts` | Agent Card 有哪些字段、结构校验拦什么 | 模块 4 |
| `02-jws-jcs.ts` | Signed Agent Card 怎么签、怎么验、篡改为什么会失败 | 模块 5（核心） |
| `03-version-negotiation.ts` | `A2A-Version` 协商、v1.0 枚举 kebab→SCREAMING_SNAKE | 模块 6 |
| `04-protocol-router.ts` | 一个目标多种触达时怎么选 MCP/A2A/HTTP | 模块 7 |
| `05-service-directory.ts` | 按能力/链/预算/健康/信誉撮合 agent | 模块 8 |
| `06-interop-rejection.ts` | 坏 Card 全拒绝（安全灵魂，带 8 条自断言） | 模块 8/10 |

## 边界（诚实标注）

- JWS/JCS 用 Node 内置 `crypto`（Ed25519）**手写演示原理**，不是生产密码库。生产请用经过测试的 JOSE / canonicalize 库。
- 服务目录是内存态教学实现；`reputation` 是 fixture，生产应来自 ERC-8004 Reputation 注册表（见正文模块 9）。
- 这套 lab 不依赖 `@a2a-js/sdk` / `@modelcontextprotocol/sdk`——真实 SDK 双进程 demo 在隔壁 `../agent-network/`。

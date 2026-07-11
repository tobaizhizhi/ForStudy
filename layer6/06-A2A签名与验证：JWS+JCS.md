# 模块 5（核心）：A2A 签名与验证 —— JWS + JCS

这是 Layer 6 的心脏。上一模块我们能解析一张 Agent Card 了，知道它有 `name`、`url`、`skills` 这些字段。但有一个致命问题还没解决：

> 我从某个地址拉回一张 Agent Card，凭什么相信这张卡真的是那个 agent 发的、内容一个字都没被人改过？

如果答不上来，整个 agent-to-agent 就是空中楼阁。因为一旦你**信了一张伪造的卡**，你会把任务、把钱、把私密的输入，派给一个冒充者。发现的第一道闸，不是"这张卡看起来对不对"，而是**密码学能不能证明它没被动过**。

> 目标：能给一张 Agent Card 上 JWS 签名、能验一张 Signed Agent Card、能说清 JCS 为什么不可省，并能写出一张坏卡的**拒绝矩阵**——未签名 / 验签失败 / 公钥不可信 / 错版本 / 过期，全部 ⛔。

## 5.1 先讲清楚：不验签的 Card = 谁都能冒充 agent

去中心化发现的本质是：你从一个**你不完全信任的地方**（一个 URL、一个注册表、别的 agent 转发）拿到一张卡。这条路径上任何一个环节，都可能：

- **整张伪造**：攻击者从零编一张卡，`name` 写成你信任的那个 agent，`url` 指向自己的端点。
- **中途篡改**：真 agent 发了一张真卡，但中间人把 `url` 改成攻击者的地址、往 `skills` 里偷加一个 `drainWallet`。

这两种攻击的收益都很直接：

```text
你信了伪造的卡  →  把"查余额"任务派给攻击者端点  →  任务里的地址/意图泄露
你信了篡改的卡  →  以为在调可信 agent，实际调的是攻击者改写过的能力/端点
后面还有支付层 →  一旦 agent 之间能自主付款，信错一张卡就是直接的资金损失
```

所以在**派任务之前**，必须有一步能回答"这张卡可信吗"。这一步不能靠肉眼（"名字对、字段齐、看起来像"），肉眼恰恰是攻击者最容易骗过的。它必须靠密码学：**签名验证**。

## 5.2 类比：Signed Agent Card = 带防伪芯片的证件

把 Agent Card 想成一张身份证件：

> 普通 Card（未签名）像一张**手写的名片**——上面写谁、写什么，全凭它自己说，谁都能印一张一模一样的。
>
> Signed Agent Card 像一张**带防伪芯片和签发机构签名的证件**：证件内容（卡的字段）+ 签发机构用私钥打的一个**防伪签名**。你验证的方式不是"看它像不像真的"，而是**用签发机构的公钥去核验那个签名**——签名只有持有对应私钥的人才能生成，且只要证件内容改动一个字节，签名立刻对不上。

这里有三个关键点，后面会反复用到：

1. **验证靠公钥，不靠"看起来像"**。名字、logo、字段都能仿造；能证明身份的只有"这个签名能被某把公钥验过"。
2. **签名覆盖全部内容**：改动卡里任何一个字段，签名都会失效。这挡住了"中途篡改"。
3. **公钥必须可信**：光验证"签名对得上公钥"还不够——攻击者可以用**自己的**私钥签一张卡、把自己的公钥附上，这样签名当然验得过。所以还要问一句"**这把公钥是不是我信任的签发者的**"。这一层 5.7 会专门讲，它是本章最容易被忽略、也最致命的一环。

## 5.3 两步机制：先 JCS 规范化，再 JWS 签名

要"对一张卡签名"，得先回答一个很基础但很要命的问题：**签的到底是哪一串字节？**

JSON 是个麻烦的东西——**同样的数据，可以有无数种等价写法**：

```text
{"a":2,"b":1}
{"b":1,"a":2}          ← key 顺序不同
{ "a": 2, "b": 1 }     ← 多了空格
{"a":2,"b":1,"nested":{"y":1,"x":2}}   ← 嵌套对象 key 顺序也不同
```

这些对**人**是一回事，对**签名**却是天壤之别：签名是对**字节**做的。签名方按一种写法算出签名，验证方若按另一种写法去还原字节，字节不一样，签名必然对不上——哪怕数据完全相同。

**JCS（JSON Canonicalization Scheme，RFC 8785）** 就是来消除这种歧义的：它把任意 JSON 规范化成**唯一的一串字节**。核心规则三条：

- **对象的 key 按码元升序排序**（递归到每一层嵌套对象）；
- **去掉所有非必要空白**；
- 数字、字符串按 RFC 8785 规定的形式序列化。

规范化之后，"同一份数据"无论原来怎么写，都收敛到**同一串字节**——签名才可复现、可验证。

然后是 **JWS（JSON Web Signature，RFC 7515）**：对"JCS 规范化后的字节"做密码学签名。我们的教学脚手架用 **Ed25519（alg=EdDSA）**，Node 内置支持，无需第三方库。

两步的分工，一句话记住：

```text
JCS 解决"签哪串字节"（消歧义，让字节唯一、可复现）
JWS 解决"这串字节谁签的、有没有被改"（密码学证明）
少了 JCS，JWS 就没有稳定的输入；顺序敏感，一步都不能省。
```

## 5.4 密集真实代码：JCS + 签名 + 验签

下面全部是脚手架 `protocol-lab/src/shared.ts` 里**实测跑通**的代码，不是伪码。

### JCS 规范化

```ts
// protocol-lab/src/shared.ts
export function jcsCanonicalize(value: unknown): string {
  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    // 数组：顺序【有意义】，原样递归，不排序
    return "[" + value.map((v) => jcsCanonicalize(v)).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort(); // ★ 关键：对象 key 升序排序
    const body = keys
      .map((k) => `${JSON.stringify(k)}:${jcsCanonicalize(obj[k])}`)
      .join(",");
    return "{" + body + "}"; // 无多余空白
  }
  throw new Error(`JCS 无法规范化的类型: ${typeof value}`);
}
```

注意这里有个初学者常踩的坑：**对象的 key 排序，但数组的元素顺序不排**。数组里 `[a, b]` 和 `[b, a]` 是不同的数据，排序会改变语义；对象的 `{a,b}` 和 `{b,a}` 才是同一份数据。JCS 只统一后者。

### 确定"签哪串字节"：signingInput

签名和验签必须喂同一串字节。我们签的是**卡去掉 `signature` 字段之后**的 JCS 规范化结果——因为签名本身不可能包含它自己：

```ts
// protocol-lab/src/shared.ts
/** 取 card 去掉 signature 后的部分，JCS 规范化。这是签名和验签的共同输入。 */
export function signingInput(card: AgentCard): string {
  const { signature: _omit, ...rest } = card;
  return jcsCanonicalize(rest);
}
```

### owner 侧签名：signCard

```ts
// protocol-lab/src/shared.ts
export function signCard(card: AgentCard, key: KeyPair): AgentCard {
  const protectedHeader = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWS" }));
  const payload = b64url(signingInput(card));                 // ← JCS 之后再 base64url
  const signingBytes = Buffer.from(`${protectedHeader}.${payload}`, "utf8");
  const sig = nodeSign(null, signingBytes, key.privateKey);   // ← Ed25519 私钥签名
  return {
    ...card,
    signature: {
      protected: protectedHeader,
      signature: sig.toString("base64url"),
      publicKeyPem: key.publicKeyPem,   // 教学简化：把签名者公钥内联进来
    },
  };
}
```

签名的输入是 `base64url(protected) + "." + base64url(payload)`，这正是 JWS 的**分离签名（detached）**形态——`protected` 头声明算法、`payload` 是我们规范化后的卡、`signature` 是对两者拼接的签名。

### client 侧验签：verifyCard

```ts
// protocol-lab/src/shared.ts
export function verifyCard(card: AgentCard): VerifyResult {
  const sig = card.signature;
  if (!sig) return { ok: false, reason: "Agent Card 没有 signature（未签名卡）" };

  let alg: string;
  try {
    const header = JSON.parse(Buffer.from(sig.protected, "base64url").toString("utf8"));
    alg = header.alg;
  } catch {
    return { ok: false, reason: "JWS protected header 解析失败" };
  }
  if (alg !== "EdDSA") return { ok: false, reason: `不支持的 alg: ${alg}` };

  // ★ 关键：验签时用【当前 card】重新算 JCS 规范化输入。
  //   只要 card 任何字段被篡改，signingInput 就变，验签必失败。
  const payload = b64url(signingInput(card));
  const signingBytes = Buffer.from(`${sig.protected}.${payload}`, "utf8");

  let pubKey: KeyObject;
  try {
    pubKey = createPublicKey(sig.publicKeyPem);
  } catch {
    return { ok: false, reason: "公钥 PEM 解析失败" };
  }

  const valid = nodeVerify(null, signingBytes, pubKey,
    Buffer.from(sig.signature, "base64url"));
  return valid ? { ok: true }
    : { ok: false, reason: "JWS 签名校验不通过（卡被篡改或非该公钥所签）" };
}
```

验签的灵魂是那句注释标出的一行：**验签时是拿"你现在看到的这张卡"重新跑一遍 JCS，再去核对签名。** 攻击者只要改了卡里任何一个字段，重算出来的 `signingInput` 就变了，签名和它对不上，直接判失败。攻击者没有私钥，改完卡也补不出一个新的有效签名。这就是篡改被挡住的机制。

### 完整演示：签发 → 验签 → 篡改后失败

`protocol-lab/src/02-jws-jcs.ts` 把上面几个函数串成一个可跑的 demo。核心片段：

```ts
// protocol-lab/src/02-jws-jcs.ts
// 1) JCS：同样的数据、不同的 key 顺序 / 空格，规范化后必须一致
const a = { b: 1, a: 2, nested: { y: 1, x: 2 } };
const b = { a: 2, nested: { x: 2, y: 1 }, b: 1 };
verdict(
  jcsCanonicalize(a) === jcsCanonicalize(b),
  "顺序无关：JCS 把它们规范化成同一串字节（签名才可复现）",
);

// 2) owner 侧：生成 Ed25519 密钥对，签一张卡
const key = generateEd25519();
const signed = signCard(baseCard(), key);

// 3) client 侧：验签
verdict(verifyCard(signed).ok, "原样的 Signed Agent Card");                 // ✅

// 篡改 url —— 想把 client 骗到攻击者端点
const tamperedUrl = { ...signed, url: "https://attacker.example/a2a" };
verdict(verifyCard(tamperedUrl).ok, "篡改 url（想导到攻击者端点）");         // ⛔

// 篡改 skills —— 偷加能力去骗任务
const tamperedSkill = {
  ...signed,
  skills: [...signed.skills, { id: "x", name: "drainWallet", description: "", tags: [] }],
};
verdict(verifyCard(tamperedSkill).ok, "篡改 skills（偷加能力）");            // ⛔

// 未签名卡
verdict(verifyCard(baseCard()).ok, "未签名卡");                            // ⛔

// 攻击者用自己的 key 自签 —— JWS 本身有效！
const attackerKey = generateEd25519();
const forged = signCard(baseCard(), attackerKey);
verdict(verifyCard(forged).ok, "攻击者用自己的 key 自签（JWS 本身有效）");   // ✅ ← 注意这里
```

跑它：

```bash
pnpm demo:jws
```

最后那条**故意留了个坑**：攻击者用自己的私钥签、把自己的公钥内联进去，`verifyCard` 会**通过**——因为"签名对得上它自带的那把公钥"这件事本身是成立的。这暴露了单靠 JWS 验签的盲区，5.7 的拒绝矩阵把这一层补上。

## 5.5 ASCII：签名与验签的数据流

```text
────────────────── owner 侧：签发 Signed Agent Card ──────────────────
  raw Agent Card                { "url":..., "skills":[...], "name":... }
        │  去掉 signature 字段
        ▼
  JCS 规范化 (RFC 8785)         key 排序 + 去空白 + 递归
        │
        ▼
  canonical bytes              唯一、可复现的一串字节
        │  base64url，拼 protected 头
        ▼
  sign(privateKey)  ──Ed25519──▶  signature (base64url)
        │
        ▼
  Signed Card = raw Card + { protected, signature, publicKey }


────────────────── client 侧：验签 ──────────────────
  收到的 Signed Card
        │  去掉 signature，对【当前卡】重新 JCS
        ▼
  canonical bytes'   ──┐
                       │  verify(publicKey, bytes', signature)
  signature ───────────┘
        │
        ▼
   ┌─────────────┴─────────────┐
   ▼                           ▼
 字节匹配 → JWS ✅ 通过      字节不匹配 → JWS ⛔ 失败
 （但公钥可信吗？见 5.7）    （卡被篡改 / 非此公钥所签）
```

## 5.6 对照表：JCS 与 JWS 各管什么

| | JCS（RFC 8785） | JWS（RFC 7515） |
| --- | --- | --- |
| 解决的问题 | JSON 有多种等价写法，签哪串字节？ | 这串字节谁签的、被改过吗？ |
| 输入 | 任意 JSON（去掉 signature 的卡） | JCS 规范化后的字节 |
| 输出 | 唯一、可复现的规范字节 | 分离签名（protected + signature） |
| 核心动作 | key 排序、去空白、递归 | 用私钥签、用公钥验 |
| 少了它会怎样 | 字节不稳定 → 同一张卡两次算出不同字节 → 验签随机失败 | 卡可被任意伪造 / 篡改，无从证明来源 |
| 顺序敏感 | ★ 是：多一个空格、少排一层，字节就变 | 依赖 JCS 的稳定输入 |

【学习提示】**JCS 是"顺序敏感、一步不能省"的**。很多验签失败的疑难杂症，根子都在这：签名方和验签方用了两套不完全一致的规范化（一方排了嵌套 key、一方没排；一方保留了 `undefined` 字段、一方过滤了）。所以**签名方和验签方必须用同一套 JCS 实现**，字节层面完全对齐。这也是为什么生产里**不要自己手搓 JCS**，要用经过测试向量校验的库（如 `canonicalize` / `rfc8785`）——我们脚手架的手写版是为了**讲透原理**，不是生产密码库。

## 5.7 互操作拒绝矩阵：本章的灵魂

到这里必须把 5.4 那个坑正面解决：**光验 JWS 不够**。一个健壮的发现闸门，要把坏卡在派任务之前**全部**挡下。脚手架 `protocol-lab/src/06-interop-rejection.ts` 把整条链路串成一个带**自断言**的拒绝矩阵——8 条用例，每条都断言"实际结果 == 预期"，全绿才算通过。

完整的发现闸门是**五道闸，顺序执行**：

```text
闸 1  结构校验     必需字段齐、url 是合法 http(s)、skills 非空     ← 缺字段 / 伪造内网 endpoint 拦这里
闸 2  JWS 验签      对当前卡重算 JCS，核对签名                      ← 未签名 / 被篡改 拦这里
闸 3  公钥可信      签名公钥必须在可信名单（DID/JWKS/ERC-8004）     ← 攻击者自签的有效 JWS 拦这里
闸 4  版本协商      用 client 请求的 A2A-Version，不是卡里印的       ← 版本不兼容 拦这里
闸 5  过期检查      expiresAt 不能早于 now                          ← 过期卡 拦这里
```

闸门本体（真实脚手架，`fullDiscoveryCheck`）：

```ts
// protocol-lab/src/06-interop-rejection.ts
function fullDiscoveryCheck(card, ctx, requestedVersion) {
  // 闸 1：结构
  const shape = validateCardShape(card);
  if (!shape.ok) return shape;

  // 闸 2：JWS 验签（卡被篡改 / 未签名 → 挂）
  const sig = verifyCard(card);
  if (!sig.ok) return sig;

  // 闸 3：公钥必须在可信名单里（挡住"攻击者用自己 key 自签"的有效 JWS）
  const pub = card.signature.publicKeyPem;
  if (!ctx.trustedPublicKeys.has(pub)) {
    return { ok: false, reason: "签名公钥不在可信名单（自签卡：JWS 有效但签发者不可信）" };
  }

  // 闸 4：版本协商（用 client 请求的版本，不是卡里印的版本）
  const ver = negotiateVersion(requestedVersion);
  if (!ver.ok) return ver;

  // 闸 5：过期检查
  if (card.expiresAt !== undefined && card.expiresAt < ctx.now) {
    return { ok: false, reason: `Agent Card 已过期（expiresAt=${card.expiresAt} < now=${ctx.now}）` };
  }
  return { ok: true };
}
```

这 8 条用例的判定，就是本章要背下来的拒绝矩阵：

| # | 卡的状态 | 被哪道闸拦下 | 判定 |
| --- | --- | --- | --- |
| 1 | 结构全 + owner 签 + 版本 1.0 + 未过期 | —— 全部通过 | ✅ 放行 |
| 2 | 缺字段（`url` 是 `undefined`） | 闸 1 结构 | ⛔ 拒绝 |
| 3 | 被篡改（`url` 改成 evil.example） | 闸 2 JWS 验签 | ⛔ 拒绝 |
| 4 | 未签名卡（没有 signature） | 闸 2 JWS 验签 | ⛔ 拒绝 |
| 5 | 攻击者自签（JWS 有效、公钥不可信） | 闸 3 公钥可信 | ⛔ 拒绝 |
| 6 | 版本不兼容（请求 0.3，只支持 1.0） | 闸 4 版本协商 | ⛔ 拒绝 |
| 7 | 过期卡（`expiresAt < now`） | 闸 5 过期检查 | ⛔ 拒绝 |
| 8 | 伪造 endpoint（`url` 指向 169.254.169.254 内网地址） | 闸 1 结构 | ⛔ 拒绝 |

其中 **#5 是全章最重要的一条**：攻击者自签的卡，JWS **验得过**（闸 2 放行），却在闸 3 被"公钥不在可信名单"拦下。所以**验签 ≠ 可信**——验签只证明"这张卡由某把私钥签、且没被改"，而**"某把"是不是你信任的那把**，得靠公钥比对可信来源（DID document、JWKS、或 ERC-8004 身份注册表）。少了闸 3，任何人自签一张卡就能冒充任意 agent，前面所有验签都白做。

跑它，8 条自断言全绿：

```bash
pnpm demo:interop
```

## 5.8 真实 demo 里的验签：agent-network/src/client.ts

前面是本地不联网的 `protocol-lab`。真实三进程 demo `agent-network/` 里，client 拉一张**真的从 HTTP 端点取回**的 Agent Card，验签逻辑同一套原理，只是字段名对齐了 `@a2a-js/sdk` 的形状——SDK 的 `AgentCard` 用的是 **`signatures` 数组**（`AgentCardSignature[]`），公钥内联在 `signatures[0].header`：

```ts
// agent-network/src/client.ts
export function verifySignedCard(card: AgentCard): { ok: boolean; reason?: string } {
  const sigs = (card as AgentCard & { signatures?: any[] }).signatures;
  if (!sigs || sigs.length === 0) return { ok: false, reason: "未签名卡（没有 signatures）" };
  const sig = sigs[0];
  const pem = sig.header?.publicKeyPem as string | undefined;
  if (!pem) return { ok: false, reason: "签名里没有公钥（教学内联字段缺失）" };

  // 关键：验签时用【当前卡】去掉 signatures 后重算 JCS —— 篡改任何字段都会失败。
  const { signatures: _omit, ...rest } = card as AgentCard & { signatures?: any[] };
  const payload = Buffer.from(jcs(rest)).toString("base64url");
  const signingBytes = Buffer.from(`${sig.protected}.${payload}`);
  try {
    const valid = nodeVerify(null, signingBytes, createPublicKey(pem),
      Buffer.from(sig.signature, "base64url"));
    return valid ? { ok: true }
      : { ok: false, reason: "JWS 校验不通过（卡被篡改或非该公钥所签）" };
  } catch (e) {
    return { ok: false, reason: `验签异常：${(e as Error).message}` };
  }
}
```

client 的主流程里，验签是**派任务前的硬闸门**——不过就直接返回，绝不把任务派给一张验不过的卡：

```ts
// agent-network/src/client.ts（main 节选）
const card = await fetchAgentCard(A2A_BASE_URL);   // 拉 /.well-known/agent-card.json
const verified = verifySignedCard(card);
console.log(`[client] Agent Card 验签: ${verified.ok ? "✅ 通过" : "⛔ 拒绝 —— " + verified.reason}`);
if (!verified.ok) {
  console.log("[client] 未通过验签，拒绝把任务派给它（避免调用伪装 agent）。");
  return;   // ★ 验不过就到此为止
}
// 验过了，才用 ClientFactory + createFromUrl 建 client、sendMessage 派任务
```

签名这一步在 agent 侧是**可开关**的：`agent-network/src/config.ts` 里的 `SIGN_AGENT_CARD`（默认开）。把它关掉，agent 就发一张**未签名卡**，正好用来演示"client 拒绝未签名卡"这条闸：

```bash
# 默认：agent 发 Signed Card，client 验签 ✅ 通过后派任务
pnpm start:agent

# 关掉签名：agent 发未签名卡，client 会 ⛔ 拒绝、不派任务
SIGN_AGENT_CARD=false pnpm start:agent
```

## 版本核验与边界（务必读）

- **JCS 顺序敏感，一步都不能省**。签名方与验签方必须用**逐字节一致**的规范化实现；嵌套对象的 key 也要排、`undefined` 字段的处理要一致，否则同一张卡两边算出不同字节、验签随机失败。
- **本层的 lab / demo 用 Node 内置 `crypto` 手写 JWS/JCS，是为讲原理，不是生产 JOSE 库**。生产请用经测试向量校验的库：JWS 用成熟 JOSE 实现（如 `jose`），JCS 用 `canonicalize` / `rfc8785`。教学版没做 JWS 的全部安全细节（如 `alg` 白名单外的攻击面、`crit` 头处理等）。
- **教学把签名者公钥内联在卡里**（`signature.publicKeyPem` / `signatures[0].header.publicKeyPem`），省掉了 DID document / JWKS 解析这一步。**真实系统里公钥必须来自可信来源**（DID、JWKS、ERC-8004 身份注册表），且必须做 5.7 的**闸 3 公钥可信**比对——否则自签卡照样能冒充。
- **概念按 A2A v1.0，代码按 SDK 当前版本**。这是本层反复强调的落差：A2A 协议已发布 **v1.0**（Signed Agent Card、JWS+JCS 的信任模型都是 v1.0 的表述），但实测 `@a2a-js/sdk@0.3.14` 实现的是 **spec v0.3.0**。所以：
  - `protocol-lab` 的卡按概念用 `protocolVersion: "1.0"`；
  - `agent-network` 走 SDK，真实卡里 `protocolVersion` 是 **`"0.3.0"`**（见 `a2a-agent-card.ts`），签名字段用 SDK 形状的 **`signatures` 数组**而非 lab 的 `signature` 单对象。
  - `@a2a-js/sdk` 对 Signed Card 的字段与校验支持**以当前包为准**；本 demo 里签名是我们自己用 `SIGN_AGENT_CARD` 开关驱动的教学实现，**不代表 SDK 内置了完整的 Signed Card 验签**。动手前以当前 npm 包的类型定义为准。
- **Agent Card 默认路径**是 `/.well-known/agent-card.json`（client 就从这里拉卡）。

## 本模块小结

- 不验签的 Agent Card = 任何人都能冒充 agent 骗任务、骗钱；发现的**第一道闸是密码学**，不是肉眼。
- Signed Agent Card = 卡内容 + JWS 分离签名 + 签名者公钥；验证靠**公钥核验签名**，不靠"看起来像"。
- 两步机制：**JCS（RFC 8785）先把 JSON 规范化成唯一字节**（key 排序、去空白、递归，**顺序敏感**）→ **JWS（RFC 7515）对这些字节签名**。少了 JCS，JWS 没有稳定输入。
- 验签的机制：拿**当前这张卡**重算 JCS 再核对签名——改动任何字段，字节就变，签名对不上，篡改被挡。
- **验签 ≠ 可信**：攻击者自签的卡 JWS 验得过；必须再做**公钥可信比对**（可信名单 / DID / JWKS / ERC-8004）才挡得住冒充。这是拒绝矩阵里最致命的一条。
- 完整拒绝矩阵五道闸：**结构 → JWS 验签 → 公钥可信 → 版本协商 → 过期**；未签名 / 篡改 / 自签 / 错版本 / 过期 / 伪造 endpoint 全部 ⛔。
- 真实 demo 里验签是**派任务前的硬闸门**（`client.ts` 验不过就 return）；签名由 `SIGN_AGENT_CARD` 开关驱动。
- 边界诚实标注：lab 是手写演示非生产密码库；概念按 v1.0、代码按 SDK v0.3.x；公钥内联是教学简化。

## 复习题

1. 用一句话说清：为什么"不验签的 Agent Card"在 agent-to-agent 场景里是致命的？举出"整张伪造"和"中途篡改"各一个具体攻击后果。
2. Signed Agent Card 里，签名覆盖的是卡的哪一部分？为什么签名前要先**去掉 `signature` 字段**？
3. JCS 和 JWS 各自解决什么问题？如果**跳过 JCS**直接对原始 JSON 字节签名，会出什么问题？
4. `jcsCanonicalize` 里对**对象的 key 排序**，却对**数组元素不排序**。为什么这两者要区别对待？
5. `verifyCard` 验签时，为什么要用"**当前收到的卡**"重新算一遍 JCS，而不是直接信卡里带的某个字节？这一步是怎么挡住篡改的？
6. 攻击者用**自己的私钥**签一张卡、把**自己的公钥**内联进去。`verifyCard`（只做 JWS 验签）会通过还是失败？为什么？这暴露了什么盲区？
7. 承接上题：拒绝矩阵里哪一道闸专门拦这种"自签的有效 JWS"？它靠什么来判断公钥可不可信？真实系统里这个"可信名单"通常来自哪里？
8. 列出完整发现闸门的**五道闸及其顺序**。为什么"版本协商"要用 **client 请求的版本**、而不是卡里印的 `protocolVersion`？
9. 一张卡的 `url` 被改成 `http://169.254.169.254/a2a`。它会被哪道闸拦下？把它同时改成未签名，又会先被哪道闸拦下？
10. 为什么说 `protocol-lab` / `agent-network` 里手写的 JWS/JCS **不能直接用于生产**？生产分别该用什么替代？
11. 概念上讲 A2A v1.0、代码上 SDK 是 v0.3.x：这个落差在 `protocol-lab` 的卡和 `agent-network` 的真实卡里，分别体现在 `protocolVersion` 和"签名字段名"上的什么差异？
12. `SIGN_AGENT_CARD=false pnpm start:agent` 会发生什么？client 侧会走到拒绝矩阵的哪一道闸、结果如何？

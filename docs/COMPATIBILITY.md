# dsh-context-lens 兼容性实测

> **配套文档**：[PLAN.md](../PLAN.md)（计划 / 架构 / 规范来源）、[TASKS.md](../TASKS.md)（进度与证据台账）
> **本文件职责**：一份事实一个家 —— PLAN.md 拥有**计划**，本文件拥有**已实测的兼容性事实**。
>
> 最后更新：2026-09-18 ｜ 实测者环境：WSL2 + Windows 侧 dsh `0.1.5-rc.1`

本文件只写**已经跑过的命令与观察到的结果**。未验证的一律标 ⬜ 待验证，绝不写成已通过。

---

## 1. 目标版本

| 版本 | 位置 | 状态 |
|---|---|---|
| dsh `0.1.5-rc.1` | 本机运行版（Launcher home `...\in.dsh-plug.dsh-launcher\homes\0.1.5-rc.1`） | ✅ **主目标，全部实测针对它** |
| dsh `0.1.5-rc.2` | npm `@deepseek-ai/dsh@0.1.5-rc.2` 装进临时目录（`D:\DSH\_plugintest\rc2`） | ✅ **装载矩阵已跑通**（见 §11） |
| dsh `0.1.2-alpha.1` | `D:\DSH\deepseek-harness-dev` | ❌ **不是目标**，仅作存在性交叉验证 |

### ⚠️ 关于本机 `D:\DSH\deepseek-harness` 检出树

该检出树的**发布 tag 是 `1ef9c1fa9a`（0.1.5-rc.1）**，但工作区额外带了发布之后的提交
`be531688f3`（"refactor(client): migrate consumers and remove Runtime"）。差异**仅限**两处：

1. `packages/client/web/src/platform.ts` —— 工作区已把 `PRELOADED_CLIENT_EXTERNALS` 清空为 `[]`；
2. `packages/client/runtime/*` —— 工作区已删除。

**其余全部契约文件（五个投影键、`useProjection`、槽位、locale、`ContextMeter`、token 计量）
经逐文件 md5 比对与 tag `1ef9c1fa9a` 完全一致。**

**结论（已实测，与上述工作区状态相反）**：运行中的 rc.1 前端 bundle
（`@deepseek-ai/dsh-web-frontend@0.1.5-rc.1/dist/assets/index-DuF6ti6g.js`）里
**不存在任何 `@deepseek-ai/dsh-client-runtime/client` 字面量**；其 seed table 恰好是下述九个
基线模块；并且本机 40 个已安装客户端 bundle 中，**0 个** require 该 runtime 预载。
因此「rc.1 预载了 runtime external」这一说法**对运行版不成立**，本插件按基线表设计。
该结论已由 `tests/externals.spec.mjs` 固化为断言，而不是停留在散文里。

---

## 2. 平台基线外部模块（唯一可 require 的白名单）

动态浏览器 bundle 的每个裸 `require()` 都对着 shell 冻结的 seed table 解析。表外说明符会在
**物化期**抛错 —— 也就是在用户浏览器里、装完之后才炸。

运行版 rc.1 的实际 seed table（逐字取自 `index-DuF6ti6g.js`）：

```js
"react", "react/jsx-runtime", "react-dom", "react-dom/client",
"@deepseek-ai/cordis",
"@deepseek-ai/dsh-client-store",
"@deepseek-ai/dsh-client-ui-slots",
"@deepseek-ai/dsh-client-ui-primitives",
"@deepseek-ai/dsh-client-ui-dockkit"
```

**九个，仅此九个。** 据此明确几条容易被误传的事实：

| 常被误认为可 require | 事实 |
|---|---|
| `@deepseek-ai/dsh-client-locale` | ❌ **不是基线可 require 项**。`t` 是**组件 prop**，由注册时声明 `locale: <NS>` 得到。 |
| `useProjection` | ❌ **根本不是模块**。它是**组件 prop**（session scope 的「第五个 hook 座位」），只以类型形式存在于 `@deepseek-ai/dsh-api-session-controller/client`。 |
| `@deepseek-ai/dsh-client-runtime/client` | ❌ 运行版 seed table 中不存在（见 §1）。非预载的第三方 bundle 也不应请求它。 |
| 作用域裸名 `cordis` | ❌ 正确说明符是 `@deepseek-ai/cordis`。 |

**本插件的外部依赖 = 仅 `react`。** 物化期实际只 touch 这一个外部（`tests/externals.spec.mjs` 断言）。
`package.json` **不含** `dsh.client.external`。

---

## 3. 能力矩阵（实测）

| 能力 | 提供方 | 键名 / 接口 | 本项目如何使用 | 状态 |
|---|---|---|---|---|
| 上下文压力 | `@deepseek-ai/dsh-token-meter` | 投影 `contextPressure`：`pressureTokens?` / `projectedTokens?` / `contextWindow?`（**三者皆可选**） | 占用率、剩余量、轮数估算 | ✅ |
| 三段构成 | 同上 | 投影 `contextBreakdown`：`systemTokens` / `toolsTokens` / `messageTokens`（**均必需**，启发式，**故意不等于** `projectedTokens`） | 堆叠构成条 + 图例 | ✅ |
| token 用量 | 同上 | 投影 `tokenUsage`：`uncachedInputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens`（均必需） | 缓存经济性行、命中率 | ✅ |
| 会话统计 | `@deepseek-ai/dsh-session-stats` | 投影 `sessionStats`：`turns` / `steps` / `llmMs` / `toolMs` / `ttftMs` / `ttftSteps` / `decodeMs` / `decodeTokens`（均必需，ms 为毫秒） | 面板头部概览 | ✅ |
| 投影取值 | `@deepseek-ai/dsh-api-session-controller` | `ctx.sessions.binding(id).session.projections.faceOf(key)` → 快照或 **`undefined`** | 面板**自行绑定**（见 §4） | ✅ |
| 宿主计量 | `@deepseek-ai/dsh-token-meter` | `ctx.tokenMeter.measure(session, requestHeader?)` → `{ logRevision, baseline, surfaceDeltaTokens, totalTokens, surfaceTokens, nodes[] }` | 时间线采样（宿主半，边界事件驱动） | ✅ |
| 页脚动作位 | `ui-sidebar` | 槽位 `sidebar.footer.action`：kind `list`、scope **`root`**、owner `{ wide: boolean }` | 面板入口，**新 list id = `context-lens`** | ✅ |
| 右侧栏 tab | `ui-sidebar-right` | `ctx.sidebarRightTabs.register(def)` + keyed 槽位 `sidebar.right.pane.tab` / `.title`，scope `session` | 可停靠页 | ✅ |
| 设置分区 | `ui-settings` | 槽位 `settings.section`：kind `list`、scope `root` | 可调项卡片 | ✅ |
| 文案 | `@deepseek-ai/dsh-client-locale` | `ctx.locale.register(NS, { zh, en })`，组件经 prop `t` 取用 | zh / en 各 90 键 | ✅ |
| 样式注入 | 构建期惯例 | `data-plugin` / `data-plugin-css` 标签约定 | 沿用以让 HMR 可盘点/移除 | ✅ |

**关于 `measure()` 的代价**：官方文档明确其为 **O(surface)**（每次调用克隆位置节点集），
且**没有 revision 参数** —— 它只读**当前** durable tail。因此**无法事后回放历史时间线**。
本插件的处置：只在 `step/end`、`turn/end`、`compaction/start`、`compaction/summary` 边界采样，
受 Config 上限约束，并且 payload 恒带 `coverage: 'observed-since-plugin-load'`。

---

## 4. 数据路径：为什么面板自行绑定投影

`sidebar.footer.action` 是 **root** scope，而 `useProjection` 是 **session** scope 的组件 prop。
root 座位**永远拿不到** `useProjection`，且它也不是可 require 的模块。因此本插件：

1. `src/client/views/source.cjs` 读 `ctx.sessions.list.getSnapshot().current` 取当前会话；
2. 解析 `ctx.sessions.binding(id).session.projections.faceOf(key)` 并订阅；
3. 通过注入 **`hooks` 舱**把一个裸 observable（`getSnapshot` / `subscribe`）交给组件；
4. 渲染器把它绑成 `useContextLens` prop。

这是官方 `ui-goal` 的同一模式，也是「注册方私有响应式事实」的合规通道。

> **红线遵守**：宿主半**完全不声明 `inject`**（连 `inject = []` 都没有）。`webServer` 与
> `tokenMeter` 一律经 `ctx.get(...)` 探测。这是 `D:\DSH\AGENTS.md` 的 TUI profile 红线。

---

## 5. 降级矩阵（L0–L4，已实现且已测）

每个可选能力都能**单独**失效。缺一个只关掉**一个座位**，不拖垮整个插件。

| 级 | 缺失能力 | 实际行为 | 落点 | 测试 |
|---|---|---|---|---|
| L0 | 无 | 注册全部座位：页脚动作 + 可停靠页 + 设置分区 | `src/client/index.cjs` | `degrade.spec.mjs` |
| L1 | 无 `sidebarRightTabs` | **跳过** tab 类型 / body / title；页脚动作与设置分区**不受影响** | `views/tab.cjs` | `degrade.spec.mjs` |
| L2 | 无 `sessions` | **跳过** 页脚动作与可停靠页（二者依赖会话数据）；字典型与样式**照常注册**；记一条 debug 日志说明为何跳过 | `src/client/index.cjs` | `degrade.spec.mjs` |
| L2' | 无 `settings` 服务 | 设置分区**仍挂载**，但如实报 `available: false`（**不伪造已保存值**）；`subscribe` 是合法 no-op | `views/settings.cjs` | `degrade.spec.mjs` |
| L3 | 无 `contextPressure` | 占用率区显示「不可用」，**不画 0% 环**（0% 是确信的谎言） | `model/index.cjs` | `consistency.spec.mjs` |
| L3' | 缺 `contextBreakdown` | 构成区不可用；**绝不编造总量**（官方已声明启发式与 provider 锚点本就不相等） | `model/index.cjs` | `consistency.spec.mjs` |
| L4 | 宿主无 `tokenMeter` | 采样器**不订阅**任何事件；路由返回 **503 `token-meter-unavailable`**；面板说明该能力不可用 —— **不静默返回空图** | `src/host/timeline.js` | `host.spec.mjs` |
| L4' | 宿主无 `webServer` | 宿主半**不注册任何路由**，只注册 recorder effect（真实 cordis `Context` 直载实测通过） | `src/host/index.js` | `host.spec.mjs` + §7 实测 |

---

## 6. 规范核对表

| 编号 | 要求 | 落点 | 状态 |
|---|---|---|---|
| B1 | 具名导出 `name` / `Config` / `apply`，无 default export | `src/host/index.js` | ✅ `check.mjs` 断言 |
| B2 | `dsh.bundle.patch` → `cordis.patch.yml`，insert 行用包名 | `cordis.patch.yml` | ✅ |
| B3 | `dsh.client = { platform: 'web' }` + `exports["./client"]` | `package.json` | ✅ |
| B4 | `window.__ModuleLoader__.load({ id, factory })` | `lib/client.js`（`build.mjs` 生成） | ✅ `externals.spec.mjs` |
| B5 | 只用基线隐式外部模块 | 仅 `react` | ✅ `externals.spec.mjs` 断言 |
| B6 | **不用** `dsh.client.external` | `package.json` 无该键 | ✅ 断言 |
| B7 | 注册走 `ctx.effect()` / `ctx.slots.inject()` | `src/client/index.cjs`、`tab.cjs` | ✅ |
| B8 | 可选服务一律 `ctx.get(name)` | `index.cjs`、`tab.cjs`、`host/index.js` | ✅ |
| B9 | 可调项全进 `Config` 并校验 | `src/host/config.js`（5 项，含范围） | ✅ `host.spec.mjs` |
| B10 | 非法 Config **加载期抛错** | `validateConfig` 抛错，含未知键 | ✅ `host.spec.mjs` |
| B11 | 分发三态（npm / tarball / GitHub + allowBuilds） | `README.md` §Install | 🟡 tarball ✅ / GitHub 直装 ✅ / npm ⬜ 待发布 |
| C1 | `ctx.slots.inject(key, () => ctx.slots.register(...))` | `index.cjs`、`tab.cjs` | ✅ |
| C2 | 逐个确认槽位 cardinality / scope | 本文 §3 | ✅ |
| C3 | 组件只吃 share，组件文件不出现 `ctx` | `views/panel.cjs`、`tab.cjs` 等 | ✅ |
| C4 | 无运行期跨特性插件 import | 只 require 内部模块 + `react` | ✅ `externals.spec.mjs` |
| C5 | 全部文案进 typed locale 字典 | 90 键 ×2，键集相等有断言 | ✅ `bundle.spec.mjs` |
| C6 | 只用 `--dsw-*` token；中性边框 0.5px；elevation 不叠 border | `styles.cjs` | ✅ 三条断言 + **反向验证** |
| C7 | 无模块级副作用 | 插件体内只**定义**函数；注射发生在 `apply` 内 | ✅ |
| C8 | 「改客户端代码必须重建 bundle」写进 README | `README.md` §Build requirements | ✅ |
| C9 | 右侧栏 tab 走 `ctx.sidebarRightTabs.register` + keyed 槽位 | `views/tab.cjs` | ✅ |
| C10 | 宿主→客户端优先走会话投影 wire 视图 | 四个投影键；唯一例外是时间线（§3 已说明） | ✅ |
| H1 | 精确路由 + peer socket loopback 围栏 + 405 | `src/host/fence.js` | ✅ 对抗性测试 |
| H2 | 不新增模型可见内容、不碰 session 事件表、不改 agent-loop | 宿主半纯只读 | ✅ |
| H3 | 宿主半**不 declare** `webServer` | 无 `inject` 导出 | ✅ `check.mjs` + 实测 |

---

## 7. 可复跑验证命令

测试运行于 Node ≥ 22（实测 `v22.23.1`）。

```sh
node scripts/build.mjs            # 产出 lib/index.js（宿主 4 模块）+ lib/client.js（客户端 11 模块）
node scripts/check.mjs            # 25 条 manifest / 合规断言 → 25 passed, 0 failed
node --test "tests/*.spec.mjs"    # 78 tests / 78 pass / 0 fail
```

各命令断言的内容：

- **`build.mjs`** —— 把 `src/host/**` 复制进 `lib/host/`，把 `src/client/**/*.cjs` 包成
  惰性 CJS 闭包工厂。**改 `src/client/**` 不重建就不生效。**
- **`check.mjs`** —— 类型检查管不到的规则：`exports` 存在、bundle 用 `__ModuleLoader__`、
  bundle id == 包名、factory 接收 `require`、宿主入口确实再导出、宿主无裸运行时 import、
  `type: module`、无 `dsh.client.external`、patch 行命名包名、`files` 覆盖 `lib/` 与
  `cordis.patch.yml`、**无字面色值**、**无 `export default`**、**宿主不声明服务**，
  以及三条样式断言（自定义属性仅 token / 每个 `var()` 可解析 / elevation 不叠 border）。
  这三条样式断言已**逐条反向验证**：人为注入违规必然 FAIL。
- **`node --test`** —— 模型层纯函数（含敌意输入）、与官方公式的**逐值一致性**、
  宿主围栏的对抗性用例、降级矩阵、外部模块契约。
  套件在 **Windows 与 Linux 上均已跑通 `78 tests / 78 pass / 0 fail`**（Windows
  node `v24.15.0`、WSL2 node `v22.23.1`）。两个 spec 用 `pathToFileURL()` 动态
  import 被测模块 —— 直接传 `resolve()` 的 Windows 原生路径会被 ESM loader 当成
  `d:` scheme 拒绝（`ERR_UNSUPPORTED_ESM_URL_SCHEME`），且是**模块加载期抛错**，
  整文件 36 个用例全部丢失。修好前 Windows 上的结果是 `44 tests / 42 pass / 2 fail`。

### 装载 / 卸载实测配方（已实跑）

```sh
# 1) 建一个临时 DSH_HOME 并从中派生一个「自定义」profile
#    （关键：不能用 web —— 见下方坑 1）
# 2) 把本仓库以依赖 + bundle 行的形式装进该 profile
# 3) 导出组合配置，确认出现我们这一层
dsh --profile <自定义名> --dump-config | grep -A2 '^# == dsh-context-lens'
# 4) 移除依赖与 bundle 行，再跑一次，确认计数归零
```

实测结果：**装载**时输出

```
# == dsh-context-lens
- id: context-lens
  name: dsh-context-lens
```

**卸载**后同一命令中 `context-lens` 计数 = **0**，无残留。

排查过程中踩到并记录在案的坑（都值得后来者省几小时）：

1. **`web` 是内置模板名。** `--profile web` 会解析内置模板并**忽略**临时 `DSH_HOME`，
   于是任何「装进临时 home 再看 `--dump-config`」都会得到**假阴性**。必须用**自定义** profile 名。
   （同理，`--dump-config` 对内置 profile 名不读用户层。）
2. **WSL 下环境变量传不进 Windows 侧进程。** 需 `WSLENV=DSH_HOME` 前缀，
   或在同一条 `powershell.exe -Command` 内设置 `$env:DSH_HOME`。
3. **WSL 的 `ln -s` 对 Windows node 不可解析**（报 `cannot resolve profile bundle`）。
   用 PowerShell `New-Item -ItemType Junction` 建目录联接。
4. **可用的内置模板只有** `acp` / `headless` / `sdk` / `sdk-minimal` / `web`；**没有 `tui`**。

### 非 web profile 安全（红线）实测

用 `--from-default-profile headless` 派生一个**非 web** profile 装入本插件：

- `--dump-config` 正常输出我们的层，**无 pending、无 missing service、无错误**；
- 更强的证据：用**真实 cordis `Context`** 直接加载宿主半（既无 `webServer` 也无 `tokenMeter`），
  结果 `inject = undefined`，只注册一条 effect `context-lens: timeline recorder`，**不抛错**。

---

## 8. 已知风险与未决项

| # | 风险 | 处置 / 现状 |
|---|---|---|
| R1 | rc.2 可能移动槽位或投影 | ✅ **已实测**：rc.2 的九项基线表、三个槽位、四个投影键与 tokenMeter 均未变（§11）。仍只依赖已文档化的 key，能力一律探测，分级降级（§5） |
| R2 | `measure()` 为 O(surface) | 仅边界事件采样 + `maxSamples` 上限 + 超限上报 `truncated`，绝不逐 revision |
| R3 | 时间线只覆盖插件加载后的事件 | payload 恒带 `coverage: 'observed-since-plugin-load'`，UI 明确标注「部分覆盖」，绝不暗示完整 |
| R4 | `conversation.view` 对第三方是否开放**未确认** | 前置条件不满足，**不实现**；PLAN P8 标注 |
| R5 | 四个投影的字段并非同一时刻的原子观测 | 口径徽标标明「供应商实报 / 启发式估算」，并声明「切换模型时压力与容量可能不同源」。**锚点本身不在投影键里**：它由宿主采样器写在每个时间线采样点上，客户端取**最新采样点**判定（`newestBaselineKind`）；宿主半未挂载（无采样）时如实报第三态「无锚点」，不猜测 |
| R6 | 浏览器实际渲染、键盘焦点、深浅色**无头环境无法代验** | 一律标 ⬜ 待人工；**不在本文件声称已渲染** |

---

## 9. 证据台账摘要

| 验证项 | 命令 / 操作 | 结果 |
|---|---|---|
| 构建 | `node scripts/build.mjs` | ✅ 宿主 4 模块 / 客户端 11 模块 |
| 合规 | `node scripts/check.mjs` | ✅ 25 passed, 0 failed |
| 单测 | `node --test "tests/*.spec.mjs"` | ✅ 78 passed, 0 failed（Windows `v24.15.0` 与 WSL2 `v22.23.1` 双平台） |
| 装载 | 自定义 profile + `--dump-config` | ✅ 出现 `# == dsh-context-lens` 层 |
| 卸载无残留 | 移除依赖后重跑 | ✅ 计数 = 0 |
| 非 web 安全 | headless profile + `--dump-config` | ✅ 出层，无 pending |
| 非 web 激活 | 真实 cordis `Context` 直载 | ✅ 仅 recorder effect，不抛错 |
| 外部模块契约 | 从**运行版**前端 bundle 提取 seed table 比对 | ✅ 仅需 `react`；九项基线表 |
| 数值一致性 | 重写官方公式逐值比对 | ✅ 一致，**并抓出 2 个真实缺陷**（已修） |
| GitHub 安装 | 公开仓库 → `github:` URL 装进全新 profile | ✅ 端到端通过（含 `allowBuilds` 放行与 `prepack` 构建） |
| rc.2 装载矩阵 | npm 装 rc.2 → 其 CLI 派生 profile → 装载 | ✅ 通过（§11） |
| 浏览器渲染 / 截图 | — | ⬜ 待人工 |
| npm 安装 | — | ⬜ 待 npm 发布（D3） |

---

## 10. GitHub 直装：实测配方与一处易错点

仓库已发布：**https://github.com/yukitakasama/dsh-context-lens**（公开，topic 含 `dsh-plugin`）。

```sh
dsh plugin --profile <名> add github:yukitakasama/dsh-context-lens
```

**首次安装会失败**，报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`。这是**预期行为**，
不是缺陷：git 安装取到的是源码而非构建产物（`lib/` 在 `.gitignore` 里），所以本包带
`prepare` 脚本要在用户机器上真实构建，而 pnpm ≥ 10 默认拒绝执行 git 依赖的构建脚本。

**易错点**：要抄进 `pnpm-workspace.yaml` 的键**不是裸包名**，而是 pnpm 打印的那一整行，
它带**已解析的 commit SHA**：

```yaml
allowBuilds:
  dsh-context-lens@git+https://github.com/yukitakasama/dsh-context-lens.git#<resolved-sha>: true
```

用裸包名 `dsh-context-lens: true` **不生效**，会继续报同一个错。

之后 `pnpm install` 输出 `npm-run-prepack: Done`，`lib/` 在 profile 的 `node_modules`
里被构建出来，`--dump-config` 随即解析出 `# == dsh-context-lens` 层（第 540–542 行）。
安全含义：该放行键自带 SHA，等于内建了版本钉住。

---

## 11. 双版本矩阵（rc.1 + rc.2，均已跑通）

rc.2 **已实测**：`npm install @deepseek-ai/dsh@0.1.5-rc.2` 装进临时目录，用它**自己的 CLI**
派生一个自定义 profile，把本插件以依赖 + bundle 行装进去，再 `--dump-config`。

| 检查项 | rc.1 | rc.2 | 结论 |
|---|---|---|---|
| 本插件装载（`# == dsh-context-lens` 出层） | ✅ | ✅ **无 error、无 pending** | 同一份构建产物两端都装得上 |
| 基线 seed table 九项 | ✅ | ✅ **完全相同** | 外部模块契约未变 |
| 是否出现 `dsh-client-runtime/client` 预载 | ❌ 无 | ❌ 无 | 第三方便携包本就不该请求它 |
| `contextPressure` / `contextBreakdown` / `tokenUsage` | ✅ | ✅ 仍注册 | 占用率与构成不受影响 |
| `sessionStats` | ✅ | ✅ 仍在 `dsh-session-stats` | 面板头部概览不受影响 |
| 槽位 `sidebar.footer.action` | ✅ | ✅ 4 个文件引用 | 页脚动作座位仍在 |
| 槽位 `sidebar.right.pane.tab` | ✅ | ✅ 16 个文件引用 | 可停靠页座位仍在 |
| 槽位 `settings.section` | ✅ | ✅ 23 个文件引用 | 设置分区座位仍在 |
| 服务 `tokenMeter` | ✅ | ✅ 仍提供 | 宿主时间线采样不受影响 |

**说明**：rc.2 的逐字 seed table 为
`{react:ec,"react/jsx-runtime":ic,"react-dom":cc,"react-dom/client":fc,"@deepseek-ai/cordis":Ha,"@deepseek-ai/dsh-client-store":Hc,"@deepseek-ai/dsh-client-ui-slots":Ac,"@deepseek-ai/dsh-client-ui-primitives":Zg,"@deepseek-ai/dsh-client-ui-dockkit":Ey}`
—— 九项与 rc.1 一致（`react` 在压缩产物中是不带引号的键）。rc.2 前端 bundle 中
`dsh-client-runtime/client` 出现 **0** 次。

**仍未涵盖**：两端都只验证到「装载 + 契约」，**没有**在任一版本上验证浏览器内的实际渲染
（见 §8 R6：GUI 有鉴权门，无法从新的浏览器上下文检视）。

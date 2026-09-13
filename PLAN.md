# dsh-context-lens 开发计划

> 一个 DSH Web GUI 插件：把「上下文用量」和「智能体轨迹」从单一百分比升级为可归因、可对比、可追溯的可视化视图。
>
> 配套任务文档：[TASKS.md](./TASKS.md)（每阶段待办 + 工作日志，随做随记）
> 计划状态：待评审 ｜ 制定日期：见 TASKS.md 工作日志 ｜ 目标版本：0.1.5-rc.1 / 0.1.5-rc.2

---

## 0. 一页摘要

**产品定义**：在 DSH Web GUI 里增加一个「上下文透视镜」——回答四个问题：

1. 现在上下文用了多少、还剩多少、按当前消耗速度还能撑几轮？
2. 这些 token 具体被谁占了（系统提示 / 工具 schema / 注入上下文 / 用户消息 / 助手消息 / 工具结果）？
3. 每一轮、每一步上下文是怎么长起来的，压缩（compaction）在哪里回收了多少？
4. 缓存命中与计费口径如何（provider 实报 vs 启发式估算），误差边界在哪？

**交付物**：

| 交付物 | 路径 | 说明 |
|---|---|---|
| 插件源码仓库 | `D:\DSH\dsh-context-lens\` | 本地开发库，最终推 GitHub（topic `dsh-plugin`） |
| 任务文档 | `D:\DSH\dsh-context-lens\TASKS.md` | 每阶段待办勾选 + 工作日志 + 决策记录 |
| 分发包 | npm / `pnpm pack` tarball / GitHub 直装 | 三种安装方式均验证 |

**硬约束（合规红线，全部来自官方规范，见 §1）**：

- **纯消费者**：不新增会话事件、不改 `agent-loop`、不新增模型可见内容（Model-visible ⟺ logged 规则）。
- **可被 TUI profile 安全加载**：宿主半**不得** declare `webServer` 等 web 专有服务依赖（否则 TUI profile 会 pending 卡死整个 profile —— 见 `D:\DSH\AGENTS.md` 红线）。宿主半 `apply` 可为空。
- **零运行期跨插件依赖**：客户端半只允许 baseline 模块 + 自身私有代码；不得运行期 import 其他特性插件的值。
- **文案本地化 + 主题 token**：所有产品文案走 typed locale 字典经 `t`；颜色只用 `--dsw-alias-*`，无字面色值。

**不做的事**：不做又一个 token 账本/用量统计（社区已有 10+ 同类），不做 LLM 计费对账，不做会话日志格式扩展。

---

## 1. 官方与社区规范基线（已核实，逐条可追溯）

已放弃本机副本作为规范依据（本机 `deepseek-harness-dev` 是 `0.1.2-alpha.1`，不是最新）。以下全部取自 **GitHub `deepseek-ai/DeepSeek-Harness@master`（`0.1.5-rc.2`）** 的官方文档与源码，并在本机 `deepseek-harness`（`0.1.5-rc.1`）交叉验证存在性。

> 原始材料已下载到 `D:\DSH\tmp\gh-docs\`（`tree.json` + 关键文档），可复查。

### 1.1 插件形态与分发

| # | 规范 | 要求 | 来源 |
|---|---|---|---|
| B1 | 插件本体 | TypeScript/JS 模块导出 `apply`；三种形态（函数/对象/类），**函数形态不要混用 default export 与 named export**（混用会让 Loader 丢弃 namespace） | `docs/user/develop/basic/index.md`；`packages/AGENTS.md` |
| B2 | bundle 清单 | `package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`；patch 内 `- insert: [{ id, name }]`，`name` 用**包名**（不是相对路径），靠 Node 解析 | `docs/user/develop/basic/publish.md` §bundle manifest |
| B3 | 客户端清单 | `dsh.client = { platform: 'web', inject?: [...], immediately?: bool }`，**必须同时提供 `exports["./client"]`**（扫描时缺了就抛错） | `docs/subsystems/client-modules.md` §The scan |
| B4 | 客户端产物 | 浏览器侧是**懒加载 CommonJS 表**：bundle 调用 `window.__ModuleLoader__.load({ id, factory: (require) => {...} })`，`factory` 返回 cordis 插件导出（`apply` / `inject`） | `docs/subsystems/web-client.md` §Browser boot；社区实证 `plugins/modlens-main/dsh/client.js`、`plugins/dsh-usage-stats-main/lib/client.js` |
| B5 | baseline 外部模块 | `react`、`react/jsx-runtime`、Cordis、`client/store`、`ui-primitives`、`ui-slots`、`ui-dockkit` 等由 shell 预置，**对每个动态 bundle 隐式可用，不要重复声明** | `packages/client/AGENTS.md` §Shared modules |
| B6 | 禁止私有 external | `dsh.client.external` **不是**特性插件的依赖机制（只有基础设施/传输/生成装配可用）。特性插件要共享行为只能：`import type` / 注入 Cordis 服务 / 走槽位 | `packages/client/AGENTS.md` |
| B7 | 注册即副作用 | 一切注册走 `ctx.effect()` / `ctx.on()` / `ctx.slots.inject()`；`register()` 返回 disposer；卸载自动清理 | `docs/user/develop/framework/index.md`；`docs/subsystems/slots.md` |
| B8 | 可选服务读法 | 可选服务用 `ctx.get(name)`；**声明了 `inject` 才能用 `ctx.<name>` 属性代理** | `packages/AGENTS.md`（含 postmortem 0001） |
| B9 | 无硬编码可调项 | 部署相关取值必须是校验过的 `Config` 字段（可从 `cordis.yml` 改）；`DEFAULT_*` 常量或测试钩子不算可配置 | `docs/AGENTS.md` 同级 `AGENTS.md` §Conventions |
| B10 | 失败要响 | 自包含的错配在加载期抛错；不得静默跳过缺失的引用对象 | 同上 |
| B11 | 分发三态 | ① npm 发布（带已构建 `lib/`）② `pnpm pack` tarball ③ GitHub 直装（需作者 `prepare` + 用户 `allowBuilds` 白名单 + 建议 pin commit） | `docs/user/develop/basic/publish.md` |

### 1.2 客户端 UI 合规

| # | 规范 | 要求 | 来源 |
|---|---|---|---|
| C1 | 唯一组合入口 | `ctx.slots.inject(key, () => ctx.slots.register({ name, children?, store?, inject? }, Component))`；往未声明的槽位 `register` 视为加载错误 | `docs/subsystems/slots.md`；`packages/client/AGENTS.md` |
| C2 | 槽位层级 | 现行层级树（`sidebar.footer.action`、`conversation.composer.bar`、`conversation.input.left/right/dock`、`conversation.view`、`sidebar.right.pane.tab`、`settings.section` …） | `docs/subsystems/slots.md` §Current hierarchy |
| C3 | 组件入参 | 四份 share：`PropsRuntime` / `PropsRenderSlots` / `PropsStore` / inject face；**组件永远拿不到 `ctx`**；hook 只能由框架造（`useSession`/`useProjection`/`useStore`/`renderSlot` …） | `docs/subsystems/slots.md` §Component inputs；`packages/client/AGENTS.md` |
| C4 | 不得复用他人组件 | 特性插件之间只能 `import type` 共享声明；运行期值要么走注入服务，要么走槽位 | `packages/client/AGENTS.md` §Export discipline |
| C5 | 文案本地化 | 所有产品可见文案（含 aria/tooltip/占位符/单位格式化）必须在 typed locale 字典里，组件通过 `t` 取；不得硬编码 | `packages/client/AGENTS.md` §Styling and localization |
| C6 | 样式 | CSS Modules + `clsx`；只用 `--dsw-alias-*` 语义 token（本机 rc.1 实测 361 个 `--dsw-*`）；中性边框 0.5px；浮层用 `--dsw-elevation-*` 且**不得**与 `--dsw-alias-border-*` 叠加；无障碍焦点与 reduced-motion 必须保留 | `docs/web-styling.md`；`packages/client/ui-theme/src/styles/` |
| C7 | 无模块级副作用 | 注册只能发生在 `apply` 内，禁止模块级副作用 | `packages/client/AGENTS.md` §Directory regime |
| C8 | HMR 前提 | 改客户端代码后必须重建 bundle（registry 服务的是 `lib/client.js`，不是源码）；容器内需 `pnpm run dev:web` 才有无刷新热更 | `packages/client/AGENTS.md` §checklist 5；本会话运行时说明 |
| C9 | 右侧栏扩展座位 | `ctx.sidebarRightTabs.register(definition)` 注册一种 tab 类型（同 id 二次注册抛错），body 走 `sidebar.right.pane.tab`（keyed by id，Session scope），可选 `sidebar.right.pane.tab.title` | `docs/subsystems/sidebar-right.md` |
| C10 | 宿主→客户端数据 | 优先用**会话投影**：宿主 `ctx.sessionProjections.register({ key, stateSchema, init, apply, wire })` → 客户端 `useProjection(key)` 拿整流值；客户端**从不自己 fold 事件** | `docs/subsystems/session-projection.md` |

### 1.3 宿主侧（若需要自建只读接口）

| # | 规范 | 要求 | 来源 |
|---|---|---|---|
| H1 | 自建路由先例 | 精确路由挂在 `/api/<plugin>/*` 下（精确路由优先于连接插件的 `/api` 前缀处理器）；**用 peer socket 地址做 loopback 围栏**（`Host` 头只作附加校验）；非 GET 返回 405 | 社区实证 `plugins/dsh-usage-stats-main/lib/index.js`（注释与实现逐步可读） |
| H2 | 不得新增模型可见内容 | 新行为只能挂在已文档化的扩展点；改 `agent-loop` 必须同步更新 `docs/architecture.md` | `AGENTS.md` §Conventions |
| H3 | 宿主半依赖要克制 | 依赖 web 专有服务会让插件在 TUI profile 永久 PENDING | `D:\DSH\AGENTS.md` 红线 |

---

## 2. 兼容性基线

### 2.1 版本事实（本机实测）

| 副本 | 版本 | 角色 | 是否目标 |
|---|---|---|---|
| `D:\DSH\deepseek-harness` | **0.1.5-rc.1** | 固定版（禁改）+ 当前 launcher 运行版本 | ✅ 主目标 |
| GitHub `deepseek-ai/DeepSeek-Harness@master` | **0.1.5-rc.2** | 最新官方 | ✅ 主目标 |
| `D:\DSH\deepseek-harness-dev` | `0.1.2-alpha.1` | 旧开发副本（缺 `ui-sidebar-right`、无 `ctx.sidebarRightTabs`） | ❌ 不作目标，仅记录 |

### 2.2 能力矩阵（rc.1 与 rc.2 均已存在，逐项验证过）

| 能力 | 提供方 | 我们怎么用 |
|---|---|---|
| `contextPressure` 投影：`pressureTokens`（provider 实报 prompt 大小）/ `projectedTokens`（下一次请求预测）/ `contextWindow` | `packages/llm/token-meter`（`usage-projection.ts`） | 环形占用率、余量、溢出预测 |
| `contextBreakdown` 投影：`systemTokens` / `toolsTokens` / `messageTokens` | 同上（`breakdown-projection.ts`） | 堆叠构成条的三段基线 |
| `tokenUsage` 投影：`uncachedInputTokens` / `outputTokens` / `cacheReadTokens` / `cacheWriteTokens` | 同上 | 缓存经济性与计费口径 |
| `sessionStats` 投影：turn/step 计数 + LLM/工具/首 token/decode 墙钟 | `packages/session/session-stats` | 轨迹时间线的标尺 |
| `turnOutline` 投影：全会话 turn 轮廓 | `packages/session/session-turn-outline` | 未加载 turn 的导航 |
| `ctx.tokenMeter.measure(session)` → `{ logRevision, baseline, surfaceDeltaTokens, totalTokens, surfaceTokens, nodes[{seq, tokens, heuristicTokens}] }` | `packages/llm/token-meter`（宿主服务） | **P4 分轮/分步上下文增量时间线的唯一数据源** |
| `ctx.llm.resolveModelInfo().context` | `packages/llm/llm` | 模型容量兜底 |
| Trajectory 视图（turn 感知事件账本 + 时序总览 + 单条 inspector：token/时长/输入输出/时序/图片） | `packages/client/ui-trajectory` | 不重复造，做「上下文维度」的并排补充 |
| 右侧栏 tab 注册 `ctx.sidebarRightTabs` + `sidebar.right.pane.tab` | `packages/client/ui-sidebar-right` | P5 可停靠的「Context」页面 |
| `useProjection` / `useSession` / `useConversation` / `useTrajectory` 标准 hook | `ui-session` / `ui-conversation` / `ui-trajectory` | 客户端读数据 |
| 会话投影注册（含 `wire` 视图） | `packages/session/session-projection` | 宿主→客户端数据通道（可选） |

### 2.3 降级策略（能力探测，永不假设）

| 级别 | 触发条件 | 形态 |
|---|---|---|
| **L0（保底）** | 只要 `slots` + `locale` 存在（rc.1 起恒成立） | `sidebar.footer.action` 浮窗面板 |
| **L1** | `useProjection('contextPressure')` 非空 | 环形占用率 + 余量 + 溢出预测 |
| **L2** | `contextBreakdown` 可读 | 三段堆叠构成 + 归因行 |
| **L3** | `ctx.get('sidebarRightTabs')` 存在 | 注册可停靠「Context」页面（与 Trajectory 并排） |
| **L4** | 宿主服务 `tokenMeter` 可注入 | 分轮/分步上下文增量时间线（P4） |
| **L5** | `conversation.view` ring 可用且官方开放注册 | 独立「Context」视图页（探索项，未确认则不做） |

> 每个级别都必须能**单独失败而不影响其余**：warn 而非抛错，且不得污染他人槽位（追加用新 list id / 未占用 key，绝不复用已占位 cell）。

---

## 3. 现状缺口与产品增量

### 3.1 已核实「官方已经有什么」

- **`ContextMeter`**（`packages/client/ui-conversation/src/client/skeleton/ContextMeter.tsx`，170 行）：输入栏发送按钮旁一个 14px 环（provider 实报百分比），点击打开小面板，内含一条堆叠条 + **3 行**图例（system / tools / messages）+ `~used / window` 数字。仅此。
- **`ContextOccupancy`**（`context-occupancy.ts`）：`percent` / `usedTokens` / `contextWindow` 三个字段。
- **Trajectory 视图**：事件账本（User/Assistant/Tool/嵌套 Subtool）、缩放时序总览、选中展开 inspector（token 用量、时长、输入输出、时序、图片）。
- **`sessionStats`**：turn/step 计数与墙钟时间。
- **`context-provenance` 契约**：注入/召回类消息的 role + producer label（`KnownContextForm`：instructions / catalog / snapshot / notice / relay / recall）。
- **`request-inspection` 契约**：`ConversationPromptSnapshot`（config + 完整 system prompt 文本 + 完整工具目录）、`SystemPromptNode` 历史、`inspectRequestPrompt()`。

### 3.2 五个缺口（我们的增量）

| # | 缺口 | 我们的做法 | 阶段 |
|---|---|---|---|
| G1 | 构成只有 3 个粗桶，没有**归因**：系统提示里哪一段、工具目录里哪个工具、注入了哪些上下文（instructions/catalog/recall/notice…）、图片与附件各占多少 | 节点级归因面板：按 producer / 事件种类 / 工具名分组，可展开到节点 | P3 |
| G2 | 没有**余量规划**：不说「剩多少」「还能撑几轮」「下一轮会不会溢出」 | 余量卡：剩余 token、按近 N 轮平均增速估算可支撑轮数、下次请求预测与实际压缩阈值对比 | P3 |
| G3 | 没有**上下文随时间**的轨迹：不知道每轮/每步上下文怎么长、压缩回收了多少 | 上下文增量时间线（宿主 `tokenMeter.measure()` 逐 revision 采样 → 分轮/分步 Δ、压缩前后台阶、签名增量） | P4 |
| G4 | **计费口径不透明**：`~` 号不解释；实报锚点 vs 启发式估算、缓存读写、各占多少没有交代 | 口径徽标 + 缓存经济性行（cache read/write 占比、命中率、实报锚点 revision）+ 误差声明（CJK/JSON 低估提示） | P3/P4 |
| G5 | **不可带走**：无法把「这次会话的上下文账」导出成可分享材料 | 一键导出 Markdown / JSON 报告（纯本地，无网络） | P6 |

### 3.3 与现有社区插件的差异

社区现有 10+ 插件（`dsh-token-usage`、`dsh-usage-stats`、`dsh-token-usage-sidebar` 等）全部是**跨会话用量账本/热力图/余额配额**。本插件定位为**单会话上下文解剖 + 轨迹关联**，不读凭据、不做跨会话聚合，因此无功能重叠、无密钥面。

---

## 4. 架构

### 4.1 两半职责

```
┌───────────────────────────── Host（Node） ─────────────────────────────┐
│ src/index.ts  ─ 具名导出 name / inject / Config / apply（无 default）   │
│  • apply：默认空实现（保证 TUI profile 可安全加载）                      │
│  • Config：校验后的可调项（刷新节流、采样步长、导出上限…）               │
│  • P4 起：仅在与 webServer 同存时，用 ctx.get() 探测并注册只读精确路由   │
│    GET /api/context-lens/timeline?sessionId=…（peer socket loopback 围栏）│
│    数据来自 ctx.tokenMeter.measure(session)（可选注入，缺则整条失败要响）│
└────────────────────────────────────────────────────────────────────────┘
                                  ▲  同源 fetch（仅 P4+）
┌──────────────────────────── Client（浏览器） ───────────────────────────┐
│ src/client/index.ts ─ window.__ModuleLoader__.load({ id, factory })     │
│  • 注册 locale 字典（zh/en typed）                                       │
│  • ctx.slots.inject('sidebar.footer.action', …)   → 浮窗面板（L0 保底）  │
│  • ctx.slots.inject('conversation.input.right', …)→ 精简仪表（可选）      │
│  • ctx.get('sidebarRightTabs') → register Context 页（L3，可选）         │
│  • 纯函数层：构成归一化、增量折叠、格式化（无 DOM、可单测）              │
│  • 组件只吃四份 share；不发订阅、不碰 ctx                                │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 数据流（客户端只读投影，不自己 fold）

```
session/event ──► ctx.sessionProjections（宿主 fold，官方单元）
                        │ wire view（zod 校验后的整流值）
                        ▼
      Remote follow / session/projection 推帧 ──► 客户端 Session 投影 store
                        │
                        ▼
      useProjection('contextPressure' | 'contextBreakdown' | 'tokenUsage' | 'sessionStats')
                        │
                        ▼
        我们的纯函数归一化 ──► 组件渲染（React 只读，无订阅机器）
```

P4 的轨迹时间线走宿主动词：客户端按 sessionId 拉 `/api/context-lens/timeline`，宿主内部逐 revision 调 `ctx.tokenMeter.measure()` 采样后返回 JSON。**不新增会话事件**，因为这只是既有数据的另一种读出。

### 4.3 拟议目录结构（对齐官方包约定，去掉 monorepo 专有部分）

```
dsh-context-lens/
├── package.json            # type:module, exports{".":"./lib/index.js","./client":"./lib/client.js","./package.json"}, dsh.bundle, dsh.client, files 白名单
├── cordis.patch.yml        # - insert: [{ id: context-lens, name: dsh-context-lens }]
├── README.md / README.zh.md
├── CHANGELOG.md / LICENSE / SECURITY.md
├── docs/
│   ├── COMPATIBILITY.md    # §2 的落地版（含实测证据）
│   └── DESIGN.md           # 视图与口径定义（一份事实一个家）
├── src/
│   ├── index.ts            # 宿主半：Config + 空/可选 apply（具名导出）
│   ├── client/
│   │   ├── index.ts        # bundle 入口：只做注册
│   │   ├── model/          # 纯函数：归一化/折叠/格式化（无 React、无 DOM）
│   │   ├── views/          # Snapshot / Attribution / Timeline / Report 四个视图
│   │   ├── components/     # 展示组件（只吃四份 share）
│   │   ├── locales.ts      # zh/en typed 字典
│   │   └── styles.ts       # CSS Modules 编译产物 + 带 data-plugin 标签的注入器
│   └── host/
│       └── timeline.ts     # P4：tokenMeter 采样 + loopback 精确路由
├── tests/
│   ├── model.spec.ts       # 纯函数单测（正常/边界/空投影/坏数据）
│   ├── degrade.spec.ts     # 能力降级矩阵（L0–L4 各自缺失时的行为）
│   └── install.spec.mjs    # 装进临时 DSH_HOME profile 的端到端装载冒烟
└── scripts/
    ├── build.mjs           # 产出 lib/index.js + lib/client.js（闭包工厂格式）
    └── check.mjs           # node --check 全部产物 + manifest 断言
```

---

## 5. 阶段计划（P0–P7）

> 每阶段的**逐条待办**在 [TASKS.md](./TASKS.md)；本节只给目标、产出、验证证据与退出条件。

### P0 规范对齐与立项（半天）
- **目标**：把 §1 的规范基线冻结成可勾选的验收项；建仓、建任务文档。
- **产出**：`PLAN.md`、`TASKS.md`、`docs/COMPATIBILITY.md` 骨架、仓库 skeleton、`git init`。
- **验证证据**：§1 每条规范能指向官方文件路径；`node -v` / `pnpm -v` / 目标 dsh 版本记录在案。
- **退出条件**：兼容矩阵与降级矩阵经用户确认（§7 三个决定有结论）。

### P1 加载闭环（1 天）
- **目标**：插件能被 profile 装载，客户端 bundle 能在 Web GUI 出现一个占位控件。
- **产出**：`package.json` 双清单、`cordis.patch.yml`、空宿主 apply、最小客户端 bundle（注册 `sidebar.footer.action` 占位）、`scripts/build.mjs`、`scripts/check.mjs`。
- **验证证据**：临时 `DSH_HOME` 下 `dsh plugin add` → `dsh --profile … --dump-config` 出现 `# == dsh-context-lens` 层 → 启 web → 浏览器出现占位 → 卸载后控件消失（disposer 生效）。
- **退出条件**：装载、显示、卸载三件事都有实测日志；`files` 白名单覆盖全部运行期相对导入与产物。

### P2 数据层与纯函数（1 天）
- **目标**：把投影 → 视图模型的全过程做成无 React 的纯函数，可单测。
- **产出**：`src/client/model/`（构成归一化、占用率与余量、增量折叠、K/M 格式化、口径判定）；`tests/model.spec.ts`。
- **验证证据**：单测覆盖正常 / 空投影 / 只读到一个投影 / 数值异常（负增量、零窗口、超大值）；格式化与官方 `ContextMeter` 的 K/M 口径一致。
- **退出条件**：纯函数层 100% 分支覆盖；无任何 DOM/React 依赖（可 node 直跑）。

### P3 面板 UI v1（2–3 天）
- **目标**：做出比官方 ContextMeter 明显更有信息量的浮窗面板（L0–L2）。
- **产出**：环形占用率 + 三段堆叠构成 + **归因分组行**（系统提示 / 工具 schema / 注入上下文 / 用户 / 助手 / 工具结果 / 图片附件）+ 余量卡（剩余、可支撑轮数、溢出预测）+ 口径徽标（provider 实报 / 启发式估算）+ cache 经济性行；zh/en locale 字典；CSS Modules 产物注入。
- **验证证据**：截图（浅色/深色）；键盘可开合与 Escape 关闭；焦点可见；reduced-motion 下无动画；无字面色值（grep 校验）；无硬编码文案（grep 校验）；投影缺失时按 L0 降级且不报错。
- **退出条件**：四类证据齐备（截图、grep 校验、降级实测、a11y 手测记录）。

### P4 上下文 × 轨迹时间线（3 天，本插件核心增量）
- **目标**：回答「每一轮/每一步上下文怎么长、压缩回收了多少」。
- **产出**：宿主 `src/host/timeline.ts`（`ctx.tokenMeter.measure()` 逐 revision 采样、分轮/分步增量、压缩台阶、签名增量；只读精确路由 + peer socket loopback 围栏 + 405/403 语义）+ 客户端时间线视图（横向：turn/step；纵向：token；压缩标记与回收量；cache 曲线与墙钟叠加）。
- **验证证据**：与官方 `contextPressure` / `contextBreakdown` 数值在可对齐 revision 上一致（写进测试）；非 loopback 请求 403、非 GET 405；`tokenMeter` 缺失时整条时间线**明确报错**（fail loud），不影响其余视图。
- **退出条件**：时间线与官方数字一致性测试通过；错误路径测试通过；无新增会话事件（`git diff` 审查确认不触碰 session 事件表）。

### P5 深度集成（1–2 天）
- **目标**：从浮窗升级为可停靠页面（L3），并把可调项暴露成 Config。
- **产出**：`ctx.sidebarRightTabs.register(...)` + `sidebar.right.pane.tab` 页面（与 Trajectory 并排）；`settings.section` 里的选项卡（刷新节流、采样步长、默认展开视图）；`conversation.input.right` 精简仪表。
- **验证证据**：与 Trajectory 同时打开的截图；`ctx.get('sidebarRightTabs')` 缺失时该页面整块不注册且零副作用（在旧版本上实测）；Config 非法值在加载期抛错。
- **退出条件**：rc.1 与 rc.2 双版本实测通过；无槽位冲突（不覆盖任何已占位 cell）。

### P6 兼容性、导出与回归（1–2 天）
- **目标**：把「严格兼容」变成可复跑的证据。
- **产出**：`docs/COMPATIBILITY.md` 实测版；降级矩阵测试（L0–L4 逐项缺失）；TUI profile 安全测试；Markdown/JSON 报告导出；`tests/install.spec.mjs`。
- **验证证据**：① rc.1 与 rc.2 两版本各跑一遍装载+渲染矩阵；② 把插件装进 TUI profile 后 profile **正常启动**（不 pending）——这是红线验证；③ 卸载后无残留（disposer 审计）；④ 导出报告在无网络环境可用。
- **退出条件**：四条证据全部留档，任何一条不过则阻塞发布。

### P7 发布（1 天）
- **目标**：可被发现、可被安装、可被信赖。
- **产出**：README（中英，含截图与三个安装路径）、CHANGELOG、SECURITY.md、LICENSE、`docs/COMPATIBILITY.md`、GitHub 仓库 + topic `dsh-plugin`、tag `v0.1.0`、npm 发布（可选）、`pnpm pack` tarball 验证。
- **验证证据**：三种安装方式各自端到端装一遍（npm / tarball / GitHub 直装，后者含 `allowBuilds` 文档与 commit pin 说明）；README 命令逐条实跑。
- **退出条件**：三个安装路径均有成功日志；README 无失效命令。

### P8 探索项（不承诺）
- `conversation.view` ring 里注册独立「Context」视图页（**前置条件**：确认官方对第三方开放该注册口；未确认则不做，改为不实现并在 README 的 Known Limitations 说明）。
- 跨会话上下文对比；导出为图片；把归因数据做成可点击跳转到对应消息。

---

## 6. 风险与回退

| 风险 | 影响 | 缓解 / 回退 |
|---|---|---|
| 官方客户端插件契约没有面向第三方的文档（`docs/user/develop/` 只有宿主侧教程） | 可能踩到未文档化的隐式要求 | 以社区实证（modlens、dsh-usage-stats 两个已在生产可用）为兼容基准；每个假设写成 `docs/COMPATIBILITY.md` 的一条可复跑验证 |
| `contextBreakdown` 只有 3 个粗桶，节点级归因需要自己算 | 归因精度受限，可能给出误导数字 | 归因只用**已存在的数字**做分组展示；任何自算量必须显式标注「估算」并给出误差说明（官方已在 README 声明 CJK/JSON 低估） |
| `tokenMeter.measure()` 是 O(surface) 且逐 revision 采样可能昂贵 | 长会话下宿主 CPU 抖动 | 采样节流 + 结果缓存 + 上限（Config 字段）；只对当前选中的 session 采样；超限截断并显式上报 truncated |
| rc.2 之后官方可能改动私有槽位/投影 | 升级即碎 | 只依赖**已文档化**的槽位与投影键；能力探测 + 分级降级；在 CI 里对 rc.1/rc.2 双版本跑装载测试 |
| 自建宿主路由引入安全面 | 本机浏览器任意页面可探测 | 精确路由 + peer socket loopback 围栏 + 非 GET 405 + 不返回敏感内容（只返回 token 计数） |
| 浮窗面板与官方 ContextMeter 视觉竞争 | 信息重复、界面变脏 | 官方 meter 保留；我们的精简仪表走 `conversation.input.right` **追加**（新 list id），默认只显示官方没有的信息（余量+归因入口） |
| 社区同类插件已有 10+ | 定位被淹没 | 差异化在 §3.3；README 首段直接讲清「不是用量账本」 |

---

## 7. 需要你确认的三个决定

| # | 决定 | 我的建议 | 备选 |
|---|---|---|---|
| D1 | 插件名与包名 | `dsh-context-lens`（目录 `D:\DSH\dsh-context-lens`，GitHub 同名，topic `dsh-plugin`） | `dsh-context-inspector` / `dsh-context-trace` / 你指定 |
| D2 | v1 范围 | 做到 **P4**（含宿主时间线）——这才是「轨迹」的增量所在 | 只做 P0–P3（纯客户端，零宿主路由，最快最安全） |
| D3 | 首发分发 | **tarball + GitHub 直装**（免 npm 2FA 流程，与你上一个插件 `dsh-wsl-preset` 的结论一致） | 追加 npm 公开发布 |

> 未确认前 P0 可以照常进行；D2 影响 P4 是否启动，D3 只影响 P7。

---

## 8. 参考来源（可复查）

**官方文档（GitHub master `0.1.5-rc.2`，已下载到 `D:\DSH\tmp\gh-docs\`）**
- `docs/user/develop/basic/index.md`（插件形态与生命周期）、`publish.md`（bundle/profile 双清单与分发三态）、`framework/index.md`（Fiber 状态机与自动清理）
- `docs/subsystems/slots.md`（槽位层级树、四份 share、扩展规则）、`web-client.md`（四层所有权与浏览器启动）、`client-modules.md`（`dsh.client` 扫描 / `/plugins` combo 路由 / `ctx.clientModules`）
- `docs/subsystems/token-meter.md`（`TokenMeasurement` / `TokenSurfaceNode` / `ctx.tokenMeter`）、`session-projection.md`（投影注册与客户端整流值）、`sidebar-right.md`（tab 类型注册与 `sidebar.right.pane.tab`）
- `docs/web-styling.md`（styling 所有权与组件规则）
- `packages/client/AGENTS.md`（客户端包纪律：baseline externals、external 禁令、locale、CSS、新插件包清单）
- `packages/AGENTS.md`（插件导出形态、可选服务 `ctx.get`、REAL-composition 测试要求）

**官方源码（本机 0.1.5-rc.1 交叉验证）**
- `packages/client/ui-conversation/src/client/skeleton/ContextMeter.tsx`、`context-occupancy.ts`、`contract/{context-provenance,request-inspection,system-prompt}.ts`
- `packages/client/ui-trajectory/README.md`、`packages/client/ui-sidebar-right/README.md`、`packages/client/ui-slots/README.md`
- `packages/llm/token-meter/{README.md,src/*.ts}`、`packages/session/session-stats/README.md`、`packages/session/session-turn-outline/README.md`
- `packages/client/ui-theme/src/styles/`（`--dsw-*` token 实测清单）

**社区实证（本机 `D:\DSH\plugins\`）**
- `modlens-main/`（`package.json` 的 `dsh.bundle` + `dsh.client` + `exports["./client"]`；手写闭包工厂 bundle）
- `dsh-usage-stats-main/`（`lib/index.js` 的精确路由 + loopback 围栏 + 增量折叠；`lib/client.js` 的 `ctx.slots.inject` / `ctx.locale.register` 用法）
- `dsh-browser-main/`、`dsh-mcp-manager-main/`、`DSH-better-sidebar-main/`（其他加载形态样本）

**本机约定**
- `D:\DSH\AGENTS.md`（双实例约定、TUI profile 红线、插件目录约定）
- `D:\DSH\task-list.md`（上一个插件的任务文档格式先例）

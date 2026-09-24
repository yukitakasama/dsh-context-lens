# dsh-context-lens 任务文档

> **配套计划**：[PLAN.md](./PLAN.md)（目标 / 架构 / 阶段目标 / 风险 / 规范来源）
> **本文件职责**：每阶段待办勾选 + 工作记录。计划变了改 PLAN.md，进度变了改这里。
>
> 更新时间：2026-09-13 ｜ 当前阶段：**P7**（P0–P6 已完成，待 D1/D2/D3 与人工浏览器确认）｜ 总进度：**6/8 阶段**

---

## 0. 怎么用这份文档

1. **开新阶段前**：把该阶段的待办逐条读一遍，有疑问先补进「阻塞」区。
2. **做事时**：勾掉待办，**顺手往「工作日志」追加一行**（日期 / 做了什么 / 证据落在哪）。
3. **踩坑时**：写进「已知问题 / 阻塞」；改变了方案就写进「决策记录」并在 PLAN.md 同步。
4. **收阶段时**：把证据路径填进「验证证据台账」，更新 §1 当前状态。
5. 标记约定：`[ ]` 待做 ｜ `[x]` 完成 ｜ `[~]` 进行中 ｜ `[-]` 放弃（必须写原因） ｜ `[!]` 阻塞

---

## 1. 当前状态

| 项 | 值 |
|---|---|
| 当前阶段 | P7 发布（P0–P6 已完成） |
| 阶段内进度 | 构建 / 单测 / 合规 / 装载 / 卸载 / 非 web profile 安全 均已实测通过；待 D1/D2/D3 决策与人工浏览器截图 |
| 阻塞 | 无技术阻塞。**需人工确认**：浏览器内实际渲染与深浅色截图（无头环境无法代拍）；D1 插件名 / D2 v1 范围 / D3 首发分发 |
| 主目标版本 | dsh `0.1.5-rc.1`（本机运行版）、`0.1.5-rc.2`（GitHub master） |
| 本地库路径 | `D:\DSH\dsh-context-lens` |
| 远程仓库 | 未建 |
| 最近一次验证 | 无 |

---

## 2. 阶段待办

### P0 规范对齐与立项

**目标**：把官方规范冻结成可勾选验收项；建仓 + 建任务文档。

**A. 规范核对（每条对应 PLAN.md §1 的编号）**
- [x] B1 宿主插件用函数形态具名导出 `name` / `inject` / `Config` / `apply`，**不写 default export**
- [x] B2 `dsh.bundle.patch` → `cordis.patch.yml`，insert 行的 `name` 用包名
- [x] B3 `dsh.client = { platform: 'web', inject: [...] }` 且同时提供 `exports["./client"]`
- [x] B4 客户端 bundle 采用 `window.__ModuleLoader__.load({ id, factory })` 闭包工厂格式
- [x] B5 只使用 baseline 隐式外部模块（react / jsx-runtime / ui-primitives…），不重复声明
- [x] B6 **不使用** `dsh.client.external`；跨包只 `import type` / 注入服务 / 走槽位
- [x] B7 所有注册走 `ctx.effect()` / `ctx.slots.inject()`，disposer 到位
- [x] B8 可选服务一律 `ctx.get(name)`
- [x] B9 可调项（刷新节流、采样步长、视图默认值）全部进 `Config` 并校验
- [x] B10 非法 Config / 缺失必需引用时**加载期抛错**，不静默降级
- [x] B11 分发三态确认（npm / tarball / GitHub 直装 + allowBuilds 文档）
- [x] C1 只用 `ctx.slots.inject(key, () => ctx.slots.register(...))` 组合 UI
- [x] C2 用到的槽位逐个在 `docs/subsystems/slots.md` 的层级树里确认 cardinality/scope
- [x] C3 组件只吃四份 share；组件文件里不出现 `ctx`
- [x] C4 无任何运行期跨特性插件 import
- [x] C5 全部产品文案进 typed locale 字典，组件经 `t` 取（写 grep 校验脚本）
- [x] C6 只用 `--dsw-alias-*` token；中性边框 0.5px；浮层用 elevation 不叠 border（写 grep 校验脚本）
- [x] C7 无模块级副作用
- [x] C8 明确「改客户端代码必须重建 bundle」写进 README
- [x] C9 右侧栏 tab 用 `ctx.sidebarRightTabs.register` + `sidebar.right.pane.tab`
- [x] C10 宿主→客户端优先走会话投影 `wire` 视图
- [x] H1 自建路由用精确路由 + peer socket loopback 围栏 + 405
- [x] H2 不新增模型可见内容、不碰 session 事件表、不改 agent-loop
- [x] H3 宿主半**不 declare** `webServer`（TUI profile 红线）

**B. 立项动作**
- [x] 建立目录 `D:\DSH\dsh-context-lens`（本文件与 PLAN.md 已在此）
- [x] `git init` + 首个提交（仅 PLAN/TASKS/.gitignore）
- [x] 写入 `docs/COMPATIBILITY.md` 骨架（把 PLAN.md §2.2 能力矩阵落成待验证清单）
- [x] 记录环境事实：`node -v` / `pnpm -v` / `dsh --version` / 两个目标副本版本
- [!] 确认 D1 插件名、D2 v1 范围、D3 首发分发方式

**阶段产出**：PLAN.md、TASKS.md、COMPATIBILITY.md 骨架、git 仓库
**退出条件**：A 组规范核对项全部勾选 + D1/D2/D3 有结论

---

### P1 加载闭环

**目标**：插件能被 profile 装载；客户端 bundle 能在 GUI 里出现一个占位控件；卸载后干净消失。

- [x] 写 `package.json`：`type: module`、`exports`（`.` / `./client` / `./package.json`）、`dsh.bundle`、`dsh.client`、`files` 白名单
- [x] 写 `cordis.patch.yml`（insert 一行）
- [x] 写 `src/index.js`：具名 `name` / `Config` / `apply`（默认空实现）
- [x] 写 `scripts/build.mjs`：产出 `lib/index.js`（ESM）+ `lib/client.js`（闭包工厂）
- [x] 写 `scripts/check.mjs`：25 条断言`node --check` 全部产物 + manifest 断言（exports/dsh/files 一致性）
- [x] 写最小 `src/client/index.cjs`：注册 locale 字典 + 往 `sidebar.footer.action` 注册占位控件
- [x] 建临时 `DSH_HOME`（参考 `D:\DSH\_plugintest` 做法），`dsh plugin add` 本仓库
- [x] `dsh --profile … --dump-config` 确认出现 `# == dsh-context-lens` 层
- [!] 启动 web，浏览器确认占位控件出现（需人工截图，无头环境无法代拍）
- [x] 移除插件，确认控件消失、无残留
- [x] 把装载日志与 `--dump-config` 片段存进「验证证据台账」

**产出**：可装载的最小插件 + 构建/校验脚本
**退出条件**：装载、显示、卸载三件事各有实测证据；`files` 覆盖全部运行期导入与产物

---

### P2 数据层与纯函数

**目标**：投影 → 视图模型的全过程无 React，可单测。

- [x] `src/client/model/index.cjs` 内 `occupancyOf`：占用率、余量、可支撑轮数（输入：`contextPressure`）
- [x] 同文件 `compositionOf`：三段构成归一化 + 分组（system / tools / messages）
- [x] 同文件归因分组（provenance 分组）：归因分组（系统提示段 / 工具 schema / 注入上下文按 provenance / 用户 / 助手 / 工具结果 / 图片）
- [x] 同文件 `formatTokens`：K/M 数字格式化（口径与官方 `ContextMeter` 对齐）
- [x] 同文件 `provenanceOf`：口径判定（provider 实报锚点 vs 启发式估算）与误差提示文案键
- [x] `tests/model.spec.mjs` + `tests/consistency.spec.mjs`：正常 / 空投影 / 单投影缺失 / 异常值（负增量、零窗口、超大值、非整数）
- [x] 跑 `node --test "tests/*.spec.mjs"`（或仓库选定 runner），确认纯函数层分支全覆盖
- [x] 确认 model 层零 DOM / 零 React 依赖（grep 校验 + 可 node 直跑）

**产出**：`src/client/model/*` + 单测
**退出条件**：单测绿；纯函数层无框架依赖

---

### P3 面板 UI v1

**目标**：做出明显强于官方 ContextMeter 的浮窗面板（L0–L2）。

- [x] 环形占用率 + 数字（provider 实报百分比）
- [x] 三段堆叠构成条 + 图例行
- [x] **归因分组行**（可折叠，展开到节点/生产者）
- [x] **余量卡**：剩余 token、按近 N 轮平均增速估算可支撑轮数、下一请求预测 vs 压缩阈值
- [x] **口径徽标**：实报锚点 / 启发式估算 + 误差声明（CJK、JSON schema 低估）
- [x] **缓存经济性行**：cache read/write、命中率、turn 级 token 用量
- [x] zh / en locale 字典（各 90 键，键集相等有断言）（typed，无硬编码文案）
- [x] 样式注入器带 `data-plugin` / `data-plugin-css` / `data-plugin-css` 的样式注入器
- [x] 键盘可开合、Escape 关闭、焦点可见、`aria-*` 齐全
- [x] reduced-motion 下无动画
- [!] 深浅色截图各一张（需人工）
- [x] grep 校验：无字面色值（已进 `scripts/check.mjs`，含反向验证）（`#rrggbb` / `rgb(`）
- [x] grep 校验：组件里无裸字符串文案
- [x] 降级实测：投影缺失时按 L0 渲染且不报错

**产出**：Snapshot 面板（含归因、余量、口径、缓存）
**退出条件**：截图 + 两个 grep 校验 + 降级实测 + a11y 手测记录齐备

---

### P4 上下文 × 轨迹时间线（核心增量）

**目标**：回答「每轮/每步上下文怎么长、压缩回收了多少」。

- [x] `src/host/timeline.js`：`ctx.get('tokenMeter')` 探测，逐 revision 采样 `measure()`
- [x] 分轮 / 分步增量计算；压缩前后台阶与回收量；签名增量（`surfaceDeltaTokens`）
- [x] 采样节流 + 结果缓存 + 条数上限，全部来自 `Config`
- [x] 只读精确路由 `GET /api/context-lens/timeline`
- [x] peer socket loopback 围栏（`::1` / `::ffff:127.0.0.1` / `127.x` 归一化）+ 非 GET 405 + 非 loopback 403
- [x] `tokenMeter` 缺失时**明确报错**（503）（fail loud），不静默返回空图
- [x] 客户端时间线视图：横轴 turn/step，纵轴 token；压缩标记与回收量；cache 曲线与墙钟叠加
- [x] 与官方公式的**一致性测试**（`tests/consistency.spec.mjs`，逐值比对，曾抓出 2 个真实缺陷）
- [x] 错误路径测试（403 / 405 / 400 / 404 / 503 / 截断）（403 / 405 / 缺失服务 / 超限截断上报 truncated）
- [x] `git diff` 审查：未触碰 session 事件表、未新增模型可见内容（宿主无事件写入）、未新增模型可见内容

**产出**：宿主采样 + 只读路由 + 时间线视图
**退出条件**：一致性测试与错误路径测试通过；无新增会话事件；超限行为显式上报

---

### P5 深度集成

**目标**：从浮窗升级为可停靠页面，并把可调项暴露成 Config。

- [x] `ctx.get('sidebarRightTabs')` 探测 + `register` 一个 Context tab 类型
- [x] body 注册到 `sidebar.right.pane.tab`（keyed by id，Session scope）
- [x] 可选 `sidebar.right.pane.tab.title`
- [!] 与 Trajectory 同时打开的截图（需人工）
- [-] `conversation.input.right` 精简仪表 —— **放弃**：该 seat 是 session scope，而我们已有面板与可停靠页两处呈现；再加一个会与官方 ContextMeter 视觉重复，收益不足。精简仪表所依赖的 `meter.*` 文案键已保留。（**新 list id**，不覆盖官方 meter）
- [x] `settings.section` 里加一个选项卡（暴露全部 5 个可调项；无设置服务时如实报不可用）（刷新节流 / 采样步长 / 默认视图）
- [x] Config 非法值加载期抛错实测
- [x] `sidebarRightTabs` 缺失时该页面整块不注册、零副作用（`tests/degrade.spec.mjs`）（旧版本实测）
- [x] 槽位冲突审查：list 用新 id、keyed 用未占用 key

**产出**：可停靠 Context 页 + 精简仪表 + 设置项
**退出条件**：rc.1 / rc.2 双版本实测通过；无槽位冲突

---

### P6 兼容性、导出与回归

**目标**：把「严格兼容」变成可复跑的证据。

- [x] `docs/COMPATIBILITY.md` 实测版（每个能力标 ✅/❌ + 验证命令 + 日期）
- [x] 降级矩阵测试：L0–L4（7 条，逐项摘除能力） 逐项缺失时的行为（缺一不影响其余）
- [!] rc.1 已实测；**rc.2 未装到本机**，无法跑装载矩阵（见 K5）
- [x] **非 web profile 安全测试**（红线）：装进 headless profile，`--dump-config` 正常出层、无 pending；另经真实 cordis `Context` 直载，无 `webServer` / 无 `tokenMeter` 时只注册 recorder effect，不抛错：装进 TUI profile 后 profile 正常启动（不 pending）——红线
- [x] 卸载残留审计（移除依赖后 `--dump-config` 中 `context-lens` 计数为 0）（disposer 是否真的回收了槽位、路由、字典、CSS 标签）
- [x] Markdown / JSON 报告导出（Blob + 对象 URL，纯本地）
- [x] 导出为纯内存构造，无 fetch / XHR（代码路径可证；浏览器断网手测待人工）
- [x] 端到端装载冒烟改由 `--dump-config` + 真实 cordis 直载覆盖（未单独建 `install.spec.mjs`）
- [x] 把全部证据路径填进「验证证据台账」

**产出**：兼容性文档 + 回归测试 + 导出功能
**退出条件**：四条硬证据（双版本矩阵 / TUI 安全 / 卸载无残留 / 断网导出）全部留档

---

### P7 发布

- [x] README.md + README.zh.md（首段讲清「不是用量账本」；三种安装方式；截图待补）（首段讲清「不是用量账本」；含截图与三种安装方式）
- [x] CHANGELOG.md
- [x] SECURITY.md
- [x] LICENSE（MIT）
- [!] 建 GitHub 仓库，加 topic `dsh-plugin`（需人工，涉及外部账号）
- [!] tag `v0.1.0`（需人工，见 AGENTS.md：未经要求不打 tag）
- [!] npm 发布（待 D3 决策）（若 D3 选做）或 `pnpm pack` tarball
- [!] 三种安装方式端到端（待仓库与发布决策）：npm / tarball / GitHub 直装（含 `allowBuilds` 说明与 commit pin）
- [x] README 里本地命令（build / check / test）已实跑；安装命令待发布后复跑
- [!] 市场索引可见性确认（待发布）（`plugin_search` 能搜到）

**产出**：可发现可安装的发布版
**退出条件**：三个安装路径均有成功日志；README 无失效命令

---

### P8 探索项（不承诺）

- [!] `conversation.view` ring 注册独立视图页 —— **前置条件未确认**：官方是否对第三方开放该注册口。未确认则不做，改在 README 的 Known Limitations 说明。
- [ ] 跨会话上下文对比
- [ ] 归因行可点击跳转到对应消息
- [ ] 导出为图片/分享卡片

---

## 3. 工作日志

> 每完成一件事追加一行。格式：`日期 ｜ 阶段 ｜ 做了什么 ｜ 证据/产出`

| 日期 | 阶段 | 内容 | 证据 / 产出 |
|---|---|---|---|
| 2026-09-13 | P0 | 方向纠正：放弃本机旧副本（`deepseek-harness-dev` = 0.1.2-alpha.1）作为规范依据，改从 GitHub master（0.1.5-rc.2）拉官方文档与源码（本机 WSL 无外网，经 `powershell.exe` 走 Windows 侧网络） | `D:\DSH\tmp\gh-docs\tree.json` + 21 份官方文档 |
| 2026-09-13 | P0 | 核实官方插件/客户端契约、槽位体系、token-meter 数据源、右侧栏扩展座位、styling 规则 | `D:\DSH\tmp\gh-docs\docs__subsystems__{slots,client-modules,token-meter,sidebar-right}.md` |
| 2026-09-13 | P0 | 完成现状缺口分析（官方 ContextMeter 只有 3 段；Trajectory 无上下文维度） | `PLAN.md` §3 |
| 2026-09-13 | P0 | 产出 PLAN.md + TASKS.md | 本文件与 `PLAN.md` |
| 2026-09-13 | P0 | 环境事实实测：node v22.23.1 / pnpm 11.21.0 / git 2.43.0 / `dsh --version` = 0.1.5-rc.1 | `PLAN.md` §2.1；本文件 §6 |
| 2026-09-13 | P0 | 修正规范基线：本机 `deepseek-harness` 检出树在 `packages/client/web/src/platform.ts` 与 `packages/client/runtime/*` 上**领先于 rc.1 发布**（`be531688f3` 删除了 runtime 并清空了 `PRELOADED_CLIENT_EXTERNALS`）。发布 tag = `1ef9c1fa9a`；其余全部契约文件经 md5 校验与 tag 一致 | 决策 A7；`docs/COMPATIBILITY.md` §2 |
| 2026-09-13 | P1 | `package.json` 双 manifest + `cordis.patch.yml` + 宿主半（零依赖、**不声明任何服务**）+ 手写 lazy-CJS 客户端 bundle + `build.mjs` / `check.mjs` | `lib/index.js`、`lib/client.js`；`scripts/check.mjs` 25 条断言 |
| 2026-09-13 | P1 | **装载实测**：临时 `DSH_HOME` → 自定义 profile（`--from-default-profile web`）→ 装入 → `--dump-config` 输出 `# == dsh-context-lens` 层（第 540 行） | 见 §6 台账 |
| 2026-09-13 | P1 | **卸载实测**：移除依赖与 bundle 行后，`--dump-config` 中 `context-lens` 计数 = 0，零残留 | 见 §6 台账 |
| 2026-09-13 | P2 | 纯函数模型层（占用率 / 构成 / 余量 / 缓存 / 口径 / 时间线）+ 报告导出；零 React、零 DOM | `src/client/model/`；`tests/model.spec.mjs` |
| 2026-09-13 | P3 | 面板 UI：环、构成条、余量卡、口径徽标、缓存行、时间线；zh/en 各 90 键；纯 token 样式 | `src/client/views/`；`src/client/styles.cjs` |
| 2026-09-13 | P4 | 宿主采样 + 精确只读路由 + 围栏；客户端时间线视图 | `src/host/timeline.js`；`tests/host.spec.mjs` |
| 2026-09-13 | P4 | **一致性测试抓出 2 个真实缺陷**：① `formatTokens` 强依赖 locale seat，无 seat 的调用方（导出/测试）会崩；② `occupancyOf` 把「锚点缺失」与「显式 0」并成同一状态，吞掉了一个真实读数（官方对显式 0 画 0% 环）。均已修复并加回归断言 | `tests/consistency.spec.mjs`（逐值比对官方公式） |
| 2026-09-13 | P5 | 可停靠右侧栏 tab（`extension` 档）+ 设置分区（暴露 5 个可调项） | `src/client/views/tab.cjs`、`views/settings.cjs` |
| 2026-09-13 | P6 | 降级矩阵：逐项摘除能力，其余座位仍注册（7 条） | `tests/degrade.spec.mjs` |
| 2026-09-13 | P6 | **红线实测**：装进 headless（非 web）profile → `--dump-config` 正常出层、无 pending；再经真实 cordis `Context` 直载，无 `webServer`/`tokenMeter` 时仅注册 recorder effect，不抛错 | 见 §6 台账 |
| 2026-09-13 | P6 | `check.mjs` 增加 3 条样式断言（仅 token 自定义属性 / 每个 `var()` 可解析 / elevation 不叠 border），并**逐条反向验证**（注入违规必 FAIL） | `scripts/check.mjs` |
| 2026-09-13 | P7 | README（en/zh）、CHANGELOG、SECURITY、LICENSE | 仓库根目录 |
| 2026-09-18 | P8 | **修复口径徽标恒显「无锚点」**（issue #2）：链路两处断点 —— ① `timelineOf` 折叠每个采样点时丢掉了宿主已采到的 `baselineKind`；② `buildViewModel` 从 `input.baselineKind` 取锚点，而四个投影键里根本没有该字段，无人会传。现改为折叠时**保留**每个点的锚点，并由 `newestBaselineKind` 取**最新采样点**（与占用率同期的那个）判定。回归断言覆盖 usage / estimated / 无采样三态 | `src/client/model/index.cjs`；`tests/model.spec.mjs` |
| 2026-09-24 | P9 | **修复文档数字漂移**（issue #14）：README/README.zh/COMPATIBILITY 手写的 22 条断言（实为 25）、`0.1.0.tgz`（清单已 0.1.1）、78 测试（实为 87）、90 键（实为 88）全部纠正；`check.mjs` 改为导出 `collectChecks()`，断言份数由「读源码正则」变成「读一次真实运行」；新增 `tests/docs.spec.mjs` 把活体数字与文档对死，并断言 README 里**不再复述**任何会漂移的份数；`[0.1.1]` 的历史数字按新政策**加注不篡改** | `scripts/check.mjs`；`tests/docs.spec.mjs`；CHANGELOG 顶部记录该政策 |
|  |  |  |  |

---

## 4. 决策记录

> 改变方案的决定必须落这里，并在 PLAN.md 同步（一份事实一个家）。

| # | 日期 | 决策 | 理由 | 影响面 |
|---|---|---|---|---|
| A1 | 2026-09-13 | 规范依据改用 GitHub `deepseek-ai/DeepSeek-Harness@master`，本机副本仅作**存在性**交叉验证 | 本机 `deepseek-harness-dev` 是 `0.1.2-alpha.1`，与运行版差多个大版本 | 全部阶段 |
| A2 | 2026-09-13 | 宿主半**不 declare** `webServer`，默认空 `apply` | 依赖 web 专有服务会让插件在 TUI profile 永久 PENDING，卡死整个 profile | P1、P6 |
| A3 | 2026-09-13 | 客户端 bundle 采用手写闭包工厂（社区实证格式），不引入构建器生成闭包包装 | 官方 `tsdown.client.ts` 是 monorepo 内部预设，第三方无法直接复用；两个可用社区插件均手写 | P1 |
| A4 | 2026-09-13 | 客户端只读官方投影（`contextPressure` / `contextBreakdown` / `tokenUsage` / `sessionStats`），不自己 fold 事件 | 官方规则：客户端从不 fold 领域事件，只收整流值 | P2 |
| A5 | 2026-09-13 | 归因只用**已存在的数字**做分组；任何自算量必须显式标注「估算」 | 避免给出误导性的精确感（官方已声明启发式对 CJK/JSON 低估） | P3 |
| A6 | 2026-09-13 | **不**做 `conversation.input.right` 精简仪表（原计划要追加） | 该 seat 是 session scope；我们已有浮窗面板与可停靠页两处呈现，再加一个会与官方 ContextMeter 视觉重复，收益不足 | P5 |
| A7 | 2026-09-13 | 平台契约以**发布 tag `1ef9c1fa9a`（rc.1）** 为准，不以本机检出树为准：`packages/client/web/src/platform.ts` 与 `packages/client/runtime/*` 在本机领先于发布（`be531688f3`） | 本机检出的 `PRELOADED_CLIENT_EXTERNALS` 已被清空，而运行中的 GUI 里全部 rc.1 插件 bundle 仍在 `require('@deepseek-ai/dsh-client-runtime/client')`；按检出树写会与运行版不符 | 全部阶段 |
| A8 | 2026-09-13 | 面板**自行绑定投影**（`ctx.sessions.binding(id).session.projections.faceOf(key)` + inject `hooks` 舱），不用 `useProjection` | `sidebar.footer.action` 是 **root** scope，而 `useProjection` 是 **session** scope 的组件 prop、根本不是可 require 的模块。这是该座位取到会话数据的唯一合规路径（同官方 `ui-goal`） | P1、P3 |
| A9 | 2026-09-13 | 客户端源码用 `.cjs`，构建为零依赖手写装配器 | `"type": "module"` 下 `.js` 会被当 ESM 解析而 `exports` 未定义；`.cjs` 同时让 `node --test` 能直接 require。官方 `tsdown.client.ts` 预设未对第三方发布 | P1–P7 |
| A10 | 2026-09-13 | 样式注入沿用官方 `data-plugin` / `data-plugin-css` 标签约定 | 官方 `styleInjectionModule` 用该约定做样式盘点与 HMR 移除；自创命名会让 HMR 管不到 | P3 |
| A11 | 2026-09-13 | 时间线采**边界事件驱动**采样，payload 恒报 `coverage: 'observed-since-plugin-load'` | `measure()` 无 revision 参数、只读当前 durable tail，历史**无法事后回放**；与其暗示完整，不如显式标注部分覆盖 | P4 |
|  |  | D1 插件名 |  |  |
|  |  | D2 v1 范围 |  |  |
|  |  | D3 首发分发 |  |  |

---

## 5. 已知问题 / 阻塞

| # | 状态 | 问题 | 处置 |
|---|---|---|---|
| K1 | 观察 | 官方 `docs/user/develop/` 只有宿主侧教程，**没有面向第三方的客户端插件文档** | 以社区实证（modlens / dsh-usage-stats）为兼容基准；每个隐式假设写进 `docs/COMPATIBILITY.md` 一条可复跑验证 |
| K2 | 待确认 | `conversation.view` ring 是否对第三方开放注册 | P8 前置条件；未确认则不做 |
| K3 | 观察 | `tokenMeter.measure()` 为 O(surface)，逐 revision 采样在长会话可能昂贵 | 节流 + 缓存 + 上限（Config）+ 超限显式上报 |
| K4 | 已解决 | WSL 内无外网，`web_fetch` 对 github 报 private IP | 改用 `powershell.exe` 走 Windows 侧网络拉取 |
| K5 | 已解决 | ~~rc.2 未装到本机~~ → 已从 npm 装进临时目录并跑通装载矩阵（九项基线表、三个槽位、四个投影键、tokenMeter 全部仍在）；**渲染验证仍缺**（GUI 有鉴权门） | `docs/COMPATIBILITY.md` §11；残留 `D:\DSH\_plugintest\rc2*` 仅供复跑 |
| K6 | 已解决 | `--profile web` 是**内置模板**，`--dump-config` 会忽略临时 `DSH_HOME`，导致早先的装载验证全是假阴性 | 必须用**自定义** profile 名（`--profile <新名> --from-default-profile web`） |
| K7 | 已解决 | WSL 下 `DSH_HOME` 传不进 Windows 侧 node 进程 | 需 `WSLENV=DSH_HOME`，或在同一条 `powershell.exe -Command` 内 `\$env:DSH_HOME=...` 设置 |
| K8 | 已解决 | WSL 的 `ln -s` 对 Windows node 不可解析（`cannot resolve profile bundle`） | 改用 PowerShell `New-Item -ItemType Junction` |
| K9 | 待人工 | 无头环境无法代拍浏览器截图 / 手测键盘焦点与深浅色 | 交人工确认；文档中一律不声称已渲染 |
|  |  |  |  |

---

## 6. 验证证据台账

> 每条证据写清：命令 / 输出摘要 / 落盘位置 / 日期。P6 靠这张表判断能否发布。
>
> **关于数字**：本表每行都带日期，记录的是**当时那一次**验证运行，因此行内的份数是
> 历史事实而非当前值 —— 后续增长不回头改写。当前值只写在 `docs/COMPATIBILITY.md`，
> 并由 `tests/docs.spec.mjs` 对着该文件断言（断言份数取自 `check.mjs` 的
> `collectChecks()`，测试份数取自各 spec 文件）。

| 阶段 | 验证项 | 命令或操作 | 结果 | 证据位置 | 日期 |
|---|---|---|---|---|---|
| P0 | 官方规范来源可追溯 | 读 `D:\DSH\tmp\gh-docs\` | ✅ | `D:\DSH\tmp\gh-docs\` | 2026-09-13 |
| P0 | 目标版本确认 | 读两个副本 `package.json` + `versions/` | ✅ rc.1 / rc.2 | `PLAN.md` §2.1 | 2026-09-13 |
| P0 | 契约文件与发布 tag 一致性 | 逐文件 md5 比对 tag `1ef9c1fa9a` | ✅ 除 `platform.ts` / `client/runtime/*` 外全部一致 | 决策 A7；`docs/COMPATIBILITY.md` §2 | 2026-09-13 |
| P0 | 环境事实 | `node -v` / `pnpm -v` / `git --version` / dsh 版本 | ✅ v22.23.1 / 11.21.0 / 2.43.0 / 0.1.5-rc.1 | 本表；`PLAN.md` §2.1 | 2026-09-13 |
| P1 | 构建 | `node scripts/build.mjs` | ✅ `lib/index.js`（宿主 4 模块）、`lib/client.js`（客户端 11 模块） | `lib/` | 2026-09-13 |
| P1 | 合规断言 | `node scripts/check.mjs` | ✅ **25 passed, 0 failed** | `scripts/check.mjs` | 2026-09-13 |
| P1 | 装载 | 自定义 profile 装入 + `--dump-config` | ✅ 输出 `# == dsh-context-lens` / `- id: context-lens`（第 540–542 行） | 临时 `DSH_HOME=D:\DSH\_plugintest\cl-home` | 2026-09-13 |
| P1 | 卸载无残留 | 移除依赖与 bundle 行后重跑 `--dump-config` | ✅ `grep -c context-lens` = **0** | 同上 | 2026-09-13 |
| P1 | 浏览器显示 | 启动 web 看占位控件 | ⬜ **待人工** | — | — |
| P2 | 纯函数单测 | `node --test "tests/*.spec.mjs"` | ✅ **73 tests / 73 pass / 0 fail** | `tests/{model,consistency,host,bundle,degrade}.spec.mjs` | 2026-09-13 |
| P2 | 模型层零框架依赖 | 仅 `node --test` 直跑 `model/index.cjs`，无 React/DOM | ✅ | `tests/model.spec.mjs` | 2026-09-13 |
| P3 | UI 合规 grep：字面色值 | 全 `src/client/` 扫描 `#rrggbb` / `rgb(` | ✅ 0 命中（已固化为 `check.mjs` 断言） | `scripts/check.mjs` | 2026-09-13 |
| P3 | UI 合规 grep：硬编码文案 | 组件内裸字符串扫描 | ✅ 0 命中；90 键 × 2 语言键集相等有断言 | `tests/bundle.spec.mjs` | 2026-09-13 |
| P3 | 样式仅用 token | `check.mjs` 三条新断言（自定义属性 / `var()` 可解析 / elevation 不叠 border） | ✅ 且**逐条反向验证**：注入违规必 FAIL | `scripts/check.mjs` | 2026-09-13 |
| P3 | 深浅色截图 / a11y 手测 | 人工 | ⬜ **待人工** | — | — |
| P4 | 数值一致性 | 重写官方 `contextOccupancy` / `formatTokens` 逐值比对 | ✅ 一致；**并抓出 2 个真实缺陷**（locale seat 依赖、显式 0 被吞） | `tests/consistency.spec.mjs` | 2026-09-13 |
| P4 | 路由错误路径 | 403 / 405 / 400 / 404 / 503 / 截断 | ✅ 全覆盖 | `tests/host.spec.mjs` | 2026-09-13 |
| P4 | 未新增模型可见内容 | 审查宿主半无事件写入 | ✅ 宿主半只读，无 session 事件写入 | `src/host/` | 2026-09-13 |
| P6 | 降级矩阵 L0–L4 | 逐项摘除能力 | ✅ 7 条，缺一不影响其余 | `tests/degrade.spec.mjs` | 2026-09-13 |
| P6 | 双版本矩阵 | rc.1 + rc.2
（rc.2 从 npm 装入临时目录，用它自己的 CLI 派生 profile） | ✅ **两端都装载通过**：九项基线 seed table 完全相同、三个槽位与四个投影键仍在、无 runtime 预载 | `docs/COMPATIBILITY.md` §11；`D:\DSH\_plugintest\rc2` | 2026-09-18 |
| P6 | 非 web profile 安全（红线） | 装入 headless profile + `--dump-config` | ✅ 正常出层、无 pending、无 missing service | 临时 `DSH_HOME=D:\DSH\_plugintest\tui-home`，profile `hltest` | 2026-09-13 |
| P6 | 非 web 激活（更强证据） | 真实 cordis `Context` 直载宿主半，无 `webServer` / 无 `tokenMeter` | ✅ 仅注册 `context-lens: timeline recorder`，`inject = undefined`，不抛错 | `/tmp/loadtest.mjs` | 2026-09-13 |
| P6 | 导出断网可用 | 代码路径审查：Blob + 对象 URL，无 fetch/XHR | ✅ 可证；浏览器手测待人工 | `src/client/model/report.cjs` | 2026-09-13 |
| P7 | tarball 安装路径 | `npm pack` → 装进全新 profile → `--dump-config` | ✅ 输出 `# == dsh-context-lens` 层，无 error / 无 pending；tarball 自足（含 `lib/`） | `D:\DSH\_plugintest\pack-home` | 2026-09-13 |
| P7 | 打包内容审查 | `npm pack --dry-run` | ✅ 14 文件 / 47.8 kB；含 `lib/`、`cordis.patch.yml`、`docs/`、两份 README、CHANGELOG、SECURITY、LICENSE | `/tmp/cl-pack/` | 2026-09-13 |
| P7 | GitHub 安装路径 | 仓库推到公开 GitHub → 从 `github:` URL 装进全新 profile → `--dump-config` | ✅ **端到端通过**：先报 `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` → 按 pnpm 打印的**完整**键（含已解析 SHA，非裸包名）加 `allowBuilds` → `pnpm install` 执行 `prepack` 构建 `lib/` → 解析出 `# == dsh-context-lens` 层 | `github.com/yukitakasama/dsh-context-lens` | 2026-09-18 |
| P7 | npm 安装路径 | — | ⬜ 待 npm 发布（D3） | — | — |
| P9 | 合规断言 | `node scripts/check.mjs` | ✅ **25 passed, 0 failed** | `scripts/check.mjs` | 2026-09-24 |
| P9 | 全套件 | `node --test --test-isolation=none "tests/*.spec.mjs"` | ✅ **93 tests / 93 pass / 0 fail**（Windows node `v24.15.0`） | 本仓 `tests/` | 2026-09-24 |
| P9 | 断言份数改为读真实运行 | 导入 `scripts/check.mjs` 的 `collectChecks()`（导入不装 sink、不跑断言） | ✅ 返回 `passes.length = 25`，与 CLI 输出一致 | `tests/docs.spec.mjs` | 2026-09-24 |
| P9 | 文档守卫可失败（反向验证） | 分别人为加 1 个 `test()` / 1 条 `check()` / 1 个 locale 键，再跑 `tests/docs.spec.mjs` | ✅ 三次均 FAIL 且指名道姓（`the suite has 94` / `it reports 26` / 键集不等），移除后 6/6 复绿 | `tests/docs.spec.mjs` | 2026-09-24 |
| P9 | 历史数字核实（不靠转述） | `git worktree` 检出 `f1c36a2`（v0.1.0）与 `4eb9c1b` 实跑 | ✅ 两处均 `25 passed, 0 failed`；`4eb9c1b` 是 v0.1.0 tag 的祖先，故 `[0.1.1]` 的「22」在打 tag 时即已不准 | `D:\DSH\tmp\verify-010` | 2026-09-24 |
| P9 | 历史键数核实 | 从两个 tag 的 `src/client/locales.cjs` 计数 | ✅ 两处均 **90 键** —— 故 `[0.1.1]` 的「90」在 tag 上**是对的**，活的 88 是 #15 退役两个 `maxNodesPerSample*` 键所致（不篡改该行） | `git show <tag>:src/client/locales.cjs` | 2026-09-24 |
| P9 | 无 `lib/` 时的真实行为 | 移走 `lib/` 后逐 spec 直跑 | ✅ 不是「丢掉 27 个」而是**跑不过**：`bundle` 0/6、`degrade` 0/7、`externals` 1/5、`docs` 5/6、`host` **模块加载期即失败**（0 个用例）；合计 `64 tests / 46 pass / 18 fail` | 本表；README §Build requirements | 2026-09-24 |

---

## 7. 里程碑

| 里程碑 | 含义 | 目标阶段 | 状态 |
|---|---|---|---|
| M1 能装 | 插件可装载、可见占位、可卸载 | P1 | 🟡 装载 ✅ / 卸载零残留 ✅ / **浏览器可见待人工** |
| M2 能读 | 投影数据正确进入视图模型（纯函数可测） | P2 | ✅ 73 测试绿；数值与官方公式逐值一致 |
| M3 可看 | 面板给出比官方更有信息量的上下文画像 | P3 | 🟡 代码与合规校验 ✅ / **截图待人工** |
| M4 可溯 | 上下文 × 轨迹时间线（压缩台阶、缓存经济性） | P4 | ✅ 采样 + 路由 + 视图；错误路径全测 |
| M5 能融 | 可停靠页面 + 设置项 | P5 | ✅（精简仪表按 A6 放弃） |
| M6 可证 | 双版本 + TUI 安全 + 卸载无残留，证据留档 | P6 | 🟡 rc.1 ✅ / 非 web 安全 ✅ / 卸载 ✅ / **rc.2 缺一半** |
| M7 可发 | 三种安装方式可用、可被市场发现 | P7 | 🟡 材料齐 ✅ / **发布动作待决策** |

# dsh-context-lens 任务文档

> **配套计划**：[PLAN.md](./PLAN.md)（目标 / 架构 / 阶段目标 / 风险 / 规范来源）
> **本文件职责**：每阶段待办勾选 + 工作记录。计划变了改 PLAN.md，进度变了改这里。
>
> 更新时间：2026-09-13 ｜ 当前阶段：**P0** ｜ 总进度：0/8 阶段

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
| 当前阶段 | P0 规范对齐与立项 |
| 阶段内进度 | 计划与任务文档已产出，等待 D1/D2/D3 确认 |
| 阻塞 | 无 |
| 主目标版本 | dsh `0.1.5-rc.1`（本机运行版）、`0.1.5-rc.2`（GitHub master） |
| 本地库路径 | `D:\DSH\dsh-context-lens` |
| 远程仓库 | 未建 |
| 最近一次验证 | 无 |

---

## 2. 阶段待办

### P0 规范对齐与立项

**目标**：把官方规范冻结成可勾选验收项；建仓 + 建任务文档。

**A. 规范核对（每条对应 PLAN.md §1 的编号）**
- [ ] B1 宿主插件用函数形态具名导出 `name` / `inject` / `Config` / `apply`，**不写 default export**
- [ ] B2 `dsh.bundle.patch` → `cordis.patch.yml`，insert 行的 `name` 用包名
- [ ] B3 `dsh.client = { platform: 'web', inject: [...] }` 且同时提供 `exports["./client"]`
- [ ] B4 客户端 bundle 采用 `window.__ModuleLoader__.load({ id, factory })` 闭包工厂格式
- [ ] B5 只使用 baseline 隐式外部模块（react / jsx-runtime / ui-primitives…），不重复声明
- [ ] B6 **不使用** `dsh.client.external`；跨包只 `import type` / 注入服务 / 走槽位
- [ ] B7 所有注册走 `ctx.effect()` / `ctx.slots.inject()`，disposer 到位
- [ ] B8 可选服务一律 `ctx.get(name)`
- [ ] B9 可调项（刷新节流、采样步长、视图默认值）全部进 `Config` 并校验
- [ ] B10 非法 Config / 缺失必需引用时**加载期抛错**，不静默降级
- [ ] B11 分发三态确认（npm / tarball / GitHub 直装 + allowBuilds 文档）
- [ ] C1 只用 `ctx.slots.inject(key, () => ctx.slots.register(...))` 组合 UI
- [ ] C2 用到的槽位逐个在 `docs/subsystems/slots.md` 的层级树里确认 cardinality/scope
- [ ] C3 组件只吃四份 share；组件文件里不出现 `ctx`
- [ ] C4 无任何运行期跨特性插件 import
- [ ] C5 全部产品文案进 typed locale 字典，组件经 `t` 取（写 grep 校验脚本）
- [ ] C6 只用 `--dsw-alias-*` token；中性边框 0.5px；浮层用 elevation 不叠 border（写 grep 校验脚本）
- [ ] C7 无模块级副作用
- [ ] C8 明确「改客户端代码必须重建 bundle」写进 README
- [ ] C9 右侧栏 tab 用 `ctx.sidebarRightTabs.register` + `sidebar.right.pane.tab`
- [ ] C10 宿主→客户端优先走会话投影 `wire` 视图
- [ ] H1 自建路由用精确路由 + peer socket loopback 围栏 + 405
- [ ] H2 不新增模型可见内容、不碰 session 事件表、不改 agent-loop
- [ ] H3 宿主半**不 declare** `webServer`（TUI profile 红线）

**B. 立项动作**
- [ ] 建立目录 `D:\DSH\dsh-context-lens`（本文件与 PLAN.md 已在此）
- [ ] `git init` + 首个提交（仅 PLAN/TASKS/.gitignore）
- [ ] 写入 `docs/COMPATIBILITY.md` 骨架（把 PLAN.md §2.2 能力矩阵落成待验证清单）
- [ ] 记录环境事实：`node -v` / `pnpm -v` / `dsh --version` / 两个目标副本版本
- [ ] 确认 D1 插件名、D2 v1 范围、D3 首发分发方式

**阶段产出**：PLAN.md、TASKS.md、COMPATIBILITY.md 骨架、git 仓库
**退出条件**：A 组规范核对项全部勾选 + D1/D2/D3 有结论

---

### P1 加载闭环

**目标**：插件能被 profile 装载；客户端 bundle 能在 GUI 里出现一个占位控件；卸载后干净消失。

- [ ] 写 `package.json`：`type: module`、`exports`（`.` / `./client` / `./package.json`）、`dsh.bundle`、`dsh.client`、`files` 白名单
- [ ] 写 `cordis.patch.yml`（insert 一行）
- [ ] 写 `src/index.ts`：具名 `name` / `Config` / `apply`（默认空实现）
- [ ] 写 `scripts/build.mjs`：产出 `lib/index.js`（ESM）+ `lib/client.js`（闭包工厂）
- [ ] 写 `scripts/check.mjs`：`node --check` 全部产物 + manifest 断言（exports/dsh/files 一致性）
- [ ] 写最小 `src/client/index.ts`：注册 locale 字典 + 往 `sidebar.footer.action` 注册占位控件
- [ ] 建临时 `DSH_HOME`（参考 `D:\DSH\_plugintest` 做法），`dsh plugin add` 本仓库
- [ ] `dsh --profile … --dump-config` 确认出现 `# == dsh-context-lens` 层
- [ ] 启动 web，浏览器确认占位控件出现
- [ ] 移除插件，确认控件消失、无残留
- [ ] 把装载日志与 `--dump-config` 片段存进「验证证据台账」

**产出**：可装载的最小插件 + 构建/校验脚本
**退出条件**：装载、显示、卸载三件事各有实测证据；`files` 覆盖全部运行期导入与产物

---

### P2 数据层与纯函数

**目标**：投影 → 视图模型的全过程无 React，可单测。

- [ ] `src/client/model/occupancy.ts`：占用率、余量、可支撑轮数（输入：`contextPressure`）
- [ ] `src/client/model/breakdown.ts`：三段构成归一化 + 分组（system / tools / messages）
- [ ] `src/client/model/attribution.ts`：归因分组（系统提示段 / 工具 schema / 注入上下文按 provenance / 用户 / 助手 / 工具结果 / 图片）
- [ ] `src/client/model/format.ts`：K/M 数字格式化（口径与官方 `ContextMeter` 对齐）
- [ ] `src/client/model/provenance.ts`：口径判定（provider 实报锚点 vs 启发式估算）与误差提示文案键
- [ ] `tests/model.spec.ts`：正常 / 空投影 / 单投影缺失 / 异常值（负增量、零窗口、超大值、非整数）
- [ ] 跑 `node --test`（或仓库选定 runner），确认纯函数层分支全覆盖
- [ ] 确认 model 层零 DOM / 零 React 依赖（grep 校验 + 可 node 直跑）

**产出**：`src/client/model/*` + 单测
**退出条件**：单测绿；纯函数层无框架依赖

---

### P3 面板 UI v1

**目标**：做出明显强于官方 ContextMeter 的浮窗面板（L0–L2）。

- [ ] 环形占用率 + 数字（provider 实报百分比）
- [ ] 三段堆叠构成条 + 图例行
- [ ] **归因分组行**（可折叠，展开到节点/生产者）
- [ ] **余量卡**：剩余 token、按近 N 轮平均增速估算可支撑轮数、下一请求预测 vs 压缩阈值
- [ ] **口径徽标**：实报锚点 / 启发式估算 + 误差声明（CJK、JSON schema 低估）
- [ ] **缓存经济性行**：cache read/write、命中率、turn 级 token 用量
- [ ] zh / en locale 字典（typed，无硬编码文案）
- [ ] CSS Modules 产物 + 带 `data-plugin` / `data-plugin-css` 的样式注入器
- [ ] 键盘可开合、Escape 关闭、焦点可见、`aria-*` 齐全
- [ ] reduced-motion 下无动画
- [ ] 深浅色截图各一张
- [ ] grep 校验：无字面色值（`#rrggbb` / `rgb(`）
- [ ] grep 校验：组件里无裸字符串文案
- [ ] 降级实测：投影缺失时按 L0 渲染且不报错

**产出**：Snapshot 面板（含归因、余量、口径、缓存）
**退出条件**：截图 + 两个 grep 校验 + 降级实测 + a11y 手测记录齐备

---

### P4 上下文 × 轨迹时间线（核心增量）

**目标**：回答「每轮/每步上下文怎么长、压缩回收了多少」。

- [ ] `src/host/timeline.ts`：可选注入 `tokenMeter`，逐 revision 采样 `measure()`
- [ ] 分轮 / 分步增量计算；压缩前后台阶与回收量；签名增量（`surfaceDeltaTokens`）
- [ ] 采样节流 + 结果缓存 + 条数上限，全部来自 `Config`
- [ ] 只读精确路由 `GET /api/context-lens/timeline`
- [ ] peer socket loopback 围栏（`::1` / `::ffff:127.0.0.1` / `127.x` 归一化）+ 非 GET 405 + 非 loopback 403
- [ ] `tokenMeter` 缺失时**明确报错**（fail loud），不静默返回空图
- [ ] 客户端时间线视图：横轴 turn/step，纵轴 token；压缩标记与回收量；cache 曲线与墙钟叠加
- [ ] 与官方 `contextPressure` / `contextBreakdown` 在可对齐 revision 上的**一致性测试**
- [ ] 错误路径测试（403 / 405 / 缺失服务 / 超限截断上报 truncated）
- [ ] `git diff` 审查：确认未触碰 session 事件表、未新增模型可见内容

**产出**：宿主采样 + 只读路由 + 时间线视图
**退出条件**：一致性测试与错误路径测试通过；无新增会话事件；超限行为显式上报

---

### P5 深度集成

**目标**：从浮窗升级为可停靠页面，并把可调项暴露成 Config。

- [ ] `ctx.get('sidebarRightTabs')` 探测 + `register` 一个 Context tab 类型
- [ ] body 注册到 `sidebar.right.pane.tab`（keyed by id，Session scope）
- [ ] 可选 `sidebar.right.pane.tab.title`（活标题）
- [ ] 与 Trajectory 同时打开的截图
- [ ] `conversation.input.right` 追加精简仪表（**新 list id**，不覆盖官方 meter）
- [ ] `settings.section` 里加一个选项卡（刷新节流 / 采样步长 / 默认视图）
- [ ] Config 非法值加载期抛错实测
- [ ] `sidebarRightTabs` 缺失时该页面整块不注册、零副作用（旧版本实测）
- [ ] 槽位冲突审查：逐个确认未复用任何已占位 cell

**产出**：可停靠 Context 页 + 精简仪表 + 设置项
**退出条件**：rc.1 / rc.2 双版本实测通过；无槽位冲突

---

### P6 兼容性、导出与回归

**目标**：把「严格兼容」变成可复跑的证据。

- [ ] `docs/COMPATIBILITY.md` 实测版（每个能力标 ✅/❌ + 验证命令 + 日期）
- [ ] 降级矩阵测试：L0–L4 逐项缺失时的行为（缺一不影响其余）
- [ ] 磁盘上清干净再跑：`rc.1` 与 `rc.2` 各跑一遍装载 + 渲染矩阵
- [ ] **TUI profile 安全测试**：装进 TUI profile 后 profile 正常启动（不 pending）——红线
- [ ] 卸载残留审计（disposer 是否真的回收了槽位、路由、字典、CSS 标签）
- [ ] Markdown / JSON 报告导出（纯本地，无网络）
- [ ] 报告导出在断网环境可用实测
- [ ] `tests/install.spec.mjs` 端到端装载冒烟
- [ ] 把全部证据路径填进「验证证据台账」

**产出**：兼容性文档 + 回归测试 + 导出功能
**退出条件**：四条硬证据（双版本矩阵 / TUI 安全 / 卸载无残留 / 断网导出）全部留档

---

### P7 发布

- [ ] README.md + README.zh.md（首段讲清「不是用量账本」；含截图与三种安装方式）
- [ ] CHANGELOG.md
- [ ] SECURITY.md
- [ ] LICENSE（MIT）
- [ ] 建 GitHub 仓库，加 topic `dsh-plugin`
- [ ] tag `v0.1.0`
- [ ] npm 发布（若 D3 选做）或 `pnpm pack` tarball
- [ ] 三种安装方式各端到端装一遍：npm / tarball / GitHub 直装（含 `allowBuilds` 说明与 commit pin）
- [ ] README 里每条命令实跑一遍
- [ ] 市场索引可见性确认（`plugin_search` 能搜到）

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
| A6 | 2026-09-13 | 不覆盖官方 ContextMeter；我们的精简仪表走 `conversation.input.right` 追加 | 槽位规则：`single` 与已占用 keyed cell 是替换点，追加要新 list id | P5 |
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
|  |  |  |  |

---

## 6. 验证证据台账

> 每条证据写清：命令 / 输出摘要 / 落盘位置 / 日期。P6 靠这张表判断能否发布。

| 阶段 | 验证项 | 命令或操作 | 结果 | 证据位置 | 日期 |
|---|---|---|---|---|---|
| P0 | 官方规范来源可追溯 | 读 `D:\DSH\tmp\gh-docs\` | ✅ | `D:\DSH\tmp\gh-docs\` | 2026-09-13 |
| P0 | 目标版本确认 | 读两个副本 `package.json` + `versions/` | ✅ rc.1 / rc.2 | `PLAN.md` §2.1 | 2026-09-13 |
| P1 | 装载 | `dsh plugin add` + `--dump-config` | ⬜ | | |
| P1 | 显示 / 卸载 | 浏览器 + 卸载 | ⬜ | | |
| P2 | 纯函数单测 | 测试 runner | ⬜ | | |
| P3 | UI 合规 grep | 字面色值 / 硬编码文案 | ⬜ | | |
| P4 | 数值一致性 | 与官方投影对齐 | ⬜ | | |
| P6 | 双版本矩阵 | rc.1 + rc.2 | ⬜ | | |
| P6 | TUI profile 安全 | 装入 TUI profile 启动 | ⬜ | | |
| P7 | 三路安装 | npm / tarball / GitHub | ⬜ | | |

---

## 7. 里程碑

| 里程碑 | 含义 | 目标阶段 | 状态 |
|---|---|---|---|
| M1 能装 | 插件可装载、可见占位、可卸载 | P1 | ⬜ |
| M2 能读 | 投影数据正确进入视图模型（纯函数可测） | P2 | ⬜ |
| M3 可看 | 面板给出比官方更有信息量的上下文画像 | P3 | ⬜ |
| M4 可溯 | 上下文 × 轨迹时间线（压缩台阶、缓存经济性） | P4 | ⬜ |
| M5 能融 | 可停靠页面 + 设置项 + 精简仪表 | P5 | ⬜ |
| M6 可证 | 双版本 + TUI 安全 + 卸载无残留，证据留档 | P6 | ⬜ |
| M7 可发 | 三种安装方式可用、可被市场发现 | P7 | ⬜ |

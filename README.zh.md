# dsh-context-lens

**把单个 DeepSeek Harness 会话的上下文「解剖」开给你看。**

GUI 已经给了一个上下文百分比和一个轨迹视图，但它们回答不了会话变贵时你真正
想知道的那个问题：**到底是什么在吃窗口，我还剩几轮？**

`dsh-context-lens` 增加一个 **上下文透视镜** 面板，回答四件事：

1. **满了多少、还剩多少？** 占用率、剩余 token，以及按当前增速的可支撑轮数估计。
2. **它是由什么构成的？** 系统提示 / 工具 schema / 消息三段的占比条与真实 token 数。
3. **它是怎么长起来的？** 上下文 × 轨迹时间线，逐步增长与每次压缩的回收。
4. **这个数字是哪来的？** 供应商实报还是启发式估算，直说，并附上已知误差来源。

> **不是又一个用量账本。** 社区已有十多个 token 计数器。本插件的范围严格限定在
> **单个会话**的上下文**解剖**，且刻意不做计费对账。完整范围边界见
> [docs/COMPATIBILITY.md](./docs/COMPATIBILITY.md)。

---

## 它长什么样

面板从侧边栏底部的 **上下文** 动作打开，同时也可以作为右侧栏的可停靠标签页。

- **占用率** —— 环形图 + `已用 / 窗口`，附剩余 token 与按近期平均增速估算的轮数。
- **构成** —— 系统提示、工具 schema、消息的堆叠条。
- **余量规划** —— 最近 N 步的每步增速，以及下一轮是否可能超出窗口。
- **缓存经济性** —— 未缓存输入、缓存读、缓存写、输出，以及提示侧的缓存命中率。
- **时间线** —— 采样得到的上下文规模走势，标记出压缩回收点，并附逐点台账。
- **口径** —— 占用率数字来自哪个锚点。

每个数字要么是 harness 已经算好的值，要么是明确标注的估算。面板不编造它没有的精度。

---

## 安装

```sh
# 从 npm（已构建产物）
dsh plugin --profile web add dsh-context-lens

# 从 tarball（已构建产物）
pnpm pack           # 产出 dsh-context-lens-0.1.0.tgz
dsh plugin --profile web add ./dsh-context-lens-0.1.0.tgz

# 直接从 GitHub（安装时从源码构建）
dsh plugin --profile web add github:yukitakasama/dsh-context-lens
```

### 从 GitHub 直装（源码安装）

git 安装取到的是**源码，不是构建产物**，因此本包带 `prepare` 脚本，安装时从源码
构建 `lib/`。pnpm ≥ 10 在显式放行前拒绝执行 git 依赖的 `prepare`，第一次安装会报
`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`。pnpm 会打印它要的**完整**键 —— 请把那一行
原样抄进 profile 的 `pnpm-workspace.yaml`。它不是单纯的包名，而是带着已解析的
commit，所以「pin」是内建的：

```yaml
allowBuilds:
  dsh-context-lens@git+https://github.com/yukitakasama/dsh-context-lens.git#<resolved-sha>: true
```

然后重跑安装。**请把这个放行理解为「允许该包在安装时在你的机器上执行代码」。**
之所以需要它，只是因为构建是真构建 —— git 里没有提交任何预构建产物。

已在 dsh `0.1.5-rc.1` 上端到端验证：放行键存在时，`pnpm install` 会执行
`prepack`、构建 `lib/`，随后 profile 正常解析出 `# == dsh-context-lens` 层。

想自己 pin 到某个版本：

```sh
dsh plugin --profile web add github:yukitakasama/dsh-context-lens#<sha>
```

如果你 fork 了仓库，把账号名换成你自己的。

### 构建要求

从源码工作时注意：浏览器侧是**构建产物**，**改 `src/client/**` 不重建就不会生效**：

```sh
node scripts/build.mjs     # 产出 lib/index.js 与 lib/client.js
node scripts/check.mjs     # manifest 与合规断言
node --test "tests/*.spec.mjs"
```

`scripts/build.mjs` 零依赖，手写复刻官方 lazy-CJS bundle 格式 —— 因为官方
`clientBundle()` 预设并未对第三方包发布。

`lib/` 被 gitignore，而测试套件读的是构建产物，因此**必须先构建再测试**：
`host.spec.mjs` 从 `lib/` 导入宿主半，bundle / degradation / externals 三个 spec
读 `lib/client.js`。在全新 clone 上先跑 `node --test` 而不先跑
`node scripts/build.mjs`，78 个测试里会丢掉 27 个。

---

## 配置

所有可调项都是经过校验的 `Config` 字段，非法值会**在加载期抛错**而不是被静默忽略：

| 键 | 默认 | 范围 | 含义 |
|---|---|---|---|
| `sampleStride` | `1` | 1–10000 | 采样间隔多少个日志 revision。 |
| `maxSamples` | `2000` | 1–50000 | 单会话采样点上限；溢出上报为 `truncated`。 |
| `cacheTtlMs` | `15000` | 0–600000 | 同一会话结果缓存时长。 |
| `paceWindow` | `10` | 1–200 | 估算可支撑轮数时平均的最近步数。 |

```yaml
- insert:
    - id: context-lens
      name: dsh-context-lens
      config:
        sampleStride: 2
        paceWindow: 20
```

---

## 工作原理

**纯消费者。** 插件不新增会话事件、不改 `agent-loop`、不暴露任何模型可见内容。
它只是把日志里已有的数据再读一遍。

**客户端不折叠事件。** 界面上每个值都是宿主已经算好的成品，经官方会话投影送达
—— `contextPressure`、`contextBreakdown`、`tokenUsage`、`sessionStats`。

**唯一一处诚实的例外。** 时间线需要一条序列，而 harness 不提供现成的序列。因此
宿主半在「步骤边界」与「压缩边界」观察 `ctx.tokenMeter.measure()`，并通过一个只读
路由送出。两个后果都明说、不藏：

- 时间线只覆盖**插件加载之后**观察到的事件。payload 的 `coverage` 字段如实标注，
  界面也会说明。
- `measure()` 是 O(surface)，所以采样只在边界事件驱动，绝不按 token 增量，且有上限。

### 数据路径

```
宿主投影 ─┐
          ├─→ 客户端视图模型（纯函数、可单测）─→ 面板
宿主计量 ─┘
```

---

## 兼容性

已在 **dsh 0.1.5-rc.1** 与 **0.1.5-rc.2** 上验证 —— 同一份构建产物两端都能装载，
两版的基线模块表、投影键与槽位均未变。宿主半**不声明任何必需服务**，这是有意
的设计：依赖 `webServer` 会让插件在 TUI profile 里永远停在 `PENDING`，进而拖死整个
profile。所有可选能力（`sessions`、`sidebarRightTabs`、`settings`、`tokenMeter`、
`webServer`）都用 `ctx.get` 探测，缺一个只关掉一个座位。

完整矩阵、降级分层与可复跑验证命令见 [docs/COMPATIBILITY.md](./docs/COMPATIBILITY.md)。

---

## 开发

```sh
node scripts/build.mjs                # 先跑这个：构建两个半体到 lib/
node scripts/check.mjs                # 22 条 manifest / 合规断言
node --test "tests/*.spec.mjs"        # 78 个测试
```

`scripts/check.mjs` 强制那些类型检查管不到的规则：禁止 `default` 导出（会静默丢掉
`inject`）、禁止字面色值、禁止宿主半出现裸运行时 import、宿主半不得声明服务。

---

## 许可

MIT —— 见 [LICENSE](./LICENSE)。

# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — P0 规范对齐与立项
- `PLAN.md` and `TASKS.md`: the frozen official-spec baseline (B1–B11, C1–C10,
  H1–H3), the L0–L4 degradation ladder, and the per-stage acceptance criteria.
- `docs/COMPATIBILITY.md`: the landed, evidence-backed capability matrix.

### Added — P1 加载闭环
- Dual manifest: `dsh.bundle.patch` → `cordis.patch.yml` and
  `dsh.client = { platform: 'web' }` with `exports["./client"]`.
- Dependency-free host half (plain Node ESM, named exports only, **no `inject`
  declaration**) so a TUI profile can load the plugin without reaching PENDING.
- `scripts/build.mjs`: a dependency-free assembler that reproduces the official
  lazy-CJS bundle format (`window.__ModuleLoader__.load({ id, factory })`),
  because the harness's `clientBundle()` preset is not published.
- `scripts/check.mjs`: 22 manifest and compliance assertions, including the
  `default`-export regression guard, literal-color ban, and host import purity.

### Added — P2 数据层与纯函数
- `src/client/model/`: the whole projection→view-model layer as total functions
  with no React, no DOM and no `ctx`, so it runs under plain `node --test`.
- Occupancy, composition, headroom, cache-economics, provenance and timeline
  derivations, each degrading to `available: false` rather than throwing.

### Added — P3 面板 UI
- The Context Lens panel: occupancy ring, stacked composition bar, headroom
  card, cache economics, provenance badge, and the measurement-basis note.
- Typed `zh`/`en` locale dictionaries (90 keys each, key sets asserted equal).
- Styles using only `--dsw-alias-*` tokens; elevated popover uses elevation with
  `border: 0`; `prefers-reduced-motion` honored; full keyboard dismissal.

### Added — P4 上下文 × 轨迹
- Host-half timeline recorder sampling `ctx.tokenMeter.measure()` at step and
  compaction boundaries, with a bounded per-session ring and reported truncation.
- Exact loopback-only route `GET /api/context-lens/timeline` with 403/405/503
  semantics and a TTL cache.
- Timeline sparkline with reclaim steps marked, plus a per-sample ledger.

### Added — P5 深度集成
- Dockable right-sidebar tab (`sidebar.right.pane.tab`, `extension` band).
- Settings section exposing the validated tunables, reporting unavailability
  honestly when no settings service is present.

### Added — P6 兼容性/导出/回归
- `SECURITY.md` documenting the route fence and the install-time trust boundary.
- Degradation-matrix tests: each optional capability removed in turn, asserting
  the remaining seats still register.

### Added — P7 发布材料
- `README.md`, this changelog, `LICENSE` (MIT).

### Design decisions worth recording
- **The timeline is observed, not reconstructed.** `tokenMeter.measure()` reads
  only the current durable tail and takes no revision argument, so a past
  timeline cannot be replayed after the fact. The host records at boundaries
  while the session runs, and the payload's `coverage` field states that samples
  begin at plugin load instead of implying full history.
- **The panel binds projections itself.** `sidebar.footer.action` is a
  root-scope seat and `useProjection` is a session-scope component prop, so the
  panel resolves `ctx.sessions.binding(id).session.projections.faceOf(key)` and
  receives it through the inject `hooks` compartment — the same pattern the
  shipped `ui-goal` plugin uses.
- **Client sources are `.cjs`.** The browser half is authored as CommonJS
  because that is what the loader materializes; the `.cjs` extension keeps
  `node --test` able to require them directly under `"type": "module"`.

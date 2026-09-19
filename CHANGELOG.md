# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed — the measurement-basis badge
- The **"Measurement basis" badge rendered `provenance.none` / "No anchor" for
  every session**, including ones the host had measured against a
  provider-reported anchor. `provenanceOf` has three branches and both
  dictionaries carry copy for all three, but the value selecting between them
  never reached the model — a broken chain in two places. `timelineOf` dropped
  the `baselineKind` the host samples onto every point, and `buildViewModel`
  read it from `input.baselineKind`, which no caller sets (the four projection
  keys carry no anchor at all). `timelineOf` now preserves the field, and
  `buildViewModel` takes it from the **newest sample** — the one contemporaneous
  with the occupancy figure — through the new `newestBaselineKind` helper.
  `provenance.reported` and `provenance.estimated` are reachable again; the
  third branch still reports a session with no sampled point. Closes #2.
- `tests/model.spec.mjs` pins the chain at both hops: the fold keeps each
  sample's anchor (and coerces an absent or malformed one to `none`), the
  newest sample decides, and an end-to-end `buildViewModel` case asserts the
  three branches. Verified `81 tests / 81 pass / 0 fail`.

### Fixed — the suite now runs on Windows
- `tests/host.spec.mjs` and `tests/consistency.spec.mjs` passed a native path to
  `await import()`. The ESM loader read the `D:` of `D:\...` as a URL scheme and
  threw `ERR_UNSUPPORTED_ESM_URL_SCHEME` at **module-load time**, so every test in
  both files was lost rather than one: Windows reported `44 tests / 42 pass / 2 fail`
  and the whole loopback-fence adversarial suite silently did not run. Both files
  now build a file URL with `pathToFileURL()`. Verified `78 tests / 78 pass / 0 fail`
  on Windows (`v24.15.0`) and unchanged on Linux (`v22.23.1`). Closes #1.
- `README.md`, `README.zh.md` and `docs/COMPATIBILITY.md` now state that the build
  is a **prerequisite for the tests**: `lib/` is gitignored, `host.spec.mjs` imports
  the host half from it, and the bundle/degradation/externals specs read
  `lib/client.js`, so `node --test` on a fresh clone loses 27 of the 78 tests until
  `node scripts/build.mjs` has run.

## [0.1.1] — 2026-09-18

Docs-and-manifest release: **no plugin behaviour changed since 0.1.0.**
The manifest version now matches the tag (0.1.0 was still stamped at v0.1.1).

### Verified — dsh 0.1.5-rc.2
- Ran the dual-version matrix: installed `@deepseek-ai/dsh@0.1.5-rc.2` into a scratch
  directory, used **its own CLI** to derive a profile, and loaded this plugin's
  rc.1 build into it. The `# == dsh-context-lens` layer resolves with no error and
  no pending.
- rc.2's baseline seed table is the **same nine modules** as rc.1 (with `react` as
  an unquoted minified key), contains **no** `dsh-client-runtime/client` preload,
  and still provides the four projection keys, the `tokenMeter` service, and all
  three slots this plugin registers into.
- Remaining gap: neither version has browser rendering verified — the GUI is
  auth-gated and cannot be inspected from a fresh browser context.

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
- External-module contract test: every bare `require()` in the built bundle is
  checked against the **running shell's** actual seed table (extracted from
  `dsh-web-frontend@0.1.5-rc.1/dist`), so a specifier that would throw in the
  browser fails the suite instead.

### Corrected — platform baseline
- The rc.1 shell's real seed table is the nine baseline modules only, and it
  contains **no** `@deepseek-ai/dsh-client-runtime/client` specifier; the 40
  installed client bundles in the live GUI require none either. The earlier
  working-tree note that rc.1 preloaded a runtime external does not hold for the
  **running** build, so the bundle relies on the baseline table alone. This is
  now pinned by a test rather than asserted in prose.

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

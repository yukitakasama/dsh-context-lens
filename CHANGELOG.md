# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **A note on counts.** Every count in this file records the verification run
> for *that* entry, at *that* commit — including entries still under
> [Unreleased], which were written at different times and legitimately differ.
> A figure is therefore never rewritten as the suite grows, and is
> deliberately **not** asserted by any test: asserting a historical number would
> only recreate the drift it records. Where a figure is known to have been wrong
> when written, the correction is stated beside the original, not substituted
> for it. The figures the project stands behind *today* live in
> `docs/COMPATIBILITY.md`, and those are not hand-maintained —
> `tests/docs.spec.mjs` reads the assertion count from `check.mjs`
> (`collectChecks()`) and the test count from the spec files and asserts each
> against that document, so they fail the suite when they drift.

## [Unreleased]

### Fixed — documented counts are derived, not hand-copied
- `README.md`, `README.zh.md` and `docs/COMPATIBILITY.md` quoted figures that
  no longer matched the commands they named: the compliance suite was
  documented as **22 assertions** (it reports **25**), the tarball as
  `dsh-context-lens-0.1.0.tgz` (`package.json` is at **0.1.1**), the suite as
  **78 tests** (**87** at the tree this issue describes, **93** once the new
  `tests/docs.spec.mjs` joins it), and the dictionaries as **90 keys** (they
  hold **88**). The repository had been contradicting itself — `COMPATIBILITY.md`
  stated both 22 and 25 for the same command — which is the tell that none of
  these numbers came from the tooling. Closes #14.
- The counts are no longer maintained by hand at all. `scripts/check.mjs` now
  exports **`collectChecks()`** — the same function its CLI runs — so the
  assertion count can be read instead of counted from a regex over the file,
  and importing it installs no sink and runs no check. "N assertions" was
  never a property of the source text; it is a property of a *run*, and
  reading it any other way is what let 22 and 25 coexist.
- `tests/docs.spec.mjs` is new and closes the class rather than the
  instances. It derives the live assertion count from `collectChecks()`, the
  live test count from the `test(` declarations in the spec files, and the
  live dictionary size from the shipped locales, then asserts each against
  the document that quotes it. It also asserts the **absence** of a restated
  count in both READMEs, because the fix is "quote the command, not its
  output": a re-added number is the regression, not a new number.
- Both READMEs now name the tarball `dsh-context-lens-<version>.tgz` and say to
  read the name `pnpm pack` prints, so the documented filename cannot drift
  from the manifest again.
- The "a fresh clone loses 27 of the 78 tests" claim was also a
  mis-description, not just a stale number: with `lib/` absent the suite does
  not lose a subset, it **cannot pass at all** — and it reports *fewer* tests
  than it declares, because `host.spec.mjs` fails while `await import`ing its
  own subject, before any `test()` in it runs. Measured per file on this tree
  with `lib/` moved aside: `bundle` 0/6, `degrade` 0/7, `externals` 1/5,
  `host` **not loaded**, `docs` 5/6 — `64 tests / 46 pass / 18 fail` in total,
  against 93/93 when `lib/` is present. The READMEs now describe that instead of
  quoting "27 of 78", which no run ever produced.
- `docs/COMPATIBILITY.md` no longer restates a Linux/WSL test count it cannot
  re-derive on this machine (`wsl.exe` fails with
  `Wsl/Service/E_ACCESS_DENIED`); it states the Windows figure it measured.
  Its header, run book and evidence ledger are updated, and the C5 row and the
  locale row now carry the measured key count.

### Changed — released CHANGELOG figures are annotated, not rewritten
- The `[0.1.1]` entry's "22 manifest and compliance assertions" is annotated
  with the measured **25** for the tagged tree rather than edited, and the
  count policy is now stated at the top of this file. Deciding this was part
  of the issue: a released entry describes what a release did, so a figure
  that was wrong when written is part of the historical record. Verified from
  the tagged trees themselves — `v0.1.0` (`f1c36a2`) and `v0.1.1` both report
  `25 passed, 0 failed`, because the three stylesheet assertions landed in
  `4eb9c1b`, which is an ancestor of the `v0.1.0` tag. Its "90 keys each" is
  **correct** at that tag and is left untouched; the live 88 reflects `#15`
  retiring the two `settings.maxNodesPerSample*` keys.
- By the same policy, the [Unreleased] `#15` entry keeps its "80 tests" with a
  correction beside it: the suite at that commit is 87, so 80 was never the
  count at that tree.

### Fixed — the timeline response no longer ships the surface node set
- Every sample carried a `nodes[]` echo of up to 500 surface nodes that **no
  client code reads** — the sparkline is sized from `totalTokens`, and
  `timelineOf` maps each sample to a fresh object without the array. Measured,
  the unused array was **99.1% of the response body**: 4,613 KB → 42 KB at 200
  samples × 500 nodes, extrapolating to ~46 MB at the default `maxSamples` of
  2,000, all of it `no-cache` and refetched on every panel open, session switch
  and refresh. The host now samples `nodeCount` (one integer, a meaningful
  property of a sample) and **does not serialise the array at all**; per-node
  detail, if ever wanted, belongs behind a separate explicitly-requested route
  rather than attached to every sample of the main series. Closes #15.
- `maxNodesPerSample` is retired with the array it capped, so
  `settings.section` no longer offers an inert knob and a profile that still
  sets it now **fails loud at load time** (`unknown config key`) instead of
  silently accepting a value that changes nothing. Both shipped dictionaries
  drop the two `settings.maxNodesPerSample*` keys, so the zh/en key sets stay
  equal.
- `tests/host.spec.mjs` guards the regression: a 500-node measurement yields a
  sample with `nodeCount: 500` and no `nodes` / `nodesTruncated` field, the
  serialised body stays under 1 KB for that sample, the retired key throws, and
  the empty-session route body carries no node array either. Verified
  `80 tests / 80 pass / 0 fail`, `check.mjs` `25 passed, 0 failed`.
  **Correction (2026-09-24): the suite at this commit is `87 tests / 87 pass /
  0 fail`** — `80` was never the count at this tree. Per the note at the top of
  this file the figure is left in place; the live total is asserted against
  `docs/COMPATIBILITY.md` by `tests/docs.spec.mjs`.

### Fixed — the export could silently produce no file
- `download()` revoked the blob object URL **in the same synchronous task as
  `anchor.click()`**. A click only *starts* the navigation; the browser reads
  the blob on a later task, so the revoke could land first and cancel the export
  before it began — and because nothing threw, `exportReport`'s `try/catch`
  never fired and the user saw a success notice with no file. The revoke is now
  deferred one task with `setTimeout(() => URL.revokeObjectURL(url), 0)`, so the
  URL stays resolvable until the browser has taken the data. Closes #16.
- The success/failure notices described the wrong action: both dictionaries
  reported a file download as a clipboard copy (`action.copied` / "Copied",
  `action.copyFailed`). The keys are now `action.exported` / `action.exportFailed`
  — "Report saved" / "Export failed" (zh: "报告已保存" / "导出失败") — so the copy
  names the file the user should look for.
- `tests/panel.spec.mjs` guards the ordering against a fake DOM and object-URL
  implementation: the URL must still be alive when `download()` returns and be
  revoked on the next task, both dictionaries must carry the renamed keys and
  drop the old ones, and the panel source must not mention a copy action.
  Verified `85 tests / 85 pass / 0 fail`, `check.mjs` `25 passed, 0 failed`.
- The export path is now **verified in a real browser** (Chromium), closing the
  `COMPATIBILITY.md` "浏览器渲染 — ⬜ 待人工" line for this path: the built
  `lib/client.js` was materialized against real React 18.3.1, the panel rendered,
  and Export → Markdown and Export → JSON were driven through a genuine
  Playwright download. Both saved the correct 888-byte Markdown / 1332-byte JSON
  document. The same-task object-URL resolvability probe — a real `fetch()` of
  the blob URL issued immediately after the click handler returned — **fails
  with `TypeError` on the pre-fix bundle and returns HTTP 200 / the full payload
  on the fixed one**.

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
  **Correction (2026-09-24): the tagged tree at v0.1.0/v0.1.1 actually reports
  `25 passed, 0 failed`** — the three stylesheet assertions landed in the same
  release (`4eb9c1b`, which is an ancestor of the v0.1.0 tag) but were never
  added to this line. The historical figure is kept above; the live one is
  asserted by `tests/docs.spec.mjs`.

### Added — P2 数据层与纯函数
- `src/client/model/`: the whole projection→view-model layer as total functions
  with no React, no DOM and no `ctx`, so it runs under plain `node --test`.
- Occupancy, composition, headroom, cache-economics, provenance and timeline
  derivations, each degrading to `available: false` rather than throwing.

### Added — P3 面板 UI
- The Context Lens panel: occupancy ring, stacked composition bar, headroom
  card, cache economics, provenance badge, and the measurement-basis note.
- Typed `zh`/`en` locale dictionaries (90 keys each, key sets asserted equal).
  (90 was correct at this tag — verified from the tagged tree. The live count is
  now 88: `#15` retired the two `settings.maxNodesPerSample*` keys with the
  array they capped.)
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

# dsh-context-lens

**Context anatomy for a single DeepSeek Harness session.**

The GUI already shows you a context percentage and a trajectory view. Neither
answers the question you actually have when a session gets expensive: *what is
eating the window, and how many turns do I have left?*

`dsh-context-lens` adds a **Context Lens** panel that answers four things:

1. **How full is it, and what is left?** Occupancy, remaining tokens, and an
   estimated turn capacity at the current pace.
2. **What is it made of?** System prompt vs tool schemas vs messages, as a
   proportional bar with real token figures.
3. **How did it get there?** A context × trajectory timeline showing each step's
   growth and each compaction's reclaim.
4. **Where did the number come from?** Provider-reported vs heuristic estimate,
   stated plainly, with the measurement's known error modes.

> **Not another usage ledger.** The ecosystem already has a dozen token
> counters. This plugin is scoped to a single session's context *anatomy*, and
> it deliberately does not do billing reconciliation. See
> [docs/COMPATIBILITY.md](./docs/COMPATIBILITY.md) for the full scope boundary.

---

## What it looks like

The panel opens from a **Context** action in the sidebar footer, and is also
available as a dockable tab in the right sidebar. It reads:

- **Occupancy** — a ring plus `used / window`, with the remaining tokens and an
  estimated number of turns left at the recent average growth rate.
- **Composition** — a stacked bar of system prompt, tool schemas, and messages.
- **Headroom** — the per-step growth rate over the last N steps and whether the
  next turn risks exceeding the window.
- **Cache economics** — uncached input, cache read, cache write, output, and the
  prompt-side cache hit rate.
- **Timeline** — a sparkline of sampled context size with reclaim steps marked,
  plus a ledger of every sample.
- **Measurement basis** — which anchor the occupancy figure came from.

Every figure is either a value the harness computed or a labelled estimate. The
panel never invents precision it does not have.

---

## Install

```sh
# From npm (prebuilt)
dsh plugin --profile web add dsh-context-lens

# From a tarball (prebuilt)
pnpm pack           # produces dsh-context-lens-0.1.0.tgz
dsh plugin --profile web add ./dsh-context-lens-0.1.0.tgz
```

### From GitHub (source install)

A git install fetches **sources, not built artifacts**, so the package ships a
`prepare` script that builds `lib/` from source. pnpm ≥ 10 refuses to run a git
dependency's `prepare` until you allow it, so the first `add` fails; copy the
exact package key pnpm prints into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  dsh-context-lens: true
```

Then re-run the `add`. **Treat that allowance as permission to execute this
package's code on your machine at install time.** Pin a commit so a later push
cannot silently change what runs:

```sh
dsh plugin --profile web add github:<owner>/dsh-context-lens#<sha>
```

### Build requirements

If you are working from a checkout, the browser half is a built artifact — **a
change to `src/client/**` does nothing until you rebuild**:

```sh
node scripts/build.mjs     # writes lib/index.js and lib/client.js
node scripts/check.mjs     # manifest + compliance assertions
node --test "tests/*.spec.mjs"
```

`scripts/build.mjs` is dependency-free and hand-reproduces the official
lazy-CJS bundle format, because the harness's `clientBundle()` preset is not
published for third-party packages.

---

## Configuration

All tunables are validated `Config` fields, so an invalid value **throws at load
time** rather than being silently ignored:

| Key | Default | Range | Meaning |
|---|---|---|---|
| `sampleStride` | `1` | 1–10000 | Log revisions to advance between samples. |
| `maxSamples` | `2000` | 1–50000 | Sample cap per session; overflow is reported as `truncated`. |
| `maxNodesPerSample` | `500` | 1–10000 | Surface nodes echoed per sample. |
| `cacheTtlMs` | `15000` | 0–600000 | How long a read stays valid. |
| `paceWindow` | `10` | 1–200 | Recent steps averaged for the capacity estimate. |

```yaml
- insert:
    - id: context-lens
      name: dsh-context-lens
      config:
        sampleStride: 2
        paceWindow: 20
```

---

## How it works

**Pure consumer.** The plugin adds no session event, changes no `agent-loop`
code, and exposes nothing model-visible. It is a second reading of data the log
already carries.

**The client never folds events.** Every displayed value is a finished value the
host already computed, arriving through the official session projections —
`contextPressure`, `contextBreakdown`, `tokenUsage`, `sessionStats`.

**One honest exception.** The timeline needs a series, and the harness offers no
prerendered one. So the host half observes `ctx.tokenMeter.measure()` at step and
compaction boundaries and serves that over a read-only route. Two consequences
are stated rather than hidden:

- The timeline covers only events observed **since the plugin loaded**. The
  payload says so in its `coverage` field, and the UI labels it.
- `measure()` is O(surface), so sampling is event-driven at boundaries only,
  never per token delta, and capped.

### Data path, in one line

```
host projections ─┐
                  ├─→ client view model (pure, tested) ─→ panel
host token meter ─┘
```

---

## Compatibility

Verified against **dsh 0.1.5-rc.1** on the Web GUI. Declares **no required
service**, which is deliberate: depending on `webServer` would strand the plugin
in `PENDING` in a TUI profile and stall the entire profile. Every optional
capability (`sessions`, `sidebarRightTabs`, `settings`, `tokenMeter`,
`webServer`) is probed with `ctx.get`, so a missing one disables exactly one
seat.

Full matrix, degradation tiers, and reproducible verification commands live in
[docs/COMPATIBILITY.md](./docs/COMPATIBILITY.md).

---

## Development

```sh
node scripts/build.mjs                # build both halves into lib/
node scripts/check.mjs                # 22 manifest/compliance assertions
node --test "tests/*.spec.mjs"        # 64 tests
```

`scripts/check.mjs` enforces the rules a type checker cannot: no `default`
export (it would silently drop `inject`), no literal colors, no bare runtime
import in the host half, and a host half that declares no service.

---

## License

MIT — see [LICENSE](./LICENSE).

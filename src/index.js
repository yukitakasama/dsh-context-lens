/**
 * dsh-context-lens — host half.
 *
 * Deliberately tiny and dependency-free. This half exists for exactly one
 * reason (from P4 on): to sample `ctx.tokenMeter.measure()` over a session's
 * log revisions and serve that read-only over an exact loopback route. Every
 * other view is fed by the official session projections on the client side.
 *
 * Two hard constraints shape this file:
 *
 *  1. It declares NO service (see `inject` below). Depending on `webServer`
 *     would leave the plugin PENDING forever in a TUI profile and stall the
 *     whole profile — the red line in `D:\DSH\AGENTS.md`. The route is instead
 *     registered behind an optional `ctx.get('webServer')` probe, and the
 *     `tokenMeter` service is likewise optional.
 *  2. It adds NOTHING model-visible. There is no new session event, no
 *     `agent-loop` change and no tool schema: the timeline is another reading
 *     of data the log already carries.
 *
 * The module is plain ESM with named exports only. A `default` export would
 * silently replace the named ones and drop `inject` (postmortem 0001), so
 * `scripts/check.mjs` asserts its absence.
 *
 * @module dsh-context-lens
 */

export { name, Config, apply } from './host/index.js'

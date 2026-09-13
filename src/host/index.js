/**
 * The plugin's host-half entry: named exports only.
 *
 * `inject` is EMPTY on purpose. The host half needs `webServer` to serve the
 * optional timeline route and `tokenMeter` to sample it, but declaring either
 * as a dependency would strand the plugin in PENDING in a TUI profile — where
 * `webServer` never exists — and stall the entire profile (the red line in
 * `D:\DSH\AGENTS.md`). Both are therefore reached through the optional-service
 * probe `ctx.get(...)`, and the plugin degrades to a no-op host half when they
 * are absent. The client half is where all the UI lives, and it registers in a
 * web profile only.
 *
 * Nothing here is model-visible: no tool schema, no new session event, no
 * `agent-loop` change. The timeline route only reads.
 *
 * @module dsh-context-lens/host
 */

import { Config, validateConfig } from './config.js'
import { TimelineRecorder, TIMELINE_PATH, createTimelineHandler } from './timeline.js'

/** Cordis plugin name. */
export const name = 'context-lens'

export { Config }

/**
 * Plugin body.
 *
 * @param ctx - the host context.
 * @param rawConfig - raw config from the loader, validated here.
 * @returns nothing; all registrations ride the fiber's effect lifetime.
 * @throws when the config is invalid.
 */
export function apply(ctx, rawConfig = {}) {
  const config = validateConfig(rawConfig)

  const recorder = new TimelineRecorder(() => ctx, config)
  ctx.effect(() => recorder.start(ctx), 'context-lens: timeline recorder')

  // Optional route: only where a web server exists. `ctx.get` rather than an
  // `inject` declaration is what keeps a TUI profile loadable.
  const webServer = ctx.get('webServer')
  if (webServer === undefined || typeof webServer.register !== 'function') {
    ctx.logger?.debug?.('context-lens: no webServer in this profile; timeline route not registered')
    return
  }

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: TIMELINE_PATH,
    handler: createTimelineHandler(() => ctx, recorder),
  }), 'context-lens: timeline route')
}

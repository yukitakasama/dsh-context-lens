/**
 * dsh-context-lens — browser half, plugin body.
 *
 * Registers the locale dictionaries, the stylesheet, and the sidebar footer
 * action. Everything else is pure functions under `model/` and presentational
 * components under `views/`.
 *
 * The data path is the official one: session projections, folded on the host,
 * delivered as finished values. The client never folds domain events itself.
 * Because `sidebar.footer.action` is ROOT scope it does not receive the
 * session standard kit, so the panel binds the current session's projection
 * faces through its own observable source (`views/source.js`) and receives it
 * through the inject `hooks` compartment — the sanctioned channel for a
 * registrant-private reactive fact.
 *
 * `inject` names only baseline services. The Cordis service names below
 * (`slots`, `locale`) are the two the shipped feature plugins declare, so the
 * body activates on rc.1 and rc.2 alike. Everything else is probed with
 * `ctx.get`, so a missing capability degrades one view instead of stranding
 * the whole plugin in PENDING.
 *
 * @module dsh-context-lens/client
 */

const { NS, zh, en } = require('./locales.cjs')
const { injectStyles } = require('./styles.cjs')
const { ContextLensPanel } = require('./views/panel.cjs')
const { createContextLensSource } = require('./views/source.cjs')

/** Services this body requires; both exist from rc.1 on. */
const inject = ['slots', 'locale']

/**
 * Client plugin body: dictionaries, styles, and the footer action seat.
 * @param ctx - client root context.
 */
function apply(ctx) {
  ctx.effect(() => injectStyles(), 'context-lens: stylesheet')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'context-lens: dictionaries')

  // `sessions` is what makes the projections reachable from a root-scope seat.
  // It is probed rather than declared so an assembly without a session
  // controller still loads this plugin (the panel then reports "no session").
  const sessions = ctx.get('sessions')
  if (sessions === undefined) {
    ctx.logger?.debug?.('context-lens: no session controller; footer action not registered')
    return
  }

  const source = createContextLensSource({
    sessions,
    fetcher: input => fetch(input),
  })

  ctx.effect(() => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'context-lens',
    order: 40,
    locale: NS,
    inject: () => ({
      // A bare observable: the renderer binds it to `useContextLens`.
      hooks: { contextLens: source },
      refresh: () => { source.rebind(); source.refreshTimeline() },
    }),
  }, ContextLensPanel)), 'context-lens: footer action')
}

exports.apply = apply
exports.inject = inject
exports.NS = NS

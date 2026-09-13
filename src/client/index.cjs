/**
 * dsh-context-lens — browser half, plugin body.
 *
 * Registers the locale dictionaries, the stylesheet, and up to three seats:
 * a sidebar footer action, a dockable right-sidebar tab, and a settings
 * section. Everything else is pure functions under `model/` and presentational
 * components under `views/`.
 *
 * The data path is the official one: session projections, folded on the host,
 * delivered as finished values. The client never folds domain events itself.
 *
 * Why the panel binds projections itself: `sidebar.footer.action` is ROOT
 * scope, and `useProjection` is a session-scope component PROP — it is not a
 * requirable module and a root-scope seat never receives it. So
 * `views/source.cjs` resolves the current session through
 * `ctx.sessions.binding(id).session.projections.faceOf(key)`, subscribes, and
 * hands the component a bare observable through the inject `hooks`
 * compartment. That is the sanctioned channel for a registrant-private
 * reactive fact, and it is the pattern the shipped `ui-goal` uses.
 *
 * `inject` names only the two baseline services the shipped feature plugins
 * declare, so the body activates on rc.1 and rc.2 alike. Every other service
 * (`sessions`, `sidebarRightTabs`, `settings`) is probed with `ctx.get`, so a
 * missing capability degrades one seat instead of stranding the whole plugin
 * in PENDING.
 *
 * @module dsh-context-lens/client
 */

const { NS, zh, en } = require('./locales.cjs')
const { injectStyles } = require('./styles.cjs')
const { ContextLensPanel } = require('./views/panel.cjs')
const { createContextLensSource } = require('./views/source.cjs')
const { registerTab } = require('./views/tab.cjs')
const { ContextLensSettings, createSettingsSource } = require('./views/settings.cjs')

/** Services this body requires; both exist from rc.1 on. */
const inject = ['slots', 'locale']

/**
 * Client plugin body.
 * @param ctx - client root context.
 */
function apply(ctx) {
  ctx.effect(() => injectStyles(), 'context-lens: stylesheet')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'context-lens: dictionaries')

  // --- the shared data source (one instance, several seats) ---------------
  // `sessions` is what makes the projections reachable from a root-scope seat.
  // It is probed rather than declared so an assembly without a session
  // controller still loads this plugin (the panel then reports "no session").
  const sessions = ctx.get('sessions')
  const source = sessions === undefined
    ? undefined
    : createContextLensSource({ sessions, fetcher: input => fetch(input) })

  // --- L0: the footer action (the baseline seat) --------------------------
  if (source !== undefined) {
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
  } else {
    ctx.logger?.debug?.('context-lens: no session controller; footer action not registered')
  }

  // --- L3: the dockable tab (optional, probed inside registerTab) ---------
  if (source !== undefined) registerTab(ctx, source, NS)

  // --- the settings section (optional, probed) ----------------------------
  const settings = createSettingsSource(ctx)
  ctx.effect(() => ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'context-lens',
    order: 60,
    label: () => ctx.locale.bind(NS)('action.badge'),
    locale: NS,
    inject: () => ({ hooks: { contextLensSettings: settings } }),
  }, ContextLensSettings)), 'context-lens: settings section')
}

exports.apply = apply
exports.inject = inject
exports.NS = NS

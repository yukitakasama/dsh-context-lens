/**
 * The dockable right-sidebar tab: registers a `context-lens` tab type and its
 * body, so the panel can live beside the official Trajectory view instead of
 * only in a floating popover.
 *
 * This is the L3 capability tier and is strictly optional. `sidebarRightTabs`
 * is probed with `ctx.get` and the whole module is skipped when it is absent,
 * because an assembly without the right sidebar must still load the footer
 * action rather than fail. That is the same reason the host half declares no
 * service: a missing optional capability degrades one view, never the plugin.
 *
 * The tab is a page, not a viewer: it claims no address, so no document is ever
 * routed into it. `priority: 'extension'` is the shipped default for a type
 * from outside the product.
 *
 * @module dsh-context-lens/client/views/tab
 */

const React = require('react')
const { createElement: h } = React
const { PanelBody } = require('./panel.cjs')

/** This implementation's identity; also the key its body registers under. */
const TAB_ID = 'dsh-context-lens'

/** The tab kind this plugin owns. */
const TAB_KIND = 'context-lens'

/**
 * Build the tab-type definition.
 *
 * @param t - the namespace-bound translate seat.
 * @returns the definition for `ctx.sidebarRightTabs.register`.
 */
function tabDefinition(t) {
  return {
    id: TAB_ID,
    kind: TAB_KIND,
    // The band for a type from outside the product; it outranks shipped viewers.
    priority: 'extension',
    title: () => t('action.badge'),
    guide: [{
      order: 50,
      title: () => t('panel.title'),
      description: () => t('panel.subtitle'),
    }],
  }
}

/**
 * The tab body: the same sections as the popover, without the popover chrome.
 *
 * @param props - slot props; `t` comes from the declared locale namespace and
 *   `useContextLens` is bound from the inject `hooks` compartment.
 * @returns the tab body element.
 */
function ContextLensTab(props) {
  const { t, useContextLens } = props
  const snapshot = useContextLens(value => value)
  return h('div', { className: 'cl_body cl_bodyPane' }, h(PanelBody, {
    model: snapshot.model,
    t,
  }))
}

/**
 * Register the tab type, its body, and its chip title.
 *
 * @param ctx - client root context.
 * @param source - the shared observable source (one instance, two seats).
 * @param ns - the locale namespace.
 * @returns nothing; registrations ride the caller's effect lifetime.
 */
function registerTab(ctx, source, ns) {
  const tabs = ctx.get('sidebarRightTabs')
  if (tabs === undefined || typeof tabs.register !== 'function') return

  const t = ctx.locale.bind(ns)
  ctx.effect(() => tabs.register(tabDefinition(t)), 'context-lens: tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab',
    key: TAB_ID,
    locale: ns,
    inject: () => ({ hooks: { contextLens: source } }),
  }, ContextLensTab)), 'context-lens: tab body')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title',
    key: TAB_ID,
  }, ContextLensTabTitle)), 'context-lens: tab title')
}

/**
 * The chip title. Static copy in the chip is the norm for a type with no live
 * per-tab state; declaring it keeps the title in the locale dictionary rather
 * than baked into `title(address)` at open time.
 *
 * @param props - `{ t }` from the declared locale namespace.
 * @returns the chip title element.
 */
function ContextLensTabTitle(props) {
  return h('span', { className: 'cl_tabTitle' }, props.t('action.badge'))
}

exports.TAB_ID = TAB_ID
exports.TAB_KIND = TAB_KIND
exports.tabDefinition = tabDefinition
exports.ContextLensTab = ContextLensTab
exports.ContextLensTabTitle = ContextLensTabTitle
exports.registerTab = registerTab

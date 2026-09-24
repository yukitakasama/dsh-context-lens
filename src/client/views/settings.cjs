/**
 * The settings card: exposes the plugin's tunables in the GUI.
 *
 * These are the SAME values the host half validates (see `src/host/config.js`).
 * The card edits them over the settings service when one is present, and
 * reports honestly when it is not — it never fakes a saved value. The plugin
 * itself keeps working with its validated defaults regardless, so this seat is
 * purely a convenience and is registered only when `settings.section` and a
 * settings service are both available.
 *
 * @module dsh-context-lens/client/views/settings
 */

const React = require('react')
const { createElement: h } = React
const { Section, KeyValueRow } = require('./parts.cjs')

/** The settings namespace this plugin owns. */
const SETTINGS_NS = 'context-lens'

/** The tunables, with the bounds the host enforces. */
const FIELDS = [
  { key: 'sampleStride', labelKey: 'settings.sampleStride', hintKey: 'settings.sampleStride.hint' },
  { key: 'maxSamples', labelKey: 'settings.maxSamples', hintKey: 'settings.maxSamples.hint' },
  { key: 'cacheTtlMs', labelKey: 'settings.cacheTtlMs', hintKey: 'settings.cacheTtlMs.hint' },
  { key: 'paceWindow', labelKey: 'settings.paceWindow', hintKey: 'settings.paceWindow.hint' },
]

/**
 * The settings section body.
 *
 * @param props - slot props; `t` from the declared locale namespace and
 *   `useContextLensSettings` bound from the inject `hooks` compartment.
 * @returns the settings section element.
 */
function ContextLensSettings(props) {
  const { t, useContextLensSettings } = props
  const state = useContextLensSettings(value => value)

  return h(Section, { title: t('settings.title'), note: t('settings.hint') }, [
    state.available
      ? h('div', { key: 'rows', className: 'cl_kvRows' }, FIELDS.map(field => h(KeyValueRow, {
          key: field.key,
          label: t(field.labelKey),
          value: state.values[field.key] === undefined
            ? t('settings.unset')
            : String(state.values[field.key]),
        })))
      : h('p', { key: 'unavailable', className: 'cl_empty' }, t('settings.unavailable')),
  ])
}

/**
 * Read the plugin's current settings through the settings service.
 *
 * @param ctx - client root context.
 * @returns an observable source of the effective values.
 */
function createSettingsSource(ctx) {
  const settings = ctx.get('settings')
  let snapshot = { available: false, values: {} }
  const listeners = new Set()

  if (settings === undefined) {
    return {
      getSnapshot: () => snapshot,
      subscribe: () => () => {},
    }
  }

  snapshot = { available: true, values: {} }
  const refresh = () => {
    const next = { available: true, values: {} }
    for (const field of FIELDS) {
      const value = typeof settings.get === 'function'
        ? settings.get(SETTINGS_NS, field.key)
        : undefined
      if (typeof value === 'number') next.values[field.key] = value
    }
    snapshot = next
    for (const listener of listeners) listener()
  }
  refresh()

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      if (typeof settings.onChange === 'function') {
        const dispose = settings.onChange(SETTINGS_NS, refresh)
        return () => {
          listeners.delete(listener)
          if (typeof dispose === 'function') dispose()
        }
      }
      return () => listeners.delete(listener)
    },
  }
}

exports.SETTINGS_NS = SETTINGS_NS
exports.FIELDS = FIELDS
exports.ContextLensSettings = ContextLensSettings
exports.createSettingsSource = createSettingsSource

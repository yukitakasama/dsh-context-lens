/**
 * Degradation-matrix tests (PLAN §2.3, L0–L4).
 *
 * The contract is that each capability tier can fail ALONE. A plugin that
 * throws, hangs, or registers nothing when one optional service is missing is
 * not degrading — it is broken, and it takes the user's sidebar with it. These
 * tests remove one capability at a time and assert that the rest still works.
 *
 * @module dsh-context-lens/tests/degrade.spec
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** A React stand-in sufficient to define the components. */
function fakeReact() {
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  return {
    createElement,
    Fragment: Symbol('Fragment'),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: () => ({ current: null }),
    useEffect: () => {},
    useCallback: fn => fn,
    useMemo: fn => fn(),
  }
}

/**
 * Materialize the built client bundle.
 * @returns the bundle exports.
 */
async function bundle() {
  const text = await readFile(join(root, 'lib', 'client.js'), 'utf8')
  const table = {
    react: fakeReact(),
    'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}), Fragment: Symbol('Fragment') },
  }
  let registration
  const window = {
    __ModuleLoader__: { load(entry) { registration = entry } },
  }
  const require_ = spec => {
    if (spec in table) return table[spec]
    throw new Error(`unexpected external: ${spec}`)
  }
  new Function('window', `${text}\nreturn window.__ModuleLoader__;`)(window)
  return registration.factory(require_)
}

/**
 * Build a context with a configurable set of services present.
 * @param available - which services exist.
 * @returns the context plus registration recorders.
 */
function contextWith(available) {
  const recorded = {
    effects: [],
    dictionaries: [],
    injections: [],
    registrations: [],
    tabTypes: [],
    warnings: [],
  }

  const session = {
    projections: {
      faceOf: () => ({ getSnapshot: () => undefined, subscribe: () => () => {} }),
    },
  }

  const ctx = {
    effect(callback, label) {
      recorded.effects.push(label)
      return callback() ?? (() => {})
    },
    get(name) {
      if (name === 'sessions' && available.sessions) {
        return {
          list: { getSnapshot: () => ({ current: undefined }), subscribe: () => () => {} },
          binding: () => undefined,
          get: () => undefined,
        }
      }
      if (name === 'sidebarRightTabs' && available.sidebarRightTabs) {
        return { register: definition => { recorded.tabTypes.push(definition); return () => {} } }
      }
      if (name === 'settings' && available.settings) {
        return { get: () => undefined }
      }
      if (name === 'tokenMeter') return undefined
      return undefined
    },
    logger: {
      debug(message) { recorded.warnings.push(message) },
    },
    locale: {
      register(ns, dicts) { recorded.dictionaries.push({ ns, dicts }); return () => {} },
      bind: () => key => key,
    },
    slots: {
      inject(key, callback) { recorded.injections.push(key); return callback() },
      register(definition, Component) { recorded.registrations.push({ definition, Component }); return () => {} },
    },
  }
  return { ctx, recorded, session }
}

/** Every service present, for the all-capabilities baseline. */
const ALL = { sessions: true, sidebarRightTabs: true, settings: true }

test('L0: everything available registers every seat', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith(ALL)
  exports.apply(ctx)

  const names = recorded.registrations.map(entry => entry.definition.name)
  assert.ok(names.includes('sidebar.footer.action'), 'footer action present')
  assert.ok(names.includes('settings.section'), 'settings section present')
  assert.ok(names.includes('sidebar.right.pane.tab'), 'tab body present')
  assert.ok(names.includes('sidebar.right.pane.tab.title'), 'tab title present')
  assert.equal(recorded.tabTypes.length, 1, 'tab type registered')
  assert.equal(recorded.tabTypes[0].id, 'dsh-context-lens')
  assert.equal(recorded.tabTypes[0].kind, 'context-lens')
  assert.equal(recorded.tabTypes[0].priority, 'extension', 'an outside-the-product band')
  assert.equal(recorded.dictionaries.length, 1, 'dictionaries registered once')
})

test('no sidebarRightTabs: the tab is skipped, everything else still registers', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith({ ...ALL, sidebarRightTabs: false })
  exports.apply(ctx)

  assert.equal(recorded.tabTypes.length, 0, 'no tab type')
  const names = recorded.registrations.map(entry => entry.definition.name)
  assert.ok(!names.includes('sidebar.right.pane.tab'), 'no tab body registered')
  assert.ok(names.includes('sidebar.footer.action'), 'the footer action is unaffected')
  assert.ok(names.includes('settings.section'), 'the settings section is unaffected')
})

test('no sessions: session-dependent seats are skipped, the rest survives', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith({ ...ALL, sessions: false })
  // Must not throw.
  exports.apply(ctx)

  const names = recorded.registrations.map(entry => entry.definition.name)
  assert.ok(!names.includes('sidebar.footer.action'), 'no footer action without sessions')
  assert.ok(!names.includes('sidebar.right.pane.tab'), 'no tab body without a data source')
  assert.equal(recorded.tabTypes.length, 0, 'no tab type without a data source')
  assert.ok(names.includes('settings.section'), 'the settings section still registers')
  assert.equal(recorded.dictionaries.length, 1, 'the dictionary still registers')
  assert.ok(recorded.effects.includes('context-lens: stylesheet'), 'the stylesheet still injects')
  assert.ok(recorded.warnings.some(w => w.includes('no session controller')), 'the skip is reported')
})

test('no settings service: the section still registers and reports unavailability', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith({ ...ALL, settings: false })
  exports.apply(ctx)

  const names = recorded.registrations.map(entry => entry.definition.name)
  assert.ok(names.includes('settings.section'), 'the section still mounts')
  // Its inject face must expose an observable that says "unavailable" rather
  // than throwing when a component reads it.
  const section = recorded.registrations.find(entry => entry.definition.name === 'settings.section')
  const face = section.definition.inject()
  const source = face.hooks.contextLensSettings
  assert.deepEqual(source.getSnapshot(), { available: false, values: {} })
  assert.equal(typeof source.subscribe, 'function', 'a no-op subscribe, not a crash')
  assert.equal(typeof source.subscribe(() => {}), 'function', 'subscribe returns a disposer')
})

test('the settings labels are read lazily, not captured at register time', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith(ALL)
  exports.apply(ctx)
  const section = recorded.registrations.find(entry => entry.definition.name === 'settings.section')
  // A label must be a function so a locale switch re-reads it.
  assert.equal(typeof section.definition.label, 'function', 'label is a thunk')
})

test('tab title registration is optional-but-present and keyed by the same id', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith(ALL)
  exports.apply(ctx)
  const title = recorded.registrations.find(entry => entry.definition.name === 'sidebar.right.pane.tab.title')
  const body = recorded.registrations.find(entry => entry.definition.name === 'sidebar.right.pane.tab')
  assert.equal(title.definition.key, 'dsh-context-lens', 'keyed by the definition id')
  assert.equal(body.definition.key, 'dsh-context-lens', 'body keyed by the same id')
  assert.equal(body.definition.locale, 'contextLens', 'the body declares its namespace')
})

test('a repeated apply does not throw and re-registers cleanly', async () => {
  const exports = await bundle()
  const { ctx, recorded } = contextWith(ALL)
  exports.apply(ctx)
  const first = recorded.registrations.length
  exports.apply(ctx)
  assert.equal(recorded.registrations.length, first * 2, 'each apply registers its own cells')
  // The real guarantee is that the framework disposes the first set via effects;
  // what must hold here is that a second apply never throws.
})

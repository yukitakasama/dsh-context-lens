/**
 * Bundle smoke test: materialize `lib/client.js` against a simulated module
 * loader and a simulated cordis context, then assert the observable contract.
 *
 * This is the test that would have caught postmortem 0001: it proves the built
 * bundle registers a factory, that the factory returns `apply` and `inject`,
 * and that running `apply` registers the locale dictionary and the footer
 * action — rather than the whole thing silently vanishing behind a default
 * export. A guard only guards if the regression fails it, so this test asserts
 * the ABSENCE of a default export too.
 *
 * @module dsh-context-lens/tests/bundle.spec
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** A minimal React stand-in: enough for the components to be defined and rendered to plain data. */
function createFakeReact() {
  const createElement = (type, props, ...children) => ({
    type,
    props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  const passthrough = name => (...args) => ({ hook: name, args })
  const React = {
    createElement,
    Fragment: Symbol('Fragment'),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: () => ({ current: null }),
    useEffect: () => {},
    useCallback: fn => fn,
    useMemo: fn => fn(),
  }
  React.useState = passthrough('useState')
  return React
}

/**
 * Materialize the built client bundle the way the shell does.
 * @returns the bundle's exports plus the loader's recorded registration.
 */
async function materializeBundle() {
  const text = await readFile(join(root, 'lib', 'client.js'), 'utf8')

  /** The registration the bundle performs, captured from the loader facade. */
  let registration
  const moduleTable = {
    react: createFakeReact(),
    'react/jsx-runtime': { jsx: () => ({}), jsxs: () => ({}), Fragment: Symbol('Fragment') },
  }

  const window = {
    __ModuleLoader__: {
      load(entry) {
        registration = entry
      },
    },
  }

  const require_ = spec => {
    if (spec in moduleTable) return moduleTable[spec]
    throw new Error(`unexpected external require: ${spec}`)
  }

  // The bundle is a plain script that calls into `window`; evaluate it with
  // those two names in scope, exactly as the browser would.
  const factory = new Function('window', `${text}\nreturn window.__ModuleLoader__;`)
  factory(window)

  assert.ok(registration !== undefined, 'bundle called __ModuleLoader__.load')
  return { registration, require: require_, exports: registration.factory(require_) }
}

/** A recording cordis context covering the services the client body touches. */
function createFakeContext({ withSessions = true } = {}) {
  const effects = []
  const dictionaries = []
  const slotRegistrations = []
  const injections = []

  const projectionFaces = new Map()
  const session = {
    projections: {
      faceOf(key) {
        if (!projectionFaces.has(key)) {
          const listeners = new Set()
          projectionFaces.set(key, {
            getSnapshot: () => projectionFaces.get(key)?.value,
            subscribe(listener) {
              listeners.add(listener)
              return () => listeners.delete(listener)
            },
            set(value) {
              projectionFaces.get(key).value = value
              for (const listener of listeners) listener()
            },
          })
        }
        return projectionFaces.get(key)
      },
    },
  }

  const sessions = {
    list: {
      getSnapshot: () => ({ current: 'session-1' }),
      subscribe: () => () => {},
    },
    binding: id => (id === 'session-1' ? { session } : undefined),
    get: id => (id === 'session-1' ? session : undefined),
  }

  const ctx = {
    effect(callback, label) {
      effects.push(label)
      const disposer = callback()
      return typeof disposer === 'function' ? disposer : () => {}
    },
    get(name) {
      if (name === 'sessions') return withSessions ? sessions : undefined
      return undefined
    },
    logger: { debug() {} },
    locale: {
      register(ns, dicts) {
        dictionaries.push({ ns, dicts })
        return () => {}
      },
    },
    slots: {
      inject(key, callback) {
        injections.push(key)
        return callback()
      },
      register(definition, Component) {
        slotRegistrations.push({ definition, Component })
        return () => {}
      },
    },
  }

  return { ctx, effects, dictionaries, slotRegistrations, injections, sessions, projectionFaces }
}

test('the bundle registers a lazy factory, not a direct plugin', async () => {
  const { registration } = await materializeBundle()
  assert.equal(registration.id, 'dsh-context-lens', 'bundle id is the package name')
  assert.equal(typeof registration.factory, 'function', 'factory is callable')
})

test('the factory returns apply and inject, and no default export', async () => {
  const { exports } = await materializeBundle()
  assert.equal(typeof exports.apply, 'function', 'apply is exported')
  assert.deepEqual(exports.inject, ['slots', 'locale'], 'inject names the baseline services')
  assert.ok(!('default' in exports), 'no default export in the bundle (regression guard)')
})

test('apply registers the dictionary and the footer action', async () => {
  const { exports } = await materializeBundle()
  const fake = createFakeContext()
  exports.apply(fake.ctx)

  assert.deepEqual(
    fake.injections,
    ['sidebar.footer.action', 'settings.section'],
    'injects the footer seat and the settings section',
  )
  assert.equal(fake.slotRegistrations.length, 2, 'registers exactly two cells')

  const { definition } = fake.slotRegistrations[0]
  assert.equal(definition.name, 'sidebar.footer.action')
  assert.equal(definition.id, 'context-lens', 'a FRESH list id: the official meter is not touched')
  assert.equal(definition.locale, 'contextLens', 'declares its locale namespace')
  assert.equal(fake.slotRegistrations[1].definition.name, 'settings.section')

  const dict = fake.dictionaries[0]
  assert.equal(dict.ns, 'contextLens')
  assert.deepEqual(Object.keys(dict.dicts.zh).sort(), Object.keys(dict.dicts.en).sort(), 'zh and en key sets match')
})

test('the two shipped locales carry identical key sets and no empty copy', async () => {
  const { exports } = await materializeBundle()
  const fake = createFakeContext()
  exports.apply(fake.ctx)
  const { zh, en } = fake.dictionaries[0].dicts
  assert.ok(Object.keys(zh).length > 30, 'the dictionary is substantive')
  for (const [key, value] of Object.entries(zh)) {
    assert.equal(typeof value, 'string', `zh["${key}"] is a string`)
    assert.ok(value.length > 0, `zh["${key}"] is not empty`)
  }
  for (const [key, value] of Object.entries(en)) {
    assert.equal(typeof value, 'string', `en["${key}"] is a string`)
    assert.ok(value.length > 0, `en["${key}"] is not empty`)
  }
})

test('apply still loads when the session controller is absent', async () => {
  const { exports } = await materializeBundle()
  const fake = createFakeContext({ withSessions: false })
  // Must not throw: a missing capability degrades this view, not the load.
  exports.apply(fake.ctx)
  // The session-dependent footer seat is skipped; the settings section does
  // not depend on a session, so it still registers. The point is that apply
  // completes without throwing.
  const names = fake.slotRegistrations.map(entry => entry.definition.name)
  assert.ok(!names.includes('sidebar.footer.action'), 'no session seat without a session controller')
  assert.equal(fake.dictionaries.length, 1, 'the dictionary still registers')
})

test('the inject face exposes a hooks compartment with a stable observable', async () => {
  const { exports } = await materializeBundle()
  const fake = createFakeContext()
  exports.apply(fake.ctx)
  const { definition, Component } = fake.slotRegistrations
    .find(entry => entry.definition.name === 'sidebar.footer.action')
  assert.equal(typeof Component, 'function', 'a component is registered')

  const face = definition.inject()
  assert.ok(face.hooks !== undefined, 'hooks compartment present (the observable channel)')
  const source = face.hooks.contextLens
  assert.equal(typeof source.getSnapshot, 'function', 'source has getSnapshot')
  assert.equal(typeof source.subscribe, 'function', 'source has subscribe')
  assert.equal(typeof face.refresh, 'function', 'refresh callback exposed')

  // Snapshot must be *stable* between changes: the renderer caches the hook
  // binding by source identity and relies on reference stability for snapshots.
  const first = source.getSnapshot()
  assert.equal(source.getSnapshot(), first, 'snapshot reference is stable')
})

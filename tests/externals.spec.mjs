/**
 * External-module contract test.
 *
 * A dynamic browser bundle resolves every bare `require()` against the shell's
 * frozen seed table. A specifier outside that table throws at materialization
 * time — in the user's browser, after install. So this test reads the BUILT
 * bundle, extracts every specifier it can reach, and asserts each one is either
 * a baseline table entry or resolved by our own internal registry.
 *
 * The baseline list is taken from the RUNNING shell, not from a source checkout:
 * `@deepseek-ai/dsh-web-frontend@0.1.5-rc.1`'s `dist/assets/index-*.js` builds
 * its seed table literally as
 *   "react/jsx-runtime":..., "react-dom":..., "@deepseek-ai/cordis":...,
 *   "@deepseek-ai/dsh-client-store":..., "@deepseek-ai/dsh-client-ui-slots":...,
 *   "@deepseek-ai/dsh-client-ui-primitives":..., "@deepseek-ai/dsh-client-ui-dockkit":...
 * and contains no `@deepseek-ai/dsh-client-runtime/client` specifier at all.
 *
 * @module dsh-context-lens/tests/externals.spec
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The shell's baseline module table. Anything a bundle requires must be in here
 * (or be internal to the bundle). Nine entries; verified against the shipped
 * frontend bundle.
 */
const BASELINE = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

/** Read the built bundle. */
async function bundleText() {
  return await readFile(join(root, 'lib', 'client.js'), 'utf8')
}

test('every bare specifier the client bundle requires is a baseline module', async () => {
  const text = await bundleText()
  // Static string specifiers, e.g. require("react") / require('react/jsx-runtime').
  const specifiers = [...text.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map(m => m[1])
  const bare = [...new Set(specifiers)].filter(s => !s.startsWith('.') && !s.startsWith('/'))

  for (const specifier of bare) {
    assert.ok(
      BASELINE.has(specifier),
      `require(${JSON.stringify(specifier)}) is not in the shell's baseline table — `
      + 'it would throw at materialization time. Use an internal module or a baseline entry.',
    )
  }
  assert.ok(bare.length > 0, 'the bundle requires react, so this test is not vacuous')
})

test('the client bundle does not request a dsh.client.external', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  assert.equal(pkg.dsh?.client?.external, undefined,
    'no external request: every specifier must be baseline or internal')
  // And nothing in the bundle reaches for a preloaded external.
  const text = await bundleText()
  assert.ok(!text.includes('dsh-client-runtime/client'),
    'rc.1 shipped bundles require a runtime preload, but a non-preloaded third-party bundle must not')
})

test('the client bundle declares a runtime inject list of baseline services only', async () => {
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const declared = pkg.dsh.client.inject ?? []
  // `inject` here is the RUNTIME service list, not the module table: it may only
  // name services that always exist, or the plugin strands in PENDING.
  for (const service of declared) {
    assert.ok(['slots', 'locale'].includes(service),
      `unexpected required runtime service: ${service}`)
  }
  assert.equal(pkg.dsh.client.platform, 'web')
})

test('the built bundle keeps the loader protocol shape', async () => {
  const text = await bundleText()
  assert.ok(text.includes('__ModuleLoader__'), 'uses the module loader facade')
  assert.ok(/id:\s*["']dsh-context-lens["']/.test(text), 'ids itself as the package name')
  assert.ok(/factory:\s*(function|\(|spec|require)/.test(text), 'exposes a factory taking require')
  assert.ok(!/^\s*export\s+default\s/m.test(text), 'no ESM default export in the bundle')
})

test('the bundle materializes with ONLY the baseline table available', async () => {
  // The strongest form of the contract: no internal resolution escapes, and the
  // factory returns real exports when nothing but baseline modules exist.
  const text = await bundleText()
  const createElement = (type, props, ...children) => ({
    type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
  })
  const table = {
    react: {
      createElement,
      Fragment: Symbol('Fragment'),
      useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: () => ({ current: null }),
      useEffect: () => {},
      useCallback: fn => fn,
      useMemo: fn => fn(),
    },
    'react/jsx-runtime': { jsx: createElement, jsxs: createElement, Fragment: Symbol('Fragment') },
  }
  const encountered = []
  let entry
  new Function('window', text)({ __ModuleLoader__: { load: e => { entry = e } } })
  const exports = entry.factory(spec => {
    encountered.push(spec)
    if (spec in table) return table[spec]
    throw new Error(`missed the module table: ${spec}`)
  })

  assert.deepEqual(Object.keys(exports).sort(), ['NS', 'apply', 'inject'])
  assert.deepEqual(exports.inject, ['slots', 'locale'])
  assert.deepEqual([...new Set(encountered)].sort(), ['react'],
    'materialization needs exactly one external: react')
})

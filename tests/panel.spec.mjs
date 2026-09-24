/**
 * Export-path tests for the panel's `download()` helper.
 *
 * `download()` is the one side-effecting function in the client half, and its
 * failure mode is silent: `anchor.click()` only STARTS a navigation, so
 * revoking the object URL in the same synchronous task can cancel the download
 * before the browser has read the blob — and nothing throws, so `exportReport`'s
 * `try/catch` never fires and the user sees a success notice with no file.
 *
 * These tests materialize `src/client/views/panel.cjs` against a fake DOM and a
 * fake object-URL implementation and assert the observable ordering: the blob
 * URL is created, the anchor is appended, clicked and removed, and the revoke
 * is DEFERRED to a later task rather than issued beside the click.
 *
 * @module dsh-context-lens/tests/panel.spec
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** A React stand-in sufficient for destructuring and component definition. */
function fakeReact() {
  return {
    createElement: (type, props, ...children) => ({ type, props, children }),
    Fragment: Symbol('Fragment'),
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useRef: () => ({ current: null }),
    useEffect: () => {},
    useCallback: fn => fn,
  }
}

/**
 * Materialize the panel module against minimal stubs.
 * @returns the module's exports plus the recorded DOM/URL calls.
 */
async function loadPanel() {
  const source = await readFile(resolve(root, 'src/client/views/panel.cjs'), 'utf8')
  const calls = { created: [], revoked: [], appended: [], clicked: 0, removed: 0, anchors: [] }

  const stubComponent = () => null
  const table = {
    react: fakeReact(),
    './parts.cjs': {
      OccupancyRing: stubComponent,
      KeyValueRow: stubComponent,
      Section: stubComponent,
      Badge: stubComponent,
      IconButton: stubComponent,
      DownloadGlyph: stubComponent,
      RefreshGlyph: stubComponent,
      CloseGlyph: stubComponent,
    },
    './timeline.cjs': { TimelineSection: stubComponent },
    '../model/index.cjs': { formatTokens: () => '' },
    '../model/report.cjs': { toMarkdown: () => '', toJson: () => '', reportFilename: () => 'x.md' },
  }

  const module = { exports: {} }
  const require_ = spec => {
    if (spec in table) return table[spec]
    throw new Error(`unexpected require: ${spec}`)
  }
  new Function('require', 'module', 'exports', source)(require_, module, module.exports)

  // The fake URL/Blob/DOM live on `globalThis` because the module closes over
  // the ambient names rather than receiving them.
  globalThis.Blob = class Blob { constructor(parts, options) { this.parts = parts; this.options = options } }
  globalThis.URL = {
    createObjectURL(blob) {
      const url = `blob:test-${calls.created.length + 1}`
      calls.created.push({ url, blob })
      return url
    },
    revokeObjectURL(url) { calls.revoked.push(url) },
  }
  globalThis.document = {
    body: { appendChild(node) { calls.appended.push(node) } },
    createElement(tag) {
      assert.equal(tag, 'a', 'the download helper creates an anchor')
      const anchor = {
        href: undefined,
        download: undefined,
        clickedWith: undefined,
        click() { calls.clicked += 1; this.clickedWith = calls.clicked },
        remove() { calls.removed += 1 },
      }
      calls.anchors.push(anchor)
      return anchor
    },
  }

  return { download: module.exports.download, calls }
}

test('download defers the object-URL revoke past the click task', async () => {
  const { download, calls } = await loadPanel()

  download('report body', 'context-lens-session-1.md')

  assert.equal(calls.created.length, 1, 'one object URL is created')
  assert.deepEqual(calls.created[0].blob.parts, ['report body'], 'the document text is the blob payload')
  assert.equal(
    calls.created[0].blob.options.type,
    'text/plain;charset=utf-8',
    'the blob is typed as UTF-8 text',
  )

  const anchor = calls.anchors[0]
  assert.equal(anchor.href, calls.created[0].url, 'the anchor points at the blob URL')
  assert.equal(anchor.download, 'context-lens-session-1.md', 'the suggested filename reaches the anchor')
  assert.equal(calls.appended.length, 1, 'the anchor is attached before clicking')
  assert.equal(calls.clicked, 1, 'the anchor is clicked exactly once')
  assert.equal(calls.removed, 1, 'the anchor is detached afterward')

  // The regression: the revoke must NOT happen in the same synchronous task as
  // the click, or a browser that reads the blob later loses the download.
  assert.deepEqual(calls.revoked, [], 'the URL is still alive when download() returns')

  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(calls.revoked, [calls.created[0].url], 'the URL is revoked on the next task')
})

test('download revokes the exact URL it created', async () => {
  const { download, calls } = await loadPanel()

  download('a', 'a.md')
  download('b', 'b.json')
  await new Promise(resolve => setTimeout(resolve, 0))

  assert.equal(calls.created.length, 2, 'two exports create two URLs')
  assert.deepEqual(
    calls.revoked,
    calls.created.map(entry => entry.url),
    'each revoke names the URL it created, in creation order',
  )
})

test('the panel no longer reports a file download as a copy', async () => {
  const source = await readFile(resolve(root, 'src/client/views/panel.cjs'), 'utf8')
  assert.ok(!source.includes('action.copied'), 'the old clipboard-copy success key is gone')
  assert.ok(!source.includes('action.copyFailed'), 'the old clipboard-copy failure key is gone')
  assert.ok(source.includes("t('action.exported')"), 'the success notice is an export notice')
  assert.ok(source.includes("t('action.exportFailed')"), 'the failure notice is an export notice')
})

test('both dictionaries carry the renamed export notices', () => {
  const { zh, en } = require(resolve(root, 'src/client/locales.cjs'))
  for (const dict of [zh, en]) {
    assert.equal(typeof dict['action.exported'], 'string', 'action.exported exists')
    assert.equal(typeof dict['action.exportFailed'], 'string', 'action.exportFailed exists')
    assert.ok(dict['action.exported'].length > 0, 'action.exported is not empty')
    assert.ok(dict['action.exportFailed'].length > 0, 'action.exportFailed is not empty')
    assert.ok(!('action.copied' in dict), 'action.copied is retired')
    assert.ok(!('action.copyFailed' in dict), 'action.copyFailed is retired')
  }
})
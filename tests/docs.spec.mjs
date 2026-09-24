/**
 * Documentation-figure tests.
 *
 * The stale-count class of bug (issue #14) is not "a number was typed wrong";
 * it is that every count in the docs was *hand-copied from a command nobody
 * re-ran*. So this spec does not compare prose to prose. It derives the real
 * figures from the tooling —
 *
 *   - the assertion count from `scripts/check.mjs` itself, via its exported
 *     `collectChecks()`, which is the same function the CLI runs;
 *   - the test count by counting `test(` declarations in the spec files;
 *   - the locale key count from the dictionaries that ship;
 *
 * — and asserts each against the documents that quote it. A number added to
 * `check.mjs` or a spec file therefore fails this test until the docs follow,
 * which is the only mechanism that has actually held.
 *
 * Counts that are deliberately historical (a released CHANGELOG entry, or a
 * "before the fix" figure) are NOT asserted here: see the note at the top of
 * CHANGELOG.md for that policy.
 *
 * @module dsh-context-lens/tests/docs.spec
 */

import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** Read a repo file as UTF-8. */
async function readRepoFile(relative) {
  return await readFile(join(root, relative), 'utf8')
}

/**
 * The live assertion count, taken from the checker itself rather than from a
 * regex over its source. `collectChecks()` needs a built `lib/`, so this is
 * subject to the same build-first prerequisite as the rest of the suite.
 * @returns the number of assertions `check.mjs` reports as passing.
 */
async function liveAssertionCount() {
  const checker = await import(pathToFileURL(join(root, 'scripts', 'check.mjs')).href)
  const { passes, failures } = await checker.collectChecks()
  assert.equal(failures.length, 0,
    `check.mjs must be green for its count to mean anything:\n${failures.join('\n')}`)
  return passes.length
}

/**
 * The live test count: every `test(` declaration across the spec files.
 *
 * The suite uses no `describe` nesting and no `test.skip`/`test.todo`, and
 * `node --test` runs one top-level test per declaration, so this equals what
 * the runner prints. The guards below pin those preconditions: if either stops
 * holding this helper is wrong and must be re-derived, not quietly trusted.
 * @returns the number of test declarations.
 */
async function liveTestCount() {
  const dir = join(root, 'tests')
  const specs = (await readdir(dir)).filter(name => name.endsWith('.spec.mjs')).sort()
  let total = 0
  for (const name of specs) {
    const source = await readRepoFile(join('tests', name))
    assert.ok(!/\bdescribe\(/.test(source), `${name} nests tests; the flat count no longer holds`)
    assert.ok(!/\btest\.(skip|todo)\(/.test(source),
      `${name} skips or defers a test; the count no longer holds`)
    total += (source.match(/^\s*(?:await\s+)?test\(/gm) ?? []).length
  }
  assert.ok(total > 0, 'the spec files declare tests')
  return total
}

/** The live locale key count, read from the dictionaries that ship. */
function liveLocaleKeyCount() {
  const { zh, en } = require(join(root, 'src', 'client', 'locales.cjs'))
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(),
    'the two dictionaries must carry the same keys before their size is quoted')
  return Object.keys(zh).length
}

/** The manifest version, which is what `pnpm pack` puts in the tarball name. */
async function manifestVersion() {
  return JSON.parse(await readRepoFile('package.json')).version
}

// ---------------------------------------------------------------------------
// check.mjs: the assertion count
// ---------------------------------------------------------------------------

test('every documented assertion count matches what check.mjs actually reports', async () => {
  const live = await liveAssertionCount()
  assert.ok(live > 0, 'check.mjs runs assertions')

  // In COMPATIBILITY.md the assertion count always sits on a line that names
  // the command; scoping to that line is what keeps it distinct from the test
  // total, which uses the same "N passed, N failed" shape.
  const compatibility = await readRepoFile('docs/COMPATIBILITY.md')
  let stated = 0
  for (const line of compatibility.split('\n')) {
    if (!line.includes('check.mjs')) continue
    for (const match of line.matchAll(/(\d+) passed, (\d+) failed/g)) {
      stated += 1
      assert.equal(Number(match[1]), live,
        `COMPATIBILITY.md says "${match[0]}" beside check.mjs, but it reports `
        + `${live} passed, 0 failed`)
      assert.equal(Number(match[2]), 0, 'check.mjs is green')
    }
  }
  assert.ok(stated > 0, 'COMPATIBILITY.md states the assertion count beside its command')
});

test('every test total in COMPATIBILITY.md is either live or marked historical', async () => {
  const live = await liveTestCount()
  const compatibility = await readRepoFile('docs/COMPATIBILITY.md')

  // A "before the fix" figure is allowed to differ — it is evidence about the
  // past. What is not allowed is an unlabelled stale number, which is how the
  // repository came to state 78 as a live total for three releases.
  const HISTORICAL = /修复前|修复之[前前]|当时|历史|before the fix|pre-fix|historic/i

  let checked = 0
  let liveSeen = 0
  for (const line of compatibility.split('\n')) {
    for (const match of line.matchAll(/(\d+) tests \/ (\d+) pass \/ (\d+) fail/g)) {
      checked += 1
      const [tests, pass, fail] = match.slice(1).map(Number)
      if (tests === live) {
        liveSeen += 1
        assert.equal(pass, live, `live total states ${pass} pass; the suite has ${live}`)
        assert.equal(fail, 0, `live total states ${fail} fail; the suite is green`)
      } else {
        assert.ok(HISTORICAL.test(line),
          `COMPATIBILITY.md states "${match[0]}" without marking it historical; `
          + `the suite has ${live}`)
      }
    }
    // The ledger form, which must always be current.
    if (line.includes('node --test')) {
      for (const match of line.matchAll(/(\d+) passed, (\d+) failed/g)) {
        checked += 1
        assert.equal(Number(match[1]), live,
          `COMPATIBILITY.md says "${match[0]}" beside node --test, but the suite has ${live}`)
        assert.equal(Number(match[2]), 0, 'the suite is green')
      }
    }
  }

  assert.ok(checked > 0, 'COMPATIBILITY.md states the suite total somewhere')
  assert.ok(liveSeen > 0, 'COMPATIBILITY.md states the CURRENT suite total, not only past ones')
});

test('the READMEs do not restate a count that can drift', async () => {
  // The fix for #14 was to stop quoting totals in prose, so this asserts the
  // ABSENCE rather than a new number: a restated live count is the regression.
  const forbidden = [
    /node scripts\/check\.mjs\s+#\s*\d+\b/,
    /node --test[^\n]*#\s*\d+\s*(?:tests|个测试)/,
    /\d+ manifest\/compliance assertions/,
    /\d+ 条 manifest/,
  ]
  for (const file of ['README.md', 'README.zh.md']) {
    const text = await readRepoFile(file)
    for (const pattern of forbidden) {
      const hit = pattern.exec(text)
      assert.equal(hit, null,
        `${file} restates a live count (${hit?.[0]}); quote the command, not its output`)
    }
  }
});

// ---------------------------------------------------------------------------
// the tarball name
// ---------------------------------------------------------------------------

test('the READMEs name the tarball by placeholder, not by a frozen version', async () => {
  const version = await manifestVersion()
  for (const file of ['README.md', 'README.zh.md']) {
    const text = await readRepoFile(file)
    assert.ok(text.includes('dsh-context-lens-<version>.tgz'),
      `${file} should show the version-agnostic tarball name`)
    // A hard-coded tarball name is exactly the drift this replaced.
    const frozen = /dsh-context-lens-\d+\.\d+\.\d+\.tgz/
    assert.equal(frozen.exec(text), null,
      `${file} hard-codes a tarball version; the manifest is ${version} today and will move`)
  }
});

// ---------------------------------------------------------------------------
// locale keys
// ---------------------------------------------------------------------------

test('the documented locale key count equals the dictionaries that ship', async () => {
  const live = liveLocaleKeyCount()
  const compatibility = await readRepoFile('docs/COMPATIBILITY.md')
  // The claim is always written as "各 N 键" / "N 键 ×2"; the bare "N 键"
  // shape also appears in prose about unrelated key counts, so anchor on the
  // dictionary phrasing rather than on any number followed by 键.
  const stated = [...compatibility.matchAll(/各 (\d+) 键|(\d+) 键 ×2/g)]
    .map(m => Number(m[1] ?? m[2]))
  assert.ok(stated.length > 0, 'COMPATIBILITY.md states a dictionary size')
  for (const value of stated) {
    assert.equal(value, live,
      `COMPATIBILITY.md says "${value} 键" but the dictionaries hold ${live}`)
  }
});

test('the dictionaries are internally consistent and non-trivial', () => {
  const { zh, en, KEYS } = require(join(root, 'src', 'client', 'locales.cjs'))
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.deepEqual([...KEYS].sort(), Object.keys(zh).sort(), 'KEYS mirrors the zh dictionary')
  for (const [key, value] of Object.entries({ ...zh, ...en })) {
    assert.equal(typeof value, 'string', `${key} is a string`)
    assert.ok(value.length > 0, `${key} is not empty`)
  }
});

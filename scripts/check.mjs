/**
 * Validate the built artifacts and the manifests.
 *
 * This is the executable form of the compliance rules the plan froze: it
 * parses the manifests, asserts the built files match them, and greps the
 * source for the things that are supposed to be impossible (a `default`
 * export, which silently drops `inject`; literal colors; hardcoded copy;
 * a `webServer` dependency declaration).
 *
 * Run `node scripts/build.mjs` first — this script checks products, not source.
 *
 * @module dsh-context-lens/scripts/check
 */

import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The assertion sink for the current run.
 *
 * It lives in a module-level binding rather than a parameter so each of the
 * assertion sites keeps its one-line shape, and `collectChecks()` is the only
 * thing that installs one — so a run can be repeated and its labels read back
 * by a test instead of being counted by reading this file.
 */
let sink = { passes: [], failures: [] }

/**
 * Record one assertion.
 * @param ok - whether it held.
 * @param label - what was asserted.
 * @param detail - optional explanation printed on failure.
 */
function check(ok, label, detail) {
  if (ok) sink.passes.push(label)
  else sink.failures.push(detail === undefined ? label : `${label} — ${detail}`)
}

/** Read and parse a JSON file. */
async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

/** Recursively list files under `dir`, relative POSIX paths. */
async function listFiles(dir, base = dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await listFiles(full, base))
    else out.push(relative(base, full).split('\\').join('/'))
  }
  return out.sort()
}

/** Whether a path exists. */
async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function checkArtifacts(pkg) {
  for (const [key, target] of Object.entries(pkg.exports)) {
    if (typeof target !== 'string') continue
    const path = join(root, target)
    check(await exists(path), `exports["${key}"] → ${target} exists`)
  }

  const client = await readFile(join(root, pkg.exports['./client']), 'utf8')
  check(client.includes('window.__ModuleLoader__.load({'), 'client bundle uses the __ModuleLoader__ protocol')
  check(client.includes(`id: ${JSON.stringify(pkg.name)}`), 'client bundle id equals the package name')
  check(client.includes('factory: (require) =>'), 'client bundle factory takes an injected require')
  check(client.trimEnd().endsWith('})'), 'client bundle closes the load() call')

  const host = await readFile(join(root, pkg.exports['.']), 'utf8')
  check(host.includes("export * from './host/index.js'"), 'host entry re-exports the host tree')

  // The host half must be loadable as plain Node ESM with no bare imports:
  // it declares no dependency, so any bare specifier would fail at load.
  const hostFiles = (await listFiles(join(root, 'lib', 'host'))).filter(f => f.endsWith('.js'))
  const bareImports = []
  for (const file of hostFiles) {
    const text = await readFile(join(root, 'lib', 'host', file), 'utf8')
    for (const match of text.matchAll(/^\s*(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
      if (!match[1].startsWith('.') && !match[1].startsWith('node:')) bareImports.push(`${file} → ${match[1]}`)
    }
  }
  check(bareImports.length === 0, 'host half has no bare runtime imports (dependency-free)', bareImports.join(', '))
  return { hostFiles }
}

async function checkManifests(pkg) {
  check(pkg.type === 'module', 'package.json type is "module"')
  check(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'dsh.bundle.patch points at cordis.patch.yml')
  check(pkg.dsh?.client?.platform === 'web', 'dsh.client.platform is "web"')
  check('./client' in pkg.exports, 'exports["./client"] is declared (scan requirement)')
  check(!('external' in (pkg.dsh?.client ?? {})), 'dsh.client.external is NOT used (feature-plugin rule)')

  const patch = await readFile(join(root, pkg.dsh.bundle.patch), 'utf8')
  check(/- insert:/.test(patch), 'cordis.patch.yml contains an insert row')
  check(patch.includes(`name: ${pkg.name}`), 'patch row names the package (Node resolution)')

  // Every runtime artifact must be inside the published file set.
  const files = pkg.files ?? []
  for (const required of ['lib/', 'cordis.patch.yml']) {
    check(files.includes(required), `files whitelist covers ${required}`)
  }
}

/**
 * Grep the client source for rules that must hold but cannot be type-checked.
 * @returns the source texts, for the callers that need to inspect them.
 */
async function checkClientSource() {
  const base = join(root, 'src', 'client')
  if (!(await exists(base))) {
    check(false, 'src/client exists')
    return {}
  }
  const files = (await listFiles(base)).filter(f => f.endsWith('.cjs'))
  check(files.length > 0, 'client source has at least one module')

  const sources = {}
  for (const file of files) sources[file] = await readFile(join(base, file), 'utf8')

  const all = Object.entries(sources)

  // Literal colors are banned outside the token layer: the theme owns color.
  const literalColors = all.flatMap(([file, text]) =>
    [...text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g)].map(m => `${file}: ${m[0]}`))
    .filter(entry => !entry.includes('data-plugin'))
  check(literalColors.length === 0, 'client source has no literal colors', literalColors.slice(0, 5).join(', '))

  // A default export anywhere in the host or client half is a load-time
  // regression: it replaces the named exports and drops `inject`.
  const hostSources = await listFiles(join(root, 'src', 'host'))
  const hostTexts = await Promise.all(hostSources.filter(f => f.endsWith('.js'))
    .map(f => readFile(join(root, 'src', 'host', f), 'utf8')))
  const defaultExports = [...hostTexts, ...Object.values(sources)]
    .filter(text => /^\s*export\s+default\s/m.test(text))
  check(defaultExports.length === 0, 'no export default in either half')

  // The stylesheet may only name design tokens, never a literal color and
  // never an invented custom property. `--dsh-scrollbar-*` is the one
  // documented indirection layer (ui-theme scrollbar.css rebinds it to
  // --dsw-alias-scrollbar-*), so it is allowed by name.
  const styleEntry = Object.entries(sources).find(([file]) => file.endsWith('styles.cjs'))
  if (styleEntry !== undefined) {
    const css = styleEntry[1]
    const properties = [...css.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1])
    const foreign = properties
      .filter(name => !name.startsWith('dsw-') && !name.startsWith('dsh-scrollbar-'))
    check(foreign.length === 0, 'stylesheet declares only design tokens', [...new Set(foreign)].join(', '))

    // Every var() reference must be a token we just verified, or a property
    // this same sheet declares (a local binding).
    const referenced = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1].slice(2))
    const declared = new Set(properties)
    const unknown = referenced.filter(name => !name.startsWith('dsw-') && !declared.has(name))
    check(unknown.length === 0, 'every var() reference is a design token or a local binding',
      [...new Set(unknown)].join(', '))

    // An elevated surface takes elevation INSTEAD of a border; pairing them
    // double-draws the edge (docs/web-styling.md).
    const elevated = css.match(/[^{}]*box-shadow:var\(--dsw-elevation[^{}]*\}/g) ?? []
    const paired = elevated.filter(rule => /[^-]border(-(top|right|bottom|left))?:\s*(?!0[;\s}])/.test(rule))
    check(paired.length === 0, 'elevated surfaces do not also draw a border', paired[0]?.slice(0, 60))
  }

  return sources
}

/**
 * The host half must not declare a web-only service dependency.
 */
async function checkHostDiscipline() {
  const text = await readFile(join(root, 'src', 'host', 'index.js'), 'utf8')
  const injectMatch = /export const inject = \[([^\]]*)\]/.exec(text)
  if (injectMatch === null) {
    // Absent `inject` is the strongest form of the rule.
    sink.passes.push('host half declares no inject at all')
    return
  }
  const declared = injectMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
  check(declared.length === 0, 'host half declares no required service (TUI profile safety)', declared.join(', '))
  check(!text.includes("inject = ['webServer'"), 'host half does not require webServer')
}

/**
 * Run every assertion against the current tree and return what it collected.
 *
 * Importable: the module installs no sink and runs no check until this is
 * called, so a test can read the real assertion count instead of counting
 * `check(` sites in this file — which is exactly the number that drifted out
 * of the docs. Calling it twice is safe; each call gets a fresh sink.
 *
 * @returns the assertion labels, split by outcome.
 */
export async function collectChecks() {
  const collected = { passes: [], failures: [] }
  const previous = sink
  sink = collected
  try {
    const pkg = await readJson(join(root, 'package.json'))

    if (!(await exists(join(root, 'lib')))) {
      collected.failures.push('lib/ is missing — run `node scripts/build.mjs` first')
    } else {
      await checkArtifacts(pkg)
    }
    await checkManifests(pkg)
    await checkClientSource()
    await checkHostDiscipline()
  } finally {
    sink = previous
  }
  return collected
}

async function main() {
  const { passes, failures } = await collectChecks()

  for (const line of passes) process.stdout.write(`ok   ${line}\n`)
  for (const line of failures) process.stdout.write(`FAIL ${line}\n`)
  process.stdout.write(`\n${passes.length} passed, ${failures.length} failed\n`)
  if (failures.length > 0) process.exitCode = 1
}

// Only run when invoked as the entry point; importing it must stay side-free.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}

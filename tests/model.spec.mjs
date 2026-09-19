/**
 * Pure-model unit tests.
 *
 * The model layer is the one part of this plugin with no framework
 * dependencies, so it carries the burden of proof: every branch is exercised
 * here, including the malformed and absent inputs that a live GUI will
 * eventually produce. The `t` seat is stubbed with the real English dictionary
 * so formatting assertions test the shipped strings rather than a fixture.
 *
 * @module dsh-context-lens/tests/model.spec
 */

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

const model = require(resolve(root, 'src/client/model/index.cjs'))
const report = require(resolve(root, 'src/client/model/report.cjs'))
const { en } = require(resolve(root, 'src/client/locales.cjs'))

/**
 * A `t` stand-in that interpolates `{name}` placeholders, matching the locale
 * seat's contract closely enough to assert on real copy.
 */
function t(key, params = {}) {
  const template = en[key]
  assert.ok(template !== undefined, `missing dictionary key: ${key}`)
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`))
}

// ---------------------------------------------------------------------------
// tokens / formatTokens
// ---------------------------------------------------------------------------

test('tokens coerces junk to zero and keeps real values', () => {
  assert.equal(model.tokens(1234), 1234)
  assert.equal(model.tokens(0), 0)
  assert.equal(model.tokens(-5), 0)
  assert.equal(model.tokens(Number.NaN), 0)
  assert.equal(model.tokens(Number.POSITIVE_INFINITY), 0)
  assert.equal(model.tokens(undefined), 0)
  assert.equal(model.tokens(null), 0)
  assert.equal(model.tokens('100'), 0, 'strings are not numbers')
})

test('formatTokens matches the official ContextMeter convention', () => {
  // Below 1,000 the raw integer.
  assert.equal(model.formatTokens(0, t), '0')
  assert.equal(model.formatTokens(999, t), '999')
  // In the thousands: one decimal below 100, whole numbers above.
  assert.equal(model.formatTokens(1_000, t), '1K')
  assert.equal(model.formatTokens(1_250, t), '1.3K')
  assert.equal(model.formatTokens(99_400, t), '99.4K')
  assert.equal(model.formatTokens(100_000, t), '100K')
  assert.equal(model.formatTokens(999_000, t), '999K')
  // In the millions: same rule.
  assert.equal(model.formatTokens(1_000_000, t), '1M')
  assert.equal(model.formatTokens(1_450_000, t), '1.5M')
  assert.equal(model.formatTokens(120_000_000, t), '120M')
})

// ---------------------------------------------------------------------------
// occupancy
// ---------------------------------------------------------------------------

test('occupancyOf reports absence rather than guessing', () => {
  assert.deepEqual(model.occupancyOf(undefined), { available: false, reason: 'no-projection' })
  assert.deepEqual(model.occupancyOf(null), { available: false, reason: 'no-projection' })
  assert.deepEqual(model.occupancyOf({ pressureTokens: 500 }), { available: false, reason: 'no-window' })
  assert.deepEqual(
    model.occupancyOf({ contextWindow: 1000 }),
    { available: false, reason: 'no-usage', contextWindow: 1000 },
    'the known window is preserved even without usage',
  )
  // An explicit 0 is a real provider figure, not a missing one: the official
  // meter renders it as a 0% ring, so we report a reading rather than nothing.
  const zero = model.occupancyOf({ contextWindow: 1000, pressureTokens: 0 })
  assert.equal(zero.available, true)
  assert.equal(zero.percent, 0)
  assert.equal(zero.remainingTokens, 1000)
})

test('occupancyOf computes percent, remaining and overflow', () => {
  const half = model.occupancyOf({ contextWindow: 100_000, pressureTokens: 50_000 })
  assert.equal(half.available, true)
  assert.equal(half.percent, 50)
  assert.equal(half.remainingTokens, 50_000)
  assert.equal(half.overflowed, false)
  assert.equal(half.projected, false, 'no projectedTokens means no ~ marker')

  // projectedTokens is the next-request figure and wins over the anchor.
  const projected = model.occupancyOf({
    contextWindow: 100_000,
    pressureTokens: 50_000,
    projectedTokens: 75_000,
  })
  assert.equal(projected.usedTokens, 75_000)
  assert.equal(projected.reportedTokens, 50_000, 'the anchor is kept separate')
  assert.equal(projected.percent, 75)
  assert.equal(projected.projected, true, 'the ~ marker is set')

  // Over the window: clamped percent, zero remaining, overflow flagged.
  const over = model.occupancyOf({ contextWindow: 1_000, pressureTokens: 2_000 })
  assert.equal(over.percent, 100)
  assert.equal(over.remainingTokens, 0)
  assert.equal(over.overflowed, true)
})

test('occupancyOf treats a zero window as unavailable and ignores negatives', () => {
  assert.equal(model.occupancyOf({ contextWindow: 0, pressureTokens: 100 }).reason, 'no-window')
  const negative = model.occupancyOf({ contextWindow: 1_000, pressureTokens: -50 })
  assert.equal(negative.reason, 'no-usage', 'a negative anchor is coerced to 0')
})

// ---------------------------------------------------------------------------
// composition
// ---------------------------------------------------------------------------

test('compositionOf normalizes the three buckets into shares', () => {
  const composition = model.compositionOf({ systemTokens: 500, toolsTokens: 300, messageTokens: 200 })
  assert.equal(composition.available, true)
  assert.equal(composition.total, 1_000)
  const shares = Object.fromEntries(composition.segments.map(s => [s.key, s.share]))
  assert.equal(shares.system, 0.5)
  assert.equal(shares.tools, 0.3)
  assert.equal(shares.messages, 0.2)
  // Shares must sum to 1 so the bar fills exactly.
  assert.ok(Math.abs(composition.segments.reduce((sum, s) => sum + s.share, 0) - 1) < 1e-9)
})

test('compositionOf degrades on absent or empty input', () => {
  assert.deepEqual(model.compositionOf(undefined), { available: false, segments: [], total: 0 })
  assert.deepEqual(
    model.compositionOf({ systemTokens: 0, toolsTokens: 0, messageTokens: 0 }),
    { available: false, segments: [], total: 0 },
  )
  // Junk values coerce to zero rather than producing NaN widths.
  const junk = model.compositionOf({ systemTokens: 'lots', toolsTokens: null, messageTokens: undefined })
  assert.equal(junk.available, false)
})

// ---------------------------------------------------------------------------
// headroom
// ---------------------------------------------------------------------------

test('headroomOf estimates capacity from recent growth', () => {
  const occupancy = model.occupancyOf({ contextWindow: 100_000, pressureTokens: 50_000 })
  const samples = [
    { totalTokens: 10_000 },
    { totalTokens: 20_000 },
    { totalTokens: 30_000 },
  ]
  const headroom = model.headroomOf(occupancy, samples, 10)
  assert.equal(headroom.available, true)
  assert.equal(headroom.rate, 10_000, 'average of the two +10k steps')
  assert.equal(headroom.turnsLeft, 5, '50k remaining / 10k per step')
  assert.equal(headroom.overflowed, false)
})

test('headroomOf flags an imminent overflow', () => {
  const occupancy = model.occupancyOf({ contextWindow: 100_000, pressureTokens: 95_000 })
  const headroom = model.headroomOf(occupancy, [{ totalTokens: 80_000 }, { totalTokens: 95_000 }], 10)
  assert.equal(headroom.rate, 15_000)
  assert.equal(headroom.turnsLeft, 0)
  assert.equal(headroom.overflowed, true, 'one more step of 15k exceeds the 5k left')
})

test('headroomOf refuses to invent infinity for a flat context', () => {
  const occupancy = model.occupancyOf({ contextWindow: 100_000, pressureTokens: 50_000 })
  // A reclaim makes net growth zero; there is no honest "turns left" then.
  const flat = model.headroomOf(occupancy, [{ totalTokens: 50_000 }, { totalTokens: 40_000 }], 10)
  assert.equal(flat.rate, 0)
  assert.equal(flat.turnsLeft, undefined, 'unknown, not Infinity')
  assert.equal(flat.remainingTokens, 50_000)
})

test('headroomOf handles too few samples and unavailable occupancy', () => {
  const occupancy = model.occupancyOf({ contextWindow: 1_000, pressureTokens: 100 })
  assert.equal(model.headroomOf(occupancy, [], 10).turnsLeft, undefined)
  assert.equal(model.headroomOf(occupancy, [{ totalTokens: 1 }], 10).turnsLeft, undefined)
  assert.equal(model.headroomOf(occupancy, undefined, 10).available, true, 'a missing series is not fatal')
  assert.equal(
    model.headroomOf(model.occupancyOf(undefined), [{ totalTokens: 1 }, { totalTokens: 2 }], 10).available,
    false,
  )
})

test('headroomOf respects the pace window', () => {
  const occupancy = model.occupancyOf({ contextWindow: 1_000_000, pressureTokens: 100 })
  // A wild early jump then flat: a narrow window must ignore the history.
  const samples = [
    { totalTokens: 0 },
    { totalTokens: 90_000 },
    { totalTokens: 90_000 },
    { totalTokens: 90_000 },
  ]
  const narrow = model.headroomOf(occupancy, samples, 2)
  assert.equal(narrow.window, 2)
  assert.equal(narrow.rate, 0, 'the last two samples are flat')
  const wide = model.headroomOf(occupancy, samples, 10)
  assert.equal(wide.window, 3, 'clamped to samples.length - 1')
  assert.equal(wide.rate, 30_000)
})

// ---------------------------------------------------------------------------
// cache
// ---------------------------------------------------------------------------

test('cacheOf computes the prompt-side hit rate', () => {
  const cache = model.cacheOf({
    uncachedInputTokens: 100,
    cacheReadTokens: 800,
    cacheWriteTokens: 100,
    outputTokens: 50,
  })
  assert.equal(cache.available, true)
  assert.equal(cache.promptSideTokens, 1_000)
  assert.equal(cache.hitRate, 80, '800 of 1000 prompt-side tokens from cache')
  assert.equal(cache.outputTokens, 50)
})

test('cacheOf excludes output from the rate and degrades cleanly', () => {
  const outputOnly = model.cacheOf({ outputTokens: 500 })
  assert.equal(outputOnly.available, true)
  assert.equal(outputOnly.hitRate, 0, 'no prompt-side traffic means no hit rate')
  assert.equal(model.cacheOf(undefined).available, false)
  assert.equal(model.cacheOf({}).available, false)
  assert.equal(model.cacheOf({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }).available, false)
})

// ---------------------------------------------------------------------------
// provenance
// ---------------------------------------------------------------------------

test('provenanceOf names the anchor', () => {
  const available = model.occupancyOf({ contextWindow: 1_000, pressureTokens: 100 })
  assert.equal(model.provenanceOf(available, 'usage').kind, 'usage')
  assert.equal(model.provenanceOf(available, 'usage').key, 'provenance.reported')
  assert.equal(model.provenanceOf(available, 'estimated').kind, 'estimated')
  assert.equal(model.provenanceOf(available, 'estimated').key, 'provenance.estimated')
  assert.equal(model.provenanceOf(available, undefined).kind, 'none')
  assert.equal(model.provenanceOf(model.occupancyOf(undefined), 'usage').kind, 'none')
})

// ---------------------------------------------------------------------------
// timeline
// ---------------------------------------------------------------------------

test('timelineOf folds samples and marks reclaims', () => {
  const payload = {
    ok: true,
    coverage: 'observed-since-plugin-load',
    truncated: false,
    dropped: 0,
    maxSamples: 2_000,
    samples: [
      { logRevision: 5, totalTokens: 1_000, deltaTokens: 1_000, kind: 'first', eventType: 'step/end', turn: 1, step: 1 },
      { logRevision: 9, totalTokens: 3_000, deltaTokens: 2_000, kind: 'grow', eventType: 'step/end', turn: 1, step: 2 },
      { logRevision: 12, totalTokens: 1_500, deltaTokens: -1_500, kind: 'reclaim', eventType: 'compaction/summary' },
    ],
  }
  const timeline = model.timelineOf(payload)
  assert.equal(timeline.available, true)
  assert.equal(timeline.samples.length, 3)
  assert.equal(timeline.peak, 3_000)
  assert.equal(timeline.reclaimedTotal, 1_500)
  assert.equal(timeline.samples[2].reclaimed, 1_500, 'a drop is surfaced as a reclaim')
  assert.equal(timeline.samples[1].reclaimed, 0)
  assert.equal(timeline.coverage, 'observed-since-plugin-load')
})

test('timelineOf preserves the anchor of every sample', () => {
  // The host stamps `measurement.baseline.kind` on each sample. This fold is
  // the only hop between that payload and the badge, so dropping the field here
  // is what pinned every session to "no anchor" regardless of the real basis.
  const timeline = model.timelineOf({
    ok: true,
    samples: [
      { totalTokens: 1_000, baselineKind: 'usage' },
      { totalTokens: 2_000, baselineKind: 'estimated' },
    ],
  })
  assert.equal(timeline.samples[0].baselineKind, 'usage')
  assert.equal(timeline.samples[1].baselineKind, 'estimated')

  // An absent or malformed anchor is the third state, not a crash.
  const junk = model.timelineOf({
    ok: true,
    samples: [{ totalTokens: 5 }, { totalTokens: 6, baselineKind: 7 }],
  })
  assert.equal(junk.samples[0].baselineKind, 'none')
  assert.equal(junk.samples[1].baselineKind, 'none')
})

test('newestBaselineKind reads the last sample only', () => {
  const folded = model.timelineOf({
    ok: true,
    samples: [
      { totalTokens: 1_000, baselineKind: 'usage' },
      { totalTokens: 2_000, baselineKind: 'estimated' },
    ],
  })
  assert.equal(model.newestBaselineKind(folded), 'estimated', 'the newest sample wins')
  assert.equal(model.newestBaselineKind({ samples: [] }), undefined, 'no sample, no anchor')
  assert.equal(model.newestBaselineKind(undefined), undefined, 'a missing series is not fatal')
})

test('timelineOf degrades on a failed or absent payload', () => {
  assert.equal(model.timelineOf(undefined).available, false)
  assert.equal(model.timelineOf(null).available, false)
  assert.equal(model.timelineOf({ ok: false, error: 'token-meter-unavailable' }).available, false)
  assert.equal(model.timelineOf({ ok: true, samples: [] }).available, false)
  assert.equal(model.timelineOf({ ok: true, samples: 'nope' }).available, false)
  // Malformed individual samples are dropped, not fatal.
  const mixed = model.timelineOf({ ok: true, samples: [null, 'x', { totalTokens: 5 }] })
  assert.equal(mixed.samples.length, 1)
})

// ---------------------------------------------------------------------------
// buildViewModel
// ---------------------------------------------------------------------------

test('buildViewModel assembles the whole model from partial input', () => {
  const full = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: 200_000, pressureTokens: 40_000 },
    breakdown: { systemTokens: 1_000, toolsTokens: 500, messageTokens: 500 },
    usage: { uncachedInputTokens: 10, cacheReadTokens: 90, cacheWriteTokens: 0, outputTokens: 5 },
    stats: { turns: 3, steps: 9 },
    timeline: {
      ok: true,
      coverage: 'observed-since-plugin-load',
      samples: [{ totalTokens: 20_000, kind: 'first' }, { totalTokens: 40_000, kind: 'grow', deltaTokens: 20_000 }],
    },
    paceWindow: 5,
  })
  assert.equal(full.hasSession, true)
  assert.equal(full.occupancy.available, true)
  assert.equal(full.composition.available, true)
  assert.equal(full.cache.available, true)
  assert.equal(full.timeline.available, true)
  assert.equal(full.headroom.rate, 20_000)
  assert.equal(full.stats.turns, 3)
  assert.equal(full.stats.steps, 9)
})

test('buildViewModel derives the badge from the newest sample, not from an input nobody sets', () => {
  // The regression this pins: `buildViewModel` used to read `input.baselineKind`,
  // which no caller ever supplies (the four projection keys carry no anchor), so
  // the badge fell through to "no anchor" for every session — including one the
  // host had measured against a provider-reported usage anchor.
  const usage = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: 100_000, pressureTokens: 25_000 },
    timeline: {
      ok: true,
      coverage: 'observed-since-plugin-load',
      samples: [
        { totalTokens: 10_000, baselineKind: 'estimated' },
        { totalTokens: 25_000, baselineKind: 'usage' },
      ],
    },
  })
  assert.equal(usage.provenance.kind, 'usage')
  assert.equal(usage.provenance.key, 'provenance.reported')

  // The newest sample decides: an older usage anchor followed by a heuristic
  // measurement reports the heuristic, which is what the figure now rests on.
  const estimated = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: 100_000, pressureTokens: 25_000 },
    timeline: {
      ok: true,
      samples: [
        { totalTokens: 25_000, baselineKind: 'usage' },
        { totalTokens: 30_000, baselineKind: 'estimated' },
      ],
    },
  })
  assert.equal(estimated.provenance.kind, 'estimated')
  assert.equal(estimated.provenance.key, 'provenance.estimated')

  // No sampled point means no anchor to name; the third branch stays reachable
  // and is not replaced by a guess.
  const unsampled = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: 100_000, pressureTokens: 25_000 },
  })
  assert.equal(unsampled.provenance.kind, 'none')
  assert.equal(unsampled.provenance.key, 'provenance.none')
})

test('buildViewModel is total: an empty input yields a coherent model', () => {
  const empty = model.buildViewModel({})
  assert.equal(empty.hasSession, false)
  assert.equal(empty.occupancy.available, false)
  assert.equal(empty.composition.available, false)
  assert.equal(empty.cache.available, false)
  assert.equal(empty.timeline.available, false)
  assert.equal(empty.headroom.available, false)
  assert.equal(empty.stats.turns, 0)
  // Every sub-model must expose `available` so the view can branch uniformly.
  for (const key of ['occupancy', 'composition', 'cache', 'timeline', 'headroom']) {
    assert.equal(typeof empty[key].available, 'boolean', `${key}.available is a boolean`)
  }
})

test('buildViewModel tolerates hostile projection values', () => {
  const hostile = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: Number.MAX_SAFE_INTEGER, pressureTokens: Number.MAX_SAFE_INTEGER },
    breakdown: { systemTokens: Number.NaN, toolsTokens: -1, messageTokens: Number.POSITIVE_INFINITY },
    usage: { cacheReadTokens: -5 },
    stats: { turns: 'many', steps: null },
    timeline: { ok: true, samples: [{ totalTokens: Number.NaN }] },
  })
  assert.equal(hostile.composition.available, false, 'all-junk buckets are absent, not NaN')
  assert.equal(hostile.cache.available, false)
  assert.equal(hostile.timeline.available, false, 'the NaN sample coerces to 0')
  assert.equal(hostile.stats.turns, 0)
  assert.ok(Number.isFinite(hostile.occupancy.percent))
})

// ---------------------------------------------------------------------------
// report export
// ---------------------------------------------------------------------------

test('toMarkdown renders every section with real copy', () => {
  const viewModel = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: 100_000, pressureTokens: 25_000 },
    breakdown: { systemTokens: 900, toolsTokens: 600, messageTokens: 500 },
    usage: { uncachedInputTokens: 100, cacheReadTokens: 900, cacheWriteTokens: 0, outputTokens: 20 },
    timeline: {
      ok: true,
      coverage: 'observed-since-plugin-load',
      samples: [
        { totalTokens: 1_000, deltaTokens: 1_000, kind: 'first', eventType: 'step/end', turn: 1, step: 1 },
        { totalTokens: 2_000, deltaTokens: 1_000, kind: 'grow', eventType: 'step/end', turn: 1, step: 2 },
      ],
    },
  })
  const markdown = report.toMarkdown(viewModel, t, { sessionId: 'session-1', generatedAt: '2026-01-01T00:00:00.000Z' })

  assert.ok(markdown.startsWith('# Context Lens report'))
  assert.ok(markdown.includes('session-1'), 'names the session')
  assert.ok(markdown.includes('2026-01-01T00:00:00.000Z'), 'stamps the time')
  // Every section heading must be present.
  for (const key of ['report.section.occupancy', 'report.section.breakdown', 'report.section.headroom', 'report.section.cache', 'report.section.provenance', 'report.section.timeline']) {
    assert.ok(markdown.includes(`## ${t(key)}`), `contains section: ${key}`)
  }
  assert.ok(markdown.includes('25K'), 'formats token figures')
  assert.ok(markdown.includes('90%'), 'reports the cache hit rate')
  assert.ok(markdown.includes('Timeline 1 · step 1'.replace('Timeline', 'Turn')), 'names the sample position')
  // The coverage caveat must survive into the export.
  assert.ok(markdown.includes(t('timeline.partial')), 'states the sampling caveat')
})

test('toMarkdown renders placeholders instead of crashing when data is absent', () => {
  const empty = model.buildViewModel({})
  const markdown = report.toMarkdown(empty, t, { sessionId: undefined, generatedAt: 'now' })
  assert.ok(markdown.includes(t('report.noData')), 'marks absent figures')
  assert.ok(markdown.includes('unknown'), 'names an unknown session')
  assert.ok(markdown.includes(t('timeline.empty')), 'explains the missing timeline')
})

test('toJson emits a versioned, parseable document', () => {
  const viewModel = model.buildViewModel({
    hasSession: true,
    pressure: { contextWindow: 100_000, pressureTokens: 10_000 },
  })
  const text = report.toJson(viewModel, { sessionId: 'session-9', generatedAt: '2026-01-01T00:00:00.000Z' })
  const parsed = JSON.parse(text)
  assert.equal(parsed.schema, 'dsh-context-lens/report@1', 'the schema tag is versioned')
  assert.equal(parsed.sessionId, 'session-9')
  assert.equal(parsed.occupancy.available, true)
  assert.equal(parsed.occupancy.percent, 10)
  assert.equal(parsed.timeline.sampleCount, 0)
  assert.ok(text.endsWith('\n'), 'ends with a newline')
})

test('reportFilename is filesystem-safe and stamped', () => {
  const name = report.reportFilename('sess/../../etc:passwd', 'md', '2026-01-01T12:00:00.000Z')
  assert.ok(!name.includes('/'), 'no path separators survive')
  assert.ok(!name.includes(':'), 'no colons survive')
  assert.ok(!name.includes('..'), 'no traversal survives')
  assert.ok(name.endsWith('.md'), 'carries the extension')
  assert.ok(name.startsWith('context-lens-'))
  assert.equal(report.reportFilename(undefined, 'json', 'now').endsWith('.json'), true)
})

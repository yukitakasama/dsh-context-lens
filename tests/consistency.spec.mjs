/**
 * Numeric-consistency tests against the official implementations.
 *
 * The panel shows numbers a user will compare against the official
 * `ContextMeter`. If our occupancy disagreed with theirs by a point, the plugin
 * would look broken. These tests re-implement the official formulas verbatim
 * from the harness source and assert our derived values agree.
 *
 * Official references (dsh 0.1.5-rc.1):
 * - occupancy: `packages/client/ui-conversation/src/client/context-occupancy.ts`
 * - formatting: `packages/client/ui-conversation/src/client/skeleton/ContextMeter.tsx`
 *
 * @module dsh-context-lens/tests/consistency.spec
 */

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const model = await import(resolve(root, 'src/client/model/index.cjs'))

/**
 * The official `contextOccupancy`, copied verbatim from the harness.
 * @param pressure - the `contextPressure` projection value.
 * @returns the official occupancy, or null.
 */
function officialOccupancy(pressure) {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (usedTokens === undefined || pressure?.contextWindow === undefined) return null
  return {
    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow,
  }
}

/**
 * The official `formatTokens`, copied verbatim (the templates are `{value}K`
 * and `{value}M`, identical in both dictionaries).
 * @param value - token count.
 * @returns the formatted string.
 */
function officialFormatTokens(value) {
  const scaled = candidate => candidate >= 100
    ? String(Math.round(candidate))
    : String(Math.round(candidate * 10) / 10)
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${scaled(value / 1_000)}K`
  return `${scaled(value / 1_000_000)}M`
}

test('occupancy agrees with the official formula across realistic inputs', () => {
  const windows = [200_000, 128_000, 32_768, 1_000_000]
  const ratios = [0, 0.001, 0.0525, 0.1, 0.333, 0.5, 0.667, 0.9, 0.995, 1, 1.4]

  for (const contextWindow of windows) {
    for (const ratio of ratios) {
      const projectedTokens = Math.round(contextWindow * ratio)
      const official = officialOccupancy({ contextWindow, projectedTokens })
      const ours = model.occupancyOf({ contextWindow, projectedTokens })

      assert.equal(ours.available, true, `available at ${ratio} of ${contextWindow}`)
      assert.equal(
        ours.percent,
        official.percent,
        `percent must match at projected=${projectedTokens} window=${contextWindow}`,
      )
      assert.equal(ours.percent >= 0 && ours.percent <= 100, true, 'percent stays in range')
    }
  }
})

test('occupancy uses pressureTokens when projectedTokens is absent, like the official', () => {
  const pressure = { contextWindow: 100_000, pressureTokens: 25_000 }
  const official = officialOccupancy(pressure)
  const ours = model.occupancyOf(pressure)
  assert.equal(ours.percent, official.percent)
  assert.equal(ours.usedTokens, official.usedTokens)
  assert.equal(ours.projected, false, 'no `~` marker when there is no projection')
})

test('occupancy clamps an over-window projection the same way the official does', () => {
  // Official: round(1.4 * 100) = 140, then min(100) = 100.
  const pressure = { contextWindow: 1_000, projectedTokens: 1_400 }
  assert.equal(officialOccupancy(pressure).percent, 100)
  const ours = model.occupancyOf(pressure)
  assert.equal(ours.percent, 100)
  assert.equal(ours.overflowed, true, 'but we also flag the overflow')
  assert.equal(ours.remainingTokens, 0, 'remaining never goes negative')
})

test('formatting matches the official convention at every boundary', () => {
  const cases = [
    0, 1, 42, 999, 1_000, 1_500, 1_050, 12_200, 99_400, 99_500,
    100_000, 517_000, 999_999, 1_000_000, 1_200_000, 12_500_000,
  ]
  for (const value of cases) {
    assert.equal(
      model.formatTokens(value),
      officialFormatTokens(value),
      `formatTokens(${value}) must match the official rendering`,
    )
  }
})

test('the sub-1000 branch is exact, not rounded', () => {
  // The official returns a raw integer below 1000 — no K, no decimal.
  for (const value of [0, 7, 512, 999]) {
    assert.equal(model.formatTokens(value), String(value))
  }
})

test('formatting tolerates hostile input without producing NaN', () => {
  for (const value of [undefined, null, Number.NaN, Infinity, -Infinity, 'x', {}]) {
    const rendered = model.formatTokens(value)
    assert.equal(typeof rendered, 'string', `(${String(value)}) renders a string`)
    assert.ok(!rendered.includes('NaN'), `(${String(value)}) never renders NaN`)
  }
})

test('occupancy refuses to invent a percentage from a missing half', () => {
  // The official renders NOTHING when either half is missing; a 0% ring would
  // be a confident lie, so `available` must be false instead.
  assert.equal(model.occupancyOf({ contextWindow: 1_000 }).available, false)
  assert.equal(model.occupancyOf({ pressureTokens: 500 }).available, false)
  assert.equal(model.occupancyOf(undefined).available, false)
  // An ABSENT anchor is not a reading. An explicit 0 IS one: the official
  // meter draws a 0% ring for it, so we must not report "unavailable".
  assert.equal(model.occupancyOf({ contextWindow: 1_000 }).available, false, 'absent anchor')
  const explicitZero = model.occupancyOf({ contextWindow: 1_000, pressureTokens: 0 })
  assert.equal(explicitZero.available, true, 'an explicit zero is a real reading')
  assert.equal(explicitZero.percent, 0)
  assert.equal(explicitZero.remainingTokens, 1_000)
})

test('composition shares never imply a fabricated total', () => {
  const breakdown = { systemTokens: 4_000, toolsTokens: 6_000, messageTokens: 10_000 }
  const composition = model.compositionOf(breakdown)
  assert.equal(composition.available, true)
  const total = composition.segments.reduce((sum, segment) => sum + segment.tokens, 0)
  assert.equal(total, 20_000, 'the total is the sum of what the harness gave us')
  const shares = composition.segments.reduce((sum, segment) => sum + segment.share, 0)
  assert.ok(Math.abs(shares - 1) < 1e-9, 'shares sum to 1')
})

test('a zero-token breakdown is unavailable, not a 0/0 division', () => {
  const composition = model.compositionOf({ systemTokens: 0, toolsTokens: 0, messageTokens: 0 })
  assert.equal(composition.available, false)
})

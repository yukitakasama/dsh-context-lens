/**
 * Pure view-model derivation for dsh-context-lens.
 *
 * No React, no DOM, no `ctx`: every function here is a total function from the
 * official projection values to a render-ready model, which is what makes the
 * whole layer unit-testable under plain `node --test`.
 *
 * Two rules govern the numbers:
 *
 *  1. **Never invent precision.** Attribution groups only re-present figures
 *     the harness already computed (`contextBreakdown`'s three buckets). Where
 *     a figure is genuinely ours — the projected turn capacity — it is derived
 *     from a stated window and labelled as an estimate in the UI.
 *  2. **Degrade, never throw.** A missing or malformed projection yields a
 *     model with `available: false` rather than an exception, so one absent
 *     capability cannot take down the rest of the panel.
 *
 * @module dsh-context-lens/client/model
 */

/**
 * Coerce a possibly-absent value to a finite non-negative number.
 * @param value - candidate.
 * @returns the value when it is a finite number >= 0, otherwise 0.
 */
function tokens(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/**
 * Format a token count the way the official `ContextMeter` does: raw below
 * 1,000, then one decimal under 100 and a whole number above it, with K/M
 * units. Matching this convention keeps the two meters visually consistent.
 *
 * @param value - token count.
 * @param t - the locale `t` seat.
 * @returns the compact localized count.
 */
function formatTokens(value, t) {
  const count = tokens(value)
  const scaled = candidate => candidate >= 100
    ? String(Math.round(candidate))
    : String(Math.round(candidate * 10) / 10)
  if (count < 1_000) return String(count)
  if (count < 1_000_000) return t('unit.thousand', { value: scaled(count / 1_000) })
  return t('unit.million', { value: scaled(count / 1_000_000) })
}

/**
 * Build the occupancy model from `contextPressure`.
 *
 * `usedTokens` prefers `projectedTokens` — what the NEXT request would cost —
 * because that is the number that matters for headroom, and it is why the
 * official meter prefixes the figure with `~`. `pressureTokens` is the
 * provider-anchored sample and is kept separately so the UI can be explicit
 * about which is which.
 *
 * @param pressure - the `contextPressure` projection value, or undefined.
 * @returns an occupancy model; `available` is false without a window or usage.
 */
function occupancyOf(pressure) {
  if (pressure === undefined || pressure === null) {
    return { available: false, reason: 'no-projection' }
  }
  const window = tokens(pressure.contextWindow)
  const reported = tokens(pressure.pressureTokens)
  const projected = pressure.projectedTokens === undefined ? reported : tokens(pressure.projectedTokens)
  if (window === 0) {
    return { available: false, reason: 'no-window' }
  }
  if (reported === 0 && projected === 0) {
    return { available: false, reason: 'no-usage', contextWindow: window }
  }
  const used = Math.min(projected, window)
  const remaining = Math.max(0, window - used)
  return {
    available: true,
    contextWindow: window,
    reportedTokens: reported,
    usedTokens: used,
    remainingTokens: remaining,
    percent: Math.max(0, Math.min(100, Math.round(used / window * 100))),
    overflowed: projected > window,
    // The provider figure and the next-request projection differ whenever the
    // surface moved since the sample; the UI marks that with `~`.
    projected: projected !== reported,
  }
}

/**
 * Normalize `contextBreakdown`'s three buckets into a stacked composition.
 *
 * These are the harness's own heuristic figures and they deliberately do NOT
 * sum to `projectedTokens`, so no total is fabricated here.
 *
 * @param breakdown - the `contextBreakdown` projection value, or undefined.
 * @returns a composition model.
 */
function compositionOf(breakdown) {
  if (breakdown === undefined || breakdown === null) {
    return { available: false, segments: [], total: 0 }
  }
  const parts = [
    { key: 'system', labelKey: 'breakdown.system', tokens: tokens(breakdown.systemTokens) },
    { key: 'tools', labelKey: 'breakdown.tools', tokens: tokens(breakdown.toolsTokens) },
    { key: 'messages', labelKey: 'breakdown.messages', tokens: tokens(breakdown.messageTokens) },
  ]
  const total = parts.reduce((sum, part) => sum + part.tokens, 0)
  if (total === 0) return { available: false, segments: [], total: 0 }
  return {
    available: true,
    total,
    // Widths are shares of the harness total; the bar itself is scaled to the
    // provider percent by the component, exactly as the official meter does.
    segments: parts.map(part => ({ ...part, share: part.tokens / total })),
  }
}

/**
 * Build the headroom model: how much is left and how fast it is being spent.
 *
 * The capacity estimate divides remaining tokens by the average per-step
 * growth over the last `paceWindow` samples. It is an ESTIMATE and is labelled
 * as one: a single large tool result invalidates it immediately, which is why
 * the panel also shows the raw per-step rate next to it.
 *
 * @param occupancy - result of {@link occupancyOf}.
 * @param samples - timeline samples ({ totalTokens } in revision order).
 * @param paceWindow - how many recent steps to average over.
 * @returns a headroom model.
 */
function headroomOf(occupancy, samples, paceWindow) {
  if (!occupancy.available) return { available: false, reason: 'no-occupancy' }
  const usable = Array.isArray(samples) ? samples : []
  if (usable.length < 2) {
    return {
      available: true,
      remainingTokens: occupancy.remainingTokens,
      rate: 0,
      turnsLeft: undefined,
      overflowed: occupancy.overflowed,
      window: 0,
    }
  }
  const window = Math.max(1, Math.min(paceWindow, usable.length - 1))
  const recent = usable.slice(-(window + 1))
  let growth = 0
  for (let i = 1; i < recent.length; i++) {
    growth += Math.max(0, tokens(recent[i].totalTokens) - tokens(recent[i - 1].totalTokens))
  }
  const rate = growth / window
  // A flat or shrinking context has no meaningful "turns left": report the
  // remaining tokens and an explicit unknown rather than a fake infinity.
  const turnsLeft = rate > 0 ? Math.floor(occupancy.remainingTokens / rate) : undefined
  return {
    available: true,
    remainingTokens: occupancy.remainingTokens,
    rate,
    turnsLeft,
    overflowed: occupancy.overflowed || (rate > 0 && rate > occupancy.remainingTokens),
    window,
  }
}

/**
 * Build the cache-economics model from `tokenUsage`.
 *
 * The four buckets are disjoint, so the hit rate is
 * `cacheRead / (uncached + cacheRead + cacheWrite)` — the share of prompt-side
 * traffic served from cache. Output is reported but excluded from the rate,
 * because it never enters the prompt.
 *
 * @param usage - the `tokenUsage` projection value, or undefined.
 * @returns a cache model.
 */
function cacheOf(usage) {
  if (usage === undefined || usage === null) return { available: false }
  const uncached = tokens(usage.uncachedInputTokens)
  const cacheRead = tokens(usage.cacheReadTokens)
  const cacheWrite = tokens(usage.cacheWriteTokens)
  const output = tokens(usage.outputTokens)
  const promptSide = uncached + cacheRead + cacheWrite
  if (promptSide === 0 && output === 0) return { available: false }
  return {
    available: true,
    uncachedInputTokens: uncached,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: output,
    promptSideTokens: promptSide,
    hitRate: promptSide === 0 ? 0 : Math.round(cacheRead / promptSide * 100),
  }
}

/**
 * Describe where the occupancy figure came from.
 *
 * @param occupancy - result of {@link occupancyOf}.
 * @param baselineKind - the `baseline.kind` of the newest measurement.
 * @returns a provenance model naming the anchor.
 */
function provenanceOf(occupancy, baselineKind) {
  if (!occupancy.available) return { key: 'provenance.none', kind: 'none' }
  const kind = baselineKind === 'usage' ? 'usage' : baselineKind === 'estimated' ? 'estimated' : 'none'
  return {
    kind,
    key: kind === 'usage'
      ? 'provenance.reported'
      : kind === 'estimated' ? 'provenance.estimated' : 'provenance.none',
  }
}

/**
 * Fold a timeline payload into a render-ready series.
 *
 * Reclaims (a drop between consecutive samples) are surfaced as their own
 * points so the view can mark a compaction rather than drawing a mystery dip.
 *
 * @param payload - the timeline route's JSON body, or undefined.
 * @returns a timeline model.
 */
function timelineOf(payload) {
  if (payload === undefined || payload === null || payload.ok !== true) {
    return { available: false, samples: [], peak: 0 }
  }
  const samples = Array.isArray(payload.samples) ? payload.samples : []
  const points = samples
    // A non-finite total is a malformed point, not a zero: dropping it keeps
    // the series honest instead of drawing a phantom dip to the axis.
    .filter(sample => sample !== null
      && typeof sample === 'object'
      && Number.isFinite(sample.totalTokens))
    .map((sample, index) => ({
      index,
      logRevision: tokens(sample.logRevision),
      totalTokens: tokens(sample.totalTokens),
      deltaTokens: typeof sample.deltaTokens === 'number' ? sample.deltaTokens : 0,
      kind: typeof sample.kind === 'string' ? sample.kind : 'flat',
      eventType: typeof sample.eventType === 'string' ? sample.eventType : '',
      turn: sample.turn,
      step: sample.step,
      reclaimed: typeof sample.deltaTokens === 'number' && sample.deltaTokens < 0
        ? -sample.deltaTokens
        : 0,
    }))
  return {
    available: points.length > 0,
    coverage: typeof payload.coverage === 'string' ? payload.coverage : 'unknown',
    truncated: payload.truncated === true,
    dropped: tokens(payload.dropped),
    maxSamples: tokens(payload.maxSamples),
    samples: points,
    peak: points.reduce((max, point) => Math.max(max, point.totalTokens), 0),
    reclaimedTotal: points.reduce((sum, point) => sum + point.reclaimed, 0),
  }
}

/**
 * Assemble the complete view model for one render.
 *
 * @param input - the raw projection values plus optional timeline payload.
 * @returns the view model handed to the presentational components.
 */
function buildViewModel(input) {
  const occupancy = occupancyOf(input.pressure)
  const composition = compositionOf(input.breakdown)
  const cache = cacheOf(input.usage)
  const timeline = timelineOf(input.timeline)
  return {
    hasSession: input.hasSession === true,
    occupancy,
    composition,
    cache,
    timeline,
    headroom: headroomOf(occupancy, timeline.samples, input.paceWindow ?? 10),
    provenance: provenanceOf(occupancy, input.baselineKind),
    stats: {
      turns: tokens(input.stats?.turns),
      steps: tokens(input.stats?.steps),
    },
  }
}

exports.tokens = tokens
exports.formatTokens = formatTokens
exports.occupancyOf = occupancyOf
exports.compositionOf = compositionOf
exports.headroomOf = headroomOf
exports.cacheOf = cacheOf
exports.provenanceOf = provenanceOf
exports.timelineOf = timelineOf
exports.buildViewModel = buildViewModel

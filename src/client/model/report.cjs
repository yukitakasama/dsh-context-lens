/**
 * Report export: turn a view model into a portable Markdown or JSON document.
 *
 * The whole feature is local — no network, no host call — which is what makes
 * it work in an offline session. The exports exist because a context
 * investigation is usually something you want to hand to someone else.
 *
 * @module dsh-context-lens/client/model/report
 */

const { formatTokens } = require('./index.cjs')

/**
 * Render one labeled figure as a Markdown table row.
 * @param label - the localized label.
 * @param value - the already-formatted value.
 * @returns a Markdown table row.
 */
function row(label, value) {
  return `| ${label} | ${value} |`
}

/**
 * Build a Markdown report.
 *
 * @param model - the view model from `buildViewModel`.
 * @param t - the locale `t` seat.
 * @param meta - `{ sessionId, generatedAt }`.
 * @returns the Markdown document.
 */
function toMarkdown(model, t, meta) {
  const lines = []
  lines.push(`# ${t('report.title')}`)
  lines.push('')
  lines.push(`- ${t('report.session')}: \`${meta.sessionId ?? 'unknown'}\``)
  lines.push(`- ${t('report.generatedAt')}: ${meta.generatedAt}`)
  lines.push('')

  lines.push(`## ${t('report.section.occupancy')}`)
  lines.push('')
  lines.push(`| ${t('occupancy.title')} | ${t('axis.tokens')} |`)
  lines.push('| --- | --- |')
  if (model.occupancy.available) {
    lines.push(row(t('occupancy.used'), formatTokens(model.occupancy.usedTokens, t)))
    lines.push(row(t('occupancy.remaining'), formatTokens(model.occupancy.remainingTokens, t)))
    lines.push(row(t('occupancy.window'), formatTokens(model.occupancy.contextWindow, t)))
    lines.push(row(t('occupancy.title'), `${model.occupancy.percent}%`))
  } else {
    lines.push(row(t('occupancy.title'), t('report.noData')))
  }
  lines.push('')

  lines.push(`## ${t('report.section.breakdown')}`)
  lines.push('')
  lines.push(`| ${t('breakdown.title')} | ${t('axis.tokens')} |`)
  lines.push('| --- | --- |')
  if (model.composition.available) {
    for (const segment of model.composition.segments) {
      lines.push(row(t(segment.labelKey), formatTokens(segment.tokens, t)))
    }
    lines.push(row(t('breakdown.total'), formatTokens(model.composition.total, t)))
  } else {
    lines.push(row(t('breakdown.title'), t('report.noData')))
  }
  lines.push('')

  lines.push(`## ${t('report.section.headroom')}`)
  lines.push('')
  lines.push(`| ${t('headroom.title')} | |`)
  lines.push('| --- | --- |')
  if (model.headroom.available) {
    lines.push(row(t('headroom.remainingTokens'), formatTokens(model.headroom.remainingTokens, t)))
    lines.push(row(t('headroom.turnsLeft'), model.headroom.turnsLeft === undefined
      ? t('headroom.turnsUnknown')
      : t('headroom.turnsValue', { count: model.headroom.turnsLeft })))
    lines.push(row(t('headroom.perTurn', { window: model.headroom.window, rate: '' }).trim(), formatTokens(model.headroom.rate, t)))
  } else {
    lines.push(row(t('headroom.title'), t('report.noData')))
  }
  lines.push('')

  lines.push(`## ${t('report.section.cache')}`)
  lines.push('')
  lines.push(`| ${t('cache.title')} | ${t('axis.tokens')} |`)
  lines.push('| --- | --- |')
  if (model.cache.available) {
    lines.push(row(t('cache.uncached'), formatTokens(model.cache.uncachedInputTokens, t)))
    lines.push(row(t('cache.read'), formatTokens(model.cache.cacheReadTokens, t)))
    lines.push(row(t('cache.write'), formatTokens(model.cache.cacheWriteTokens, t)))
    lines.push(row(t('cache.output'), formatTokens(model.cache.outputTokens, t)))
    lines.push(row(t('cache.hitRate'), t('cache.hitRateValue', { percent: model.cache.hitRate })))
  } else {
    lines.push(row(t('cache.title'), t('cache.noData')))
  }
  lines.push('')

  lines.push(`## ${t('report.section.provenance')}`)
  lines.push('')
  lines.push(`- ${t(model.provenance.key)}`)
  lines.push(`- ${t('provenance.note')}`)
  lines.push('')

  lines.push(`## ${t('report.section.timeline')}`)
  lines.push('')
  if (model.timeline.available) {
    if (model.timeline.coverage === 'observed-since-plugin-load') {
      lines.push(`> ${t('timeline.partial')}`)
      lines.push('')
    }
    lines.push(`| # | ${t('axis.tokens')} | Δ | ${t('axis.step')} |`)
    lines.push('| --- | --- | --- | --- |')
    for (const point of model.timeline.samples) {
      const where = point.turn !== undefined
        ? t('timeline.step', { turn: point.turn, step: point.step ?? '?' })
        : t('timeline.boundary')
      lines.push(`| ${point.index + 1} | ${formatTokens(point.totalTokens, t)} | ${point.deltaTokens >= 0 ? '+' : ''}${formatTokens(point.deltaTokens, t)} | ${where} |`)
    }
  } else {
    lines.push(t('timeline.empty'))
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Build a JSON report: the machine-readable twin of the Markdown one.
 *
 * @param model - the view model from `buildViewModel`.
 * @param meta - `{ sessionId, generatedAt }`.
 * @returns the JSON document text.
 */
function toJson(model, meta) {
  return `${JSON.stringify({
    schema: 'dsh-context-lens/report@1',
    generatedAt: meta.generatedAt,
    sessionId: meta.sessionId ?? null,
    occupancy: model.occupancy,
    composition: model.composition,
    headroom: model.headroom,
    cache: model.cache,
    provenance: model.provenance,
    timeline: {
      available: model.timeline.available,
      coverage: model.timeline.coverage,
      truncated: model.timeline.truncated,
      dropped: model.timeline.dropped,
      sampleCount: model.timeline.samples.length,
      peak: model.timeline.peak,
      reclaimedTotal: model.timeline.reclaimedTotal,
      samples: model.timeline.samples,
    },
  }, null, 2)}\n`
}

/**
 * A filesystem-safe filename for one export.
 * @param sessionId - the session id.
 * @param extension - `md` or `json`.
 * @param generatedAt - ISO timestamp.
 * @returns the filename.
 */
function reportFilename(sessionId, extension, generatedAt) {
  // Keep only [A-Za-z0-9_-]: dots are removed too, so a session id can never
  // contribute a `..` segment to the suggested download name.
  const safe = String(sessionId ?? 'session').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40)
  const stamp = String(generatedAt).replace(/[^a-zA-Z0-9_-]/g, '-')
  return `context-lens-${safe}-${stamp}.${extension}`
}

exports.toMarkdown = toMarkdown
exports.toJson = toJson
exports.reportFilename = reportFilename

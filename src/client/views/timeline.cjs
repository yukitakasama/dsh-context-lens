/**
 * The context × trajectory timeline section.
 *
 * This is the plugin's core increment: the official Trajectory view answers
 * "what happened", the official ContextMeter answers "how full is it now", and
 * neither answers "how did it get that full". The samples come from the host
 * half, which observes the token meter at step and compaction boundaries.
 *
 * Rendering is a plain sparkline rather than a charting dependency: the data
 * is a small ordered series and the visual grammar is fixed, so a dependency
 * would cost bundle size and a foreign style system for nothing.
 *
 * @module dsh-context-lens/client/views/timeline
 */

const React = require('react')
const { createElement: h } = React
const { Section } = require('./parts.cjs')
const { formatTokens } = require('../model/index.cjs')

/** The sample event that marks a compaction checkpoint. */
const COMPACTION_PREFIX = 'compaction/'

/**
 * Describe where a sample sits in the session.
 * @param point - one timeline point.
 * @param t - the locale seat.
 * @returns a human-readable position label.
 */
function whereOf(point, t) {
  if (point.turn !== undefined && point.step !== undefined) {
    return t('timeline.step', { turn: point.turn, step: point.step })
  }
  return point.eventType.startsWith(COMPACTION_PREFIX) ? t('timeline.reclaim', {
    tokens: formatTokens(point.reclaimed, t),
  }) : t('timeline.boundary')
}

/**
 * The timeline section: sparkline, axis, and the sample ledger.
 * @param props - `{ model, t }`.
 * @returns the section element.
 */
function TimelineSection({ model, t }) {
  const { timeline } = model

  if (!timeline.available) {
    // Distinguish "the host cannot sample at all" from "nothing sampled yet":
    // they need different fixes, so they must not share a message.
    const message = timeline.unavailable === true
      ? t('timeline.unavailable')
      : t('timeline.empty')
    return h(Section, { title: t('timeline.title') }, h('p', { className: 'cl_empty' }, message))
  }

  const peak = timeline.peak > 0 ? timeline.peak : 1
  const bars = timeline.samples.map(point => h('div', {
    key: point.index,
    className: 'cl_sparkBar',
    'data-reclaim': point.reclaimed > 0 ? 'true' : undefined,
    style: { height: `${Math.max(2, point.totalTokens / peak * 100)}%` },
    title: `${whereOf(point, t)} · ${formatTokens(point.totalTokens, t)}`,
  }))

  const first = timeline.samples[0]
  const last = timeline.samples[timeline.samples.length - 1]

  return h(Section, {
    title: t('timeline.title'),
    note: timeline.coverage === 'observed-since-plugin-load' ? t('timeline.partial') : undefined,
  }, [
    h('div', { key: 'spark', className: 'cl_spark', role: 'img', 'aria-label': t('timeline.subtitle') }, bars),
    h('div', { key: 'axis', className: 'cl_axisRow' }, [
      h('span', { key: 'from' }, formatTokens(first.totalTokens, t)),
      h('span', { key: 'unit' }, t('axis.tokens')),
      h('span', { key: 'to' }, formatTokens(last.totalTokens, t)),
    ]),
    timeline.truncated
      ? h('p', { key: 'trunc', className: 'cl_note' }, t('timeline.truncated', {
          max: formatTokens(timeline.maxSamples, t),
          dropped: timeline.dropped,
        }))
      : null,
    h('div', { key: 'list', className: 'cl_sampleList' },
      timeline.samples.slice().reverse().map(point => h('div', {
        key: point.index,
        className: 'cl_sampleRow',
      }, [
        h('span', { key: 'w', className: 'cl_sampleWhere' }, whereOf(point, t)),
        h('span', { key: 't', className: 'cl_sampleTotal' }, formatTokens(point.totalTokens, t)),
        h('span', {
          key: 'd',
          className: 'cl_sampleDelta',
          'data-kind': point.kind,
        }, `${point.deltaTokens >= 0 ? '+' : '−'}${formatTokens(Math.abs(point.deltaTokens), t)}`),
      ]))),
  ])
}

exports.TimelineSection = TimelineSection
exports.whereOf = whereOf

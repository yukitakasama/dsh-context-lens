/**
 * Small presentational pieces shared by the panel.
 *
 * These are deliberately plain functions returning React elements rather than
 * a component library: the plugin must not import another feature package's
 * values, and the baseline `ui-primitives` set does not cover charts or
 * structured key/value rows.
 *
 * @module dsh-context-lens/client/views/parts
 */

const React = require('react')
const { createElement: h } = React

/**
 * The occupancy ring, matching the official meter's geometry (14px viewBox,
 * 2px stroke) so the two read as one family.
 *
 * @param props - `{ percent, overflow, size }`.
 * @returns the ring element.
 */
function OccupancyRing({ percent, overflow, size = 64 }) {
  const radius = 26
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const nodes = [
    h('circle', {
      key: 'track',
      className: 'cl_ringTrack',
      cx: 32,
      cy: 32,
      r: radius,
    }),
    h('circle', {
      key: 'fill',
      className: 'cl_ringFill',
      cx: 32,
      cy: 32,
      r: radius,
      'data-overflow': overflow ? 'true' : undefined,
      strokeDasharray: `${circumference * clamped / 100} ${circumference}`,
      transform: 'rotate(-90 32 32)',
    }),
    h('text', { key: 'value', className: 'cl_ringValue', x: 32, y: 32 }, `${Math.round(percent)}%`),
  ]
  return h('svg', {
    className: 'cl_ring',
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    role: 'img',
    'aria-hidden': 'true',
  }, nodes)
}

/**
 * A label/value row.
 * @param props - `{ label, value, className }`.
 * @returns the row element.
 */
function KeyValueRow({ label, value, className }) {
  return h('div', { className: className ?? 'cl_kvRow' }, [
    h('span', { key: 'label', className: 'cl_kvLabel' }, label),
    h('span', { key: 'value', className: 'cl_kvValue' }, value),
  ])
}

/**
 * A section with a heading and children.
 * @param props - `{ title, children, note }`.
 * @returns the section element.
 */
function Section({ title, children, note }) {
  return h('section', { className: 'cl_section' }, [
    h('h3', { key: 'title', className: 'cl_sectionTitle' }, title),
    h('div', { key: 'body' }, children),
    note === undefined ? null : h('p', { key: 'note', className: 'cl_note' }, note),
  ])
}

/**
 * A pill-shaped badge.
 * @param props - `{ tone, children }`.
 * @returns the badge element.
 */
function Badge({ tone, children }) {
  return h('span', { className: 'cl_badge', 'data-tone': tone }, children)
}

/**
 * A horizontal icon button.
 * @param props - `{ label, onClick, children }`.
 * @returns the button element.
 */
function IconButton({ label, onClick, children }) {
  return h('button', {
    type: 'button',
    className: 'cl_iconButton',
    'aria-label': label,
    title: label,
    onClick,
  }, children)
}

/** A simple download glyph. */
function DownloadGlyph() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true' }, [
    h('path', {
      key: 'p',
      d: 'M8 1v8m0 0 3-3m-3 3-3-3M2 12v1.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V12',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  ])
}

/** A simple refresh glyph. */
function RefreshGlyph() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true' }, [
    h('path', {
      key: 'p',
      d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  ])
}

/** A simple close glyph. */
function CloseGlyph() {
  return h('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true' }, [
    h('path', {
      key: 'p',
      d: 'M4 4l8 8M12 4l-8 8',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinecap: 'round',
    }),
  ])
}

exports.OccupancyRing = OccupancyRing
exports.KeyValueRow = KeyValueRow
exports.Section = Section
exports.Badge = Badge
exports.IconButton = IconButton
exports.DownloadGlyph = DownloadGlyph
exports.RefreshGlyph = RefreshGlyph
exports.CloseGlyph = CloseGlyph

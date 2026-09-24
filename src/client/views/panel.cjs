/**
 * The Context Lens panel: a sidebar footer action opening a floating panel.
 *
 * Structure follows the four questions the plugin answers: how full is the
 * context, what is it made of, how much room is left, and where did the
 * occupancy figure come from. A fifth section adds the context × trajectory
 * timeline.
 *
 * Accessibility and dismissal mirror the official `ContextMeter`: the trigger
 * is a real button with `aria-expanded` / `aria-haspopup`, Escape closes, an
 * outside pointer closes, and focus returns to the trigger. Every string comes
 * from the locale seat.
 *
 * @module dsh-context-lens/client/views/panel
 */

const React = require('react')
const { createElement: h, useState, useRef, useEffect, useCallback } = React
const {
  OccupancyRing, KeyValueRow, Section, Badge, IconButton,
  DownloadGlyph, RefreshGlyph, CloseGlyph,
} = require('./parts.cjs')
const { TimelineSection } = require('./timeline.cjs')
const { formatTokens } = require('../model/index.cjs')
const { toMarkdown, toJson, reportFilename } = require('../model/report.cjs')

/**
 * Offer one exported report as a download.
 *
 * The whole path is local: the document is built in memory and handed to an
 * object URL, so nothing leaves the machine and the export works offline.
 *
 * The revoke is deferred by one task on purpose. `anchor.click()` only STARTS
 * the navigation; the browser reads the blob on a later task, so revoking in
 * the same synchronous block can cancel the download before it begins — and
 * because nothing throws, the failure is silent. Deferring keeps the URL
 * resolvable until the browser has taken the data.
 *
 * @param text - the document text.
 * @param filename - the suggested filename.
 */
function download(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The occupancy + composition + headroom body.
 * @param props - `{ model, t }`.
 * @returns the body elements.
 */
function PanelBody({ model, t }) {
  if (!model.hasSession) {
    return h('p', { className: 'cl_empty' }, t('panel.noSession'))
  }

  const { occupancy, composition, cache, headroom, provenance } = model

  return h(React.Fragment, null, [
    // --- occupancy + provenance -------------------------------------------
    h(Section, { key: 'occupancy', title: t('occupancy.title') }, [
      occupancy.available
        ? h('div', { key: 'ring', className: 'cl_ringRow' }, [
            h(OccupancyRing, {
              key: 'ring',
              percent: occupancy.percent,
              overflow: occupancy.overflowed,
            }),
            h('div', { key: 'stats', className: 'cl_ringStats' }, [
              h('div', { key: 'figure', className: 'cl_figure' }, [
                h('span', { key: 'v', className: 'cl_figureValue' }, formatTokens(occupancy.usedTokens, t)),
                h('span', { key: 'u', className: 'cl_figureUnit' },
                  t('occupancy.ofWindow', {
                    used: `~${formatTokens(occupancy.usedTokens, t)}`,
                    window: formatTokens(occupancy.contextWindow, t),
                  })),
              ]),
              h('div', { key: 'rows', className: 'cl_kvRows' }, [
                h(KeyValueRow, {
                  key: 'remaining',
                  label: t('occupancy.remaining'),
                  value: formatTokens(occupancy.remainingTokens, t),
                }),
                h('div', { key: 'prov', className: 'cl_badges' }, [
                  h(Badge, {
                    key: 'p',
                    tone: provenance.kind === 'usage' ? 'reported' : 'estimated',
                  }, t(provenance.key)),
                  occupancy.overflowed
                    ? h(Badge, { key: 'o', tone: 'warn' }, t('headroom.overflow'))
                    : null,
                ]),
              ]),
            ]),
          ])
        : h('p', { key: 'none', className: 'cl_empty' }, t('panel.noPressure')),
    ]),

    // --- composition -------------------------------------------------------
    h(Section, { key: 'composition', title: t('breakdown.title') },
      composition.available
        ? [
            h('div', { key: 'bar', className: 'cl_bar' },
              composition.segments
                .filter(segment => segment.share > 0)
                .map(segment => h('div', {
                  key: segment.key,
                  className: `cl_segment cl_color${segment.key.charAt(0).toUpperCase()}${segment.key.slice(1)}`,
                  style: { width: `${segment.share * 100}%` },
                }))),
            h('dl', { key: 'legend', className: 'cl_legend' },
              composition.segments.map(segment => h('div', {
                key: segment.key,
                className: 'cl_legendRow',
              }, [
                h('dt', { key: 'l', className: 'cl_legendLabel' }, [
                  h('span', {
                    key: 's',
                    className: `cl_swatch cl_color${segment.key.charAt(0).toUpperCase()}${segment.key.slice(1)}`,
                    'aria-hidden': 'true',
                  }),
                  t(segment.labelKey),
                ]),
                h('dd', { key: 'v', className: 'cl_legendValue' }, `~${formatTokens(segment.tokens, t)}`),
              ]))),
          ]
        : h('p', { key: 'empty', className: 'cl_empty' }, t('breakdown.empty'))),

    // --- headroom ----------------------------------------------------------
    h(Section, { key: 'headroom', title: t('headroom.title') },
      headroom.available
        ? h('div', { className: 'cl_kvRows' }, [
            h(KeyValueRow, {
              key: 'remaining',
              label: t('headroom.remainingTokens'),
              value: formatTokens(headroom.remainingTokens, t),
            }),
            h(KeyValueRow, {
              key: 'turns',
              label: t('headroom.turnsLeft'),
              value: headroom.turnsLeft === undefined
                ? t('headroom.turnsUnknown')
                : t('headroom.turnsValue', { count: headroom.turnsLeft }),
            }),
            headroom.rate > 0
              ? h(KeyValueRow, {
                  key: 'rate',
                  label: t('headroom.perTurn', {
                    window: headroom.window,
                    rate: formatTokens(headroom.rate, t),
                  }),
                  value: '',
                })
              : null,
            h('p', {
              key: 'verdict',
              className: 'cl_note',
            }, headroom.overflowed ? t('headroom.overflow') : t('headroom.noOverflow')),
          ])
        : h('p', { key: 'empty', className: 'cl_empty' }, t('panel.noPressure'))),

    // --- cache economics ---------------------------------------------------
    h(Section, { key: 'cache', title: t('cache.title') },
      cache.available
        ? h('div', { className: 'cl_kvRows' }, [
            h(KeyValueRow, { key: 'uncached', label: t('cache.uncached'), value: formatTokens(cache.uncachedInputTokens, t) }),
            h(KeyValueRow, { key: 'read', label: t('cache.read'), value: formatTokens(cache.cacheReadTokens, t) }),
            h(KeyValueRow, { key: 'write', label: t('cache.write'), value: formatTokens(cache.cacheWriteTokens, t) }),
            h(KeyValueRow, { key: 'output', label: t('cache.output'), value: formatTokens(cache.outputTokens, t) }),
            h(KeyValueRow, {
              key: 'hit',
              label: t('cache.hitRate'),
              value: t('cache.hitRateValue', { percent: cache.hitRate }),
            }),
          ])
        : h('p', { key: 'empty', className: 'cl_empty' }, t('cache.noData'))),

    // --- provenance note ---------------------------------------------------
    h(Section, { key: 'provenance', title: t('provenance.title') },
      h('p', { className: 'cl_note' }, t('provenance.note'))),

    // --- timeline ----------------------------------------------------------
    h(TimelineSection, { key: 'timeline', model, t }),
  ])
}

/**
 * The registered footer action: trigger plus floating panel.
 *
 * @param props - slot props; `useContextLens` is bound from the inject `hooks`
 *   compartment by the renderer, and `t` comes from the declared locale
 *   namespace. `wide` is the sidebar owner share.
 * @returns the trigger and, when open, the panel.
 */
function ContextLensPanel(props) {
  const { t, wide, useContextLens } = props
  const snapshot = useContextLens(snapshotValue => snapshotValue)
  const model = snapshot.model
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState(undefined)
  const rootRef = useRef(null)

  const close = useCallback(() => {
    setOpen(false)
    setMenuOpen(false)
  }, [])

  // Escape closes; an outside pointer closes. One listener pair while open,
  // matching the official meter's dismissal behavior.
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = event => {
      if (event.key === 'Escape') close()
    }
    const onPointerDown = event => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  // Clear the transient export notice.
  useEffect(() => {
    if (notice === undefined) return undefined
    const timer = setTimeout(() => setNotice(undefined), 1600)
    return () => clearTimeout(timer)
  }, [notice])

  const exportReport = useCallback(format => {
    setMenuOpen(false)
    const meta = {
      sessionId: snapshot.sessionId,
      generatedAt: new Date().toISOString(),
    }
    try {
      if (format === 'json') {
        download(toJson(model, meta), reportFilename(meta.sessionId, 'json', meta.generatedAt))
      } else {
        download(toMarkdown(model, t, meta), reportFilename(meta.sessionId, 'md', meta.generatedAt))
      }
      setNotice(t('action.exported'))
    } catch {
      setNotice(t('action.exportFailed'))
    }
  }, [model, snapshot.sessionId, t])

  const refresh = useCallback(() => {
    props.refresh?.()
  }, [props])

  const summary = snapshot.hasSession
    ? t('action.summary', { percent: model.occupancy.available ? model.occupancy.percent : '—' })
    : t('action.noSession')

  return h('div', {
    ref: rootRef,
    className: wide === false ? 'cl_layer cl_rail' : 'cl_layer',
  }, [
    h('button', {
      key: 'trigger',
      type: 'button',
      className: 'cl_trigger',
      'data-active': open ? 'true' : undefined,
      'aria-label': t('action.title'),
      'aria-haspopup': 'dialog',
      'aria-expanded': open,
      title: t('action.title'),
      onClick: () => setOpen(value => !value),
    }, [
      h('svg', { key: 'ring', width: 16, height: 16, viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [
        h('circle', { key: 't', className: 'cl_ringTrack', cx: 32, cy: 32, r: 26, strokeWidth: 6 }),
        h('circle', {
          key: 'f',
          className: 'cl_ringFill',
          cx: 32,
          cy: 32,
          r: 26,
          strokeWidth: 6,
          'data-overflow': model.occupancy.available && model.occupancy.overflowed ? 'true' : undefined,
          strokeDasharray: `${163.4 * (model.occupancy.available ? model.occupancy.percent : 0) / 100} 163.4`,
          transform: 'rotate(-90 32 32)',
        }),
      ]),
      h('span', { key: 'label', className: 'cl_triggerLabel' }, t('action.badge')),
      h('span', { key: 'value', className: 'cl_triggerValue' }, summary),
    ]),

    open ? h('div', {
      key: 'panel',
      className: 'cl_panel',
      role: 'dialog',
      'aria-label': t('panel.title'),
    }, [
      h('header', { key: 'header', className: 'cl_header' }, [
        h('div', { key: 'text', className: 'cl_headerText' }, [
          h('h2', { key: 'title', className: 'cl_title' }, t('panel.title')),
          h('span', { key: 'sub', className: 'cl_subtitle' }, t('panel.subtitle')),
        ]),
        h('div', { key: 'actions', className: 'cl_headerActions' }, [
          h(IconButton, { key: 'refresh', label: t('action.refresh'), onClick: refresh }, h(RefreshGlyph)),
          h(IconButton, {
            key: 'export',
            label: t('action.export'),
            onClick: () => setMenuOpen(value => !value),
          }, h(DownloadGlyph)),
          h(IconButton, { key: 'close', label: t('action.close'), onClick: close }, h(CloseGlyph)),
        ]),
        menuOpen ? h('div', { key: 'menu', className: 'cl_menu', role: 'menu' }, [
          h('button', {
            key: 'md',
            type: 'button',
            role: 'menuitem',
            className: 'cl_menuItem',
            onClick: () => exportReport('markdown'),
          }, t('action.exportMarkdown')),
          h('button', {
            key: 'json',
            type: 'button',
            role: 'menuitem',
            className: 'cl_menuItem',
            onClick: () => exportReport('json'),
          }, t('action.exportJson')),
        ]) : null,
        notice === undefined ? null : h('span', { key: 'notice', className: 'cl_note' }, notice),
      ]),
      h('div', { key: 'body', className: 'cl_body' },
        h(PanelBody, { model, t })),
      snapshot.timelineState === 'loading'
        ? h('p', { key: 'loading', className: 'cl_note' }, t('timeline.loading'))
        : null,
    ]) : null,
  ])
}

exports.ContextLensPanel = ContextLensPanel
exports.PanelBody = PanelBody
exports.download = download

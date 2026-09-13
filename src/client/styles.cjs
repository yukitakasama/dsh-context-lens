/**
 * Styles for dsh-context-lens.
 *
 * Two rules from the styling spec drive the shape of this file:
 *
 *   * Only `--dsw-alias-*` semantic tokens, never literal colors — the theme
 *     owns light/dark, so a hardcoded hex would break one of them.
 *   * A popover is an elevated surface: `border: 0` plus
 *     `box-shadow: var(--dsw-elevation-panel)`. Pairing a
 *     `--dsw-alias-border-*` border with an elevation shadow is explicitly
 *     rejected by the theme spec, because the hairline stroke is already the
 *     shadow's first layer.
 *
 * The sheet is injected once, from `apply`, tagged so it can be identified (and
 * removed) if the plugin is ever loaded twice in one document.
 *
 * @module dsh-context-lens/client/styles
 */

/** The package identity used for the style tags. */
const PLUGIN_NAME = 'dsh-context-lens'

/** The style tag id, in the preset's `<package>/<file>` convention. */
const TAG_ID = `${PLUGIN_NAME}/styles.css`

/** The stylesheet text. Class names are prefixed `cl_` (context lens). */
const CSS = `
.cl_layer{display:flex;align-items:center;width:100%;margin:8px 0 0;position:relative}
.cl_layer.cl_rail{width:36px;height:36px;margin:0}
.cl_trigger{display:inline-flex;align-items:center;gap:8px;box-sizing:border-box;width:100%;height:36px;padding:0 8px;border:none;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px;cursor:pointer;overflow:hidden;text-align:left}
.cl_trigger:hover{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-interactive-bg-hover))}
.cl_trigger[data-active]{background:var(--dsw-alias-interactive-bg-hover)}
.cl_trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.cl_layer.cl_rail .cl_trigger{width:36px;height:36px;justify-content:center;padding:0;border-radius:50%}
.cl_triggerLabel{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl_triggerValue{margin-left:auto;flex:none;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.cl_layer.cl_rail .cl_triggerLabel,.cl_layer.cl_rail .cl_triggerValue{display:none}

.cl_panel{position:fixed;bottom:128px;left:12px;z-index:30;display:flex;flex-direction:column;box-sizing:border-box;width:420px;max-width:calc(100vw - 24px);max-height:74vh;border:0;border-radius:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));box-shadow:var(--dsw-elevation-panel);overflow:hidden}
.cl_header{display:flex;flex:none;align-items:center;justify-content:space-between;gap:8px;box-sizing:border-box;min-height:44px;padding:10px 12px;border-bottom:0.5px solid var(--dsw-alias-border-l2)}
.cl_headerText{display:flex;flex-direction:column;gap:1px;min-width:0}
.cl_title{margin:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500;line-height:18px}
.cl_subtitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:15px}
.cl_headerActions{display:flex;flex:none;align-items:center;gap:2px}
.cl_iconButton{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}
.cl_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.cl_iconButton:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.cl_body{flex:1;min-height:0;padding:12px 14px 14px;overflow-y:auto;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}
.cl_section{margin-top:14px}
.cl_section:first-child{margin-top:0}
.cl_sectionTitle{margin:0 0 8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;text-transform:none}
.cl_note{margin:6px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}

.cl_ringRow{display:flex;align-items:center;gap:14px}
.cl_ring{flex:none}
.cl_ringTrack{fill:none;stroke:var(--dsw-alias-bg-layer-3,var(--dsw-alias-border-l1));stroke-width:2}
.cl_ringFill{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:2;stroke-linecap:round;transition:stroke-dasharray 200ms ease}
.cl_ringFill[data-overflow]{stroke:var(--dsw-alias-state-error-primary)}
.cl_ringValue{fill:var(--dsw-alias-label-primary);font-size:11px;font-weight:600;text-anchor:middle;dominant-baseline:central;font-variant-numeric:tabular-nums}
.cl_ringStats{display:flex;flex-direction:column;gap:4px;min-width:0}
.cl_figure{display:flex;align-items:baseline;gap:6px}
.cl_figureValue{color:var(--dsw-alias-label-primary);font-size:20px;font-weight:600;line-height:26px;font-variant-numeric:tabular-nums}
.cl_figureUnit{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.cl_kvRows{display:flex;flex-direction:column;gap:3px;width:100%}
.cl_kvRow{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px;line-height:18px}
.cl_kvLabel{color:var(--dsw-alias-label-secondary);min-width:0}
.cl_kvValue{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;flex:none}

.cl_bar{display:flex;width:100%;height:8px;margin:2px 0 10px;border-radius:4px;background:var(--dsw-alias-bg-layer-3,var(--dsw-alias-border-l1));overflow:hidden}
.cl_segment{min-width:1px;height:100%}
.cl_colorSystem{background:var(--dsw-alias-brand-primary)}
.cl_colorTools{background:var(--dsw-alias-state-business-primary)}
.cl_colorMessages{background:var(--dsw-alias-state-success-primary)}
.cl_legend{display:flex;flex-direction:column;gap:4px;margin:0}
.cl_legendRow{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;line-height:18px}
.cl_legendLabel{display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary);min-width:0}
.cl_swatch{flex:none;width:8px;height:8px;border-radius:2px}
.cl_legendValue{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}

.cl_badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.cl_badge{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:999px;font-size:11px;line-height:16px;background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-secondary)}
.cl_badge[data-tone=reported]{color:var(--dsw-alias-state-success-primary)}
.cl_badge[data-tone=estimated]{color:var(--dsw-alias-state-warn-primary)}
.cl_badge[data-tone=warn]{color:var(--dsw-alias-state-error-primary)}

.cl_timeline{display:flex;flex-direction:column;gap:6px}
.cl_spark{display:flex;align-items:flex-end;gap:1px;width:100%;height:64px;padding:0;margin:0;border-bottom:0.5px solid var(--dsw-alias-border-l2)}
.cl_sparkBar{flex:1;min-width:1px;background:var(--dsw-alias-brand-primary);border-radius:1px 1px 0 0;opacity:0.85}
.cl_sparkBar[data-reclaim]{background:var(--dsw-alias-state-success-primary)}
.cl_axisRow{display:flex;justify-content:space-between;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.cl_sampleList{display:flex;flex-direction:column;gap:2px;margin:8px 0 0;max-height:180px;overflow-y:auto}
.cl_sampleRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:baseline;font-size:12px;line-height:18px}
.cl_sampleWhere{color:var(--dsw-alias-label-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl_sampleTotal{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.cl_sampleDelta{font-variant-numeric:tabular-nums;min-width:56px;text-align:right}
.cl_sampleDelta[data-kind=grow]{color:var(--dsw-alias-state-warn-primary)}
.cl_sampleDelta[data-kind=reclaim]{color:var(--dsw-alias-state-success-primary)}
.cl_sampleDelta[data-kind=flat]{color:var(--dsw-alias-label-tertiary)}

.cl_empty{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}
.cl_error{margin:0;padding:7px 8px;border-radius:8px;background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}

.cl_menu{position:absolute;right:12px;top:44px;z-index:31;display:flex;flex-direction:column;min-width:170px;padding:4px;border:0;border-radius:10px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-base));box-shadow:var(--dsw-elevation-panel)}
.cl_menuItem{display:block;width:100%;padding:6px 9px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer}
.cl_menuItem:hover{background:var(--dsw-alias-interactive-bg-hover)}
.cl_menuItem:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}

@media (prefers-reduced-motion: reduce){
.cl_ringFill{transition:none}
}
`

/**
 * Inject the stylesheet once per document.
 *
 * Idempotent: a second call is a no-op, so an HMR re-materialization cannot
 * stack duplicate sheets. The effect disposer removes the tag, which keeps
 * unload clean.
 *
 * @returns a disposer removing the sheet, or a no-op when it was already present.
 */
function injectStyles() {
  if (typeof document === 'undefined') return () => {}
  // The official tsdown client preset tags injected sheets with
  // data-plugin / data-plugin-css so the module system can inventory and
  // HMR-remove them (packages/client/tsdown.client.ts, styleInjectionModule).
  // A hand-written bundle reproduces that convention rather than inventing one.
  const selector = `style[data-plugin-css=${JSON.stringify(TAG_ID)}]`
  if (document.querySelector(selector) !== null) return () => {}
  const style = document.createElement('style')
  style.dataset.plugin = PLUGIN_NAME
  style.dataset.pluginCss = TAG_ID
  style.textContent = CSS
  document.head.appendChild(style)
  return () => {
    document.querySelector(selector)?.remove()
  }
}

exports.PLUGIN_NAME = PLUGIN_NAME
exports.TAG_ID = TAG_ID
exports.CSS = CSS
exports.injectStyles = injectStyles

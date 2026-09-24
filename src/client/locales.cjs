/**
 * Typed locale dictionaries for dsh-context-lens.
 *
 * Every product-visible string — labels, headings, aria names, tooltips and
 * unit formats — lives here and reaches components through the slot `t` seat.
 * The zh key set is the source of truth; `en` must carry exactly the same keys.
 * No component may contain bare copy.
 *
 * @module dsh-context-lens/client/locales
 */

/** The locale namespace this plugin owns. */
const NS = 'contextLens'

/** Chinese dictionary (the source of truth for the key set). */
const zh = {
  'action.title': '上下文透视镜',
  'action.badge': '上下文',
  'action.summary': '已用 {percent}%',
  'action.noSession': '无活动会话',

  'panel.title': '上下文透视镜',
  'panel.subtitle': '本会话的上下文构成与余量',
  'panel.loading': '正在读取上下文…',
  'panel.noSession': '当前没有活动会话，暂无可展示的上下文数据。',
  'panel.noPressure': '供应商尚未上报本会话的用量，占用率暂不可用。',

  'occupancy.title': '占用率',
  'occupancy.used': '已用',
  'occupancy.remaining': '剩余',
  'occupancy.window': '窗口',
  'occupancy.ofWindow': '{used} / {window}',

  'breakdown.title': '构成',
  'breakdown.system': '系统提示',
  'breakdown.tools': '工具 schema',
  'breakdown.messages': '消息',
  'breakdown.total': '合计',
  'breakdown.empty': '暂无构成数据。',

  'headroom.title': '余量规划',
  'headroom.remainingTokens': '剩余 token',
  'headroom.turnsLeft': '预计可支撑',
  'headroom.turnsValue': '约 {count} 轮',
  'headroom.turnsUnknown': '数据不足',
  'headroom.perTurn': '近 {window} 步平均 +{rate} / 步',
  'headroom.nextRequest': '下次请求预测',
  'headroom.overflow': '按当前增速，下一轮可能超出窗口。',
  'headroom.noOverflow': '按当前增速，窗口余量充足。',

  'provenance.title': '口径',
  'provenance.reported': '供应商实报',
  'provenance.estimated': '启发式估算',
  'provenance.none': '无锚点',
  'provenance.note': '估算值对 CJK 文本与 JSON schema 系统性偏低，占用率始终以供应商实报为锚。',

  'cache.title': '缓存经济性',
  'cache.read': '缓存读',
  'cache.write': '缓存写',
  'cache.uncached': '未缓存输入',
  'cache.output': '输出',
  'cache.hitRate': '缓存命中率',
  'cache.hitRateValue': '{percent}%',
  'cache.noData': '本会话尚无用量记录。',

  'timeline.title': '上下文 × 轨迹',
  'timeline.subtitle': '每一步上下文的增长与回收',
  'timeline.empty': '尚未采集到轨迹采样点。',
  'timeline.partial': '采样自插件加载后开始，此前的历史未覆盖。',
  'timeline.truncated': '采样已截断（上限 {max} 条，丢弃 {dropped} 条）。',
  'timeline.reclaim': '压缩回收 {tokens}',
  'timeline.step': '第 {turn} 轮 · 第 {step} 步',
  'timeline.boundary': '边界事件',
  'timeline.unavailable': '宿主 token 计量服务不可用，轨迹时间线无法采集。',
  'timeline.loading': '正在读取轨迹…',

  'axis.tokens': 'token',
  'axis.step': '步',

  'action.refresh': '刷新',
  'action.close': '关闭',
  'action.export': '导出报告',
  'action.exportMarkdown': '导出为 Markdown',
  'action.exportJson': '导出为 JSON',
  'action.exported': '报告已保存',
  'action.exportFailed': '导出失败',

  'report.title': '上下文透视镜报告',
  'report.generatedAt': '生成时间',
  'report.session': '会话',
  'report.section.occupancy': '占用率',
  'report.section.breakdown': '构成',
  'report.section.headroom': '余量规划',
  'report.section.cache': '缓存经济性',
  'report.section.provenance': '口径说明',
  'report.section.timeline': '轨迹采样',
  'report.noData': '（无数据）',

  'settings.title': '上下文透视镜设置',
  'settings.hint': '这些取值由宿主半在加载期校验；非法值会让插件拒绝启动，而不是静默忽略。',
  'settings.unavailable': '当前组合没有设置服务，可在 profile 的 cordis 配置中直接填写这些取值。',
  'settings.unset': '默认',
  'settings.sampleStride': '采样步长（revision）',
  'settings.sampleStride.hint': '每隔多少个日志 revision 采样一次。',
  'settings.maxSamples': '采样点上限',
  'settings.maxSamples.hint': '超出后丢弃最旧采样并上报截断。',
  'settings.maxNodesPerSample': '单点节点回显上限',
  'settings.maxNodesPerSample.hint': '每个采样点最多回显多少个 surface 节点。',
  'settings.cacheTtlMs': '结果缓存时长（毫秒）',
  'settings.cacheTtlMs.hint': '同一会话在此时间内的重复读取复用上次结果。',
  'settings.paceWindow': '增速估算窗口（步）',
  'settings.paceWindow.hint': '估算可支撑轮数时平均最近多少步。',
  'meter.title': '上下文余量',
  'meter.remaining': '余 {value}',
  'meter.unknown': '—',


  'unit.thousand': '{value}K',
  'unit.million': '{value}M',
}

/** English dictionary; keys must mirror `zh` exactly. */
const en = {
  'action.title': 'Context Lens',
  'action.badge': 'Context',
  'action.summary': '{percent}% used',
  'action.noSession': 'No active session',

  'panel.title': 'Context Lens',
  'panel.subtitle': 'This session\u2019s context composition and headroom',
  'panel.loading': 'Reading context…',
  'panel.noSession': 'No active session, so there is no context to show.',
  'panel.noPressure': 'The provider has not reported usage for this session yet, so occupancy is unavailable.',

  'occupancy.title': 'Occupancy',
  'occupancy.used': 'Used',
  'occupancy.remaining': 'Remaining',
  'occupancy.window': 'Window',
  'occupancy.ofWindow': '{used} / {window}',

  'breakdown.title': 'Composition',
  'breakdown.system': 'System prompt',
  'breakdown.tools': 'Tool schemas',
  'breakdown.messages': 'Messages',
  'breakdown.total': 'Total',
  'breakdown.empty': 'No composition data yet.',

  'headroom.title': 'Headroom',
  'headroom.remainingTokens': 'Remaining tokens',
  'headroom.turnsLeft': 'Estimated capacity',
  'headroom.turnsValue': 'about {count} turns',
  'headroom.turnsUnknown': 'Not enough data',
  'headroom.perTurn': 'Last {window} steps average +{rate} / step',
  'headroom.nextRequest': 'Next request projection',
  'headroom.overflow': 'At the current pace the next turn may exceed the window.',
  'headroom.noOverflow': 'At the current pace the window has comfortable headroom.',

  'provenance.title': 'Measurement basis',
  'provenance.reported': 'Provider-reported',
  'provenance.estimated': 'Heuristic estimate',
  'provenance.none': 'No anchor',
  'provenance.note': 'Estimates systematically underprice CJK text and JSON schemas; occupancy always stays anchored to the provider figure.',

  'cache.title': 'Cache economics',
  'cache.read': 'Cache read',
  'cache.write': 'Cache write',
  'cache.uncached': 'Uncached input',
  'cache.output': 'Output',
  'cache.hitRate': 'Cache hit rate',
  'cache.hitRateValue': '{percent}%',
  'cache.noData': 'No usage recorded for this session yet.',

  'timeline.title': 'Context × trajectory',
  'timeline.subtitle': 'How context grew and was reclaimed, step by step',
  'timeline.empty': 'No trajectory samples collected yet.',
  'timeline.partial': 'Sampling starts when the plugin loads; earlier history is not covered.',
  'timeline.truncated': 'Sampling truncated (limit {max}, {dropped} dropped).',
  'timeline.reclaim': 'Reclaimed {tokens}',
  'timeline.step': 'Turn {turn} · step {step}',
  'timeline.boundary': 'Boundary event',
  'timeline.unavailable': 'The host token meter is unavailable, so the trajectory timeline cannot be sampled.',
  'timeline.loading': 'Reading trajectory…',

  'axis.tokens': 'tokens',
  'axis.step': 'step',

  'action.refresh': 'Refresh',
  'action.close': 'Close',
  'action.export': 'Export report',
  'action.exportMarkdown': 'Export as Markdown',
  'action.exportJson': 'Export as JSON',
  'action.exported': 'Report saved',
  'action.exportFailed': 'Export failed',

  'report.title': 'Context Lens report',
  'report.generatedAt': 'Generated',
  'report.session': 'Session',
  'report.section.occupancy': 'Occupancy',
  'report.section.breakdown': 'Composition',
  'report.section.headroom': 'Headroom',
  'report.section.cache': 'Cache economics',
  'report.section.provenance': 'Measurement basis',
  'report.section.timeline': 'Trajectory samples',
  'report.noData': '(no data)',

  'settings.title': 'Context Lens settings',
  'settings.hint': 'The host half validates these at load time; an invalid value refuses to start rather than being silently ignored.',
  'settings.unavailable': 'No settings service in this assembly. Set these values directly in the profile cordis config.',
  'settings.unset': 'default',
  'settings.sampleStride': 'Sample stride (revisions)',
  'settings.sampleStride.hint': 'Advance this many log revisions between samples.',
  'settings.maxSamples': 'Sample cap',
  'settings.maxSamples.hint': 'Beyond this the oldest samples are dropped and truncation is reported.',
  'settings.maxNodesPerSample': 'Node echo cap per sample',
  'settings.maxNodesPerSample.hint': 'How many surface nodes to echo per sample.',
  'settings.cacheTtlMs': 'Result cache TTL (ms)',
  'settings.cacheTtlMs.hint': 'Repeat reads of one session reuse the last result within this window.',
  'settings.paceWindow': 'Pace window (steps)',
  'settings.paceWindow.hint': 'How many recent steps to average when estimating remaining turns.',
  'meter.title': 'Context headroom',
  'meter.remaining': '{value} left',
  'meter.unknown': 'n/a',
  'unit.thousand': '{value}K',
  'unit.million': '{value}M',
}

/** Every dictionary key. */
const KEYS = Object.freeze(Object.keys(zh))

exports.NS = NS
exports.zh = zh
exports.en = en
exports.KEYS = KEYS

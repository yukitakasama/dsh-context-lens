/**
 * The bridge from host-computed projections to a React-consumable snapshot.
 *
 * Why this exists at all: `sidebar.footer.action` is a ROOT-scope seat, and
 * the session standard kit (`useProjection`, `sessionId`, `useSession`) is
 * only installed for `session` / `session-maybe` scopes. A root-scope
 * registrant therefore has two options — declare a session-scoped child
 * (impossible: we do not own the footer) or bind the projections itself. This
 * module does the latter, following the shipped `ui-goal` activation source:
 * the plugin body closes over `ctx`, resolves the CURRENT session from
 * `ctx.sessions.list`, and hands the component a bare observable through the
 * `hooks` compartment, where the renderer turns it into a `use<Name>` hook.
 *
 * The projections are read, never computed: every value here is a finished
 * whole value the host already folded. `faceOf(key)` is the documented read
 * face, and the projection store guarantees reference stability per key, so
 * subscribing is cheap and cannot loop.
 *
 * @module dsh-context-lens/client/views/source
 */

const { buildViewModel } = require('../model/index.cjs')

/** Projection keys this panel reads. */
const KEYS = ['contextPressure', 'contextBreakdown', 'tokenUsage', 'sessionStats']

/** The plugin route that serves the sampled timeline. */
const TIMELINE_PATH = '/api/context-lens/timeline'

/**
 * Compare two published snapshots by the facts the component renders.
 *
 * Reference equality on the projection values is enough for the projection
 * half (the store keeps them stable), but the derived view model is rebuilt
 * each time, so it is compared by identity of its inputs instead of by value.
 *
 * @param left - previous snapshot.
 * @param right - candidate snapshot.
 * @returns true when nothing the component reads has changed.
 */
function sameSnapshot(left, right) {
  return left.sessionId === right.sessionId
    && left.pressure === right.pressure
    && left.breakdown === right.breakdown
    && left.usage === right.usage
    && left.stats === right.stats
    && left.timeline === right.timeline
    && left.timelineState === right.timelineState
}

/**
 * Read the current session's projection values once.
 * @param sessions - the `ctx.sessions` face.
 * @param sessionId - the current session id, or undefined.
 * @returns the raw projection values for this session.
 */
function readProjections(sessions, sessionId) {
  if (sessionId === undefined) return { hasSession: false, session: undefined }
  const binding = sessions.binding(sessionId)
  if (binding === undefined) return { hasSession: false, session: undefined }
  const faces = binding.session.projections
  const value = key => faces.faceOf(key).getSnapshot()
  return {
    hasSession: true,
    session: binding.session,
    pressure: value('contextPressure'),
    breakdown: value('contextBreakdown'),
    usage: value('tokenUsage'),
    stats: value('sessionStats'),
  }
}

/**
 * Create the panel's observable source.
 *
 * Subscriptions start lazily with the first observer and stop with the last,
 * so a collapsed sidebar costs nothing.
 *
 * @param deps - `{ sessions, fetcher, paceWindow, refreshMs }`.
 * @returns a stable `HostObservable` snapshot source.
 */
function createContextLensSource(deps) {
  const sessions = deps.sessions
  const paceWindow = deps.paceWindow ?? 10

  let snapshot = {
    hasSession: false,
    sessionId: undefined,
    timelineState: 'idle',
    model: buildViewModel({ hasSession: false, paceWindow }),
  }
  let observers = 0
  let disposers = []
  let projectionOffsets = []
  /** Timeline fetch state for the CURRENT session only. */
  let timeline = undefined
  let timelineState = 'idle'
  let timelineEpoch = 0
  const listeners = new Set()
  /** The projection-unsubscribe handles for the session currently bound. */
  let sessionDisposers = []

  /**
   * Publish a new snapshot when anything the component reads has moved.
   * @param next - the candidate snapshot.
   */
  function publish(next) {
    if (sameSnapshot(snapshot, next)) return
    snapshot = next
    for (const listener of listeners) listener()
  }

  /** Rebuild the snapshot from the current projections and timeline cache. */
  function refresh() {
    const current = sessions.list.getSnapshot().current
    const raw = readProjections(sessions, current)
    const model = buildViewModel({
      ...raw,
      timeline,
      paceWindow,
    })
    publish({
      hasSession: raw.hasSession,
      sessionId: current,
      pressure: raw.pressure,
      breakdown: raw.breakdown,
      usage: raw.usage,
      stats: raw.stats,
      timeline,
      timelineState,
      model,
    })
  }

  /**
   * Fetch the sampled timeline for one session.
   *
   * A missing route (the host half is not mounted, e.g. no web server) is a
   * reported state rather than an error: the rest of the panel still works.
   *
   * @param sessionId - the session to fetch.
   */
  function fetchTimeline(sessionId) {
    if (sessionId === undefined) return
    const epoch = ++timelineEpoch
    timelineState = 'loading'
    refresh()
    deps.fetcher(`${TIMELINE_PATH}?sessionId=${encodeURIComponent(sessionId)}`)
      .then(response => {
        if (epoch !== timelineEpoch) return
        if (response.status === 503 || response.status === 404) {
          timeline = undefined
          timelineState = 'unavailable'
          refresh()
          return
        }
        if (!response.ok) {
          timeline = undefined
          timelineState = 'error'
          refresh()
          return
        }
        return response.json().then(body => {
          if (epoch !== timelineEpoch) return
          timeline = body
          timelineState = 'ready'
          refresh()
        })
      })
      .catch(() => {
        if (epoch !== timelineEpoch) return
        timeline = undefined
        timelineState = 'unavailable'
        refresh()
      })
  }

  /** (Re)bind projection subscriptions to the current session. */
  function rebindSession() {
    for (const dispose of sessionDisposers) dispose()
    sessionDisposers = []
    const current = sessions.list.getSnapshot().current
    const binding = current === undefined ? undefined : sessions.binding(current)
    if (binding === undefined) return
    for (const key of KEYS) {
      sessionDisposers.push(binding.session.projections.faceOf(key).subscribe(refresh))
    }
  }

  /** Track the current-session selection; rebind and refetch on change. */
  function onSessionsChanged() {
    const before = snapshot.sessionId
    rebindSession()
    const current = sessions.list.getSnapshot().current
    if (current !== before) {
      timeline = undefined
      timelineState = 'idle'
      fetchTimeline(current)
    }
    refresh()
  }

  /** Start observing. */
  function start() {
    disposers = [
      sessions.list.subscribe(onSessionsChanged),
      ...(typeof deps.subscribeReset === 'function' ? [deps.subscribeReset(onSessionsChanged)] : []),
    ]
    rebindSession()
    const current = sessions.list.getSnapshot().current
    if (current !== undefined) fetchTimeline(current)
    refresh()
  }

  /** Stop observing and drop every handle. */
  function stop() {
    for (const dispose of disposers) dispose()
    for (const dispose of sessionDisposers) dispose()
    disposers = []
    sessionDisposers = []
    timelineEpoch++
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      if (observers === 0) start()
      observers++
      return () => {
        listeners.delete(listener)
        observers--
        if (observers === 0) stop()
      }
    },
    /** Force a fresh timeline read; used by the panel's refresh button. */
    refreshTimeline() {
      const current = sessions.list.getSnapshot().current
      if (current === undefined) return
      fetchTimeline(current)
    },
    /** Restart the projection binding after a manual refresh. */
    rebind: onSessionsChanged,
  }
}

exports.KEYS = KEYS
exports.TIMELINE_PATH = TIMELINE_PATH
exports.createContextLensSource = createContextLensSource
exports.readProjections = readProjections

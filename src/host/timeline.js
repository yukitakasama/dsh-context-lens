/**
 * Timeline sampling: read a session's context growth out of `ctx.tokenMeter`.
 *
 * IMPORTANT — what the meter can and cannot do. `measure(session)` reads the
 * session's CURRENT durable tail; it takes no revision argument and offers no
 * way to replay an arbitrary past point (`packages/llm/token-meter/src/index.ts`:
 * `measure(session, requestHeader?)`). So a timeline cannot be reconstructed
 * after the fact by walking revisions backwards — it has to be OBSERVED as the
 * session runs. This module therefore samples on the events that actually move
 * the context, which is both the honest and the cheap thing to do.
 *
 * Sampling points are the step and turn boundaries plus each compaction
 * checkpoint, giving per-step granularity without measuring on every token
 * delta. `measure()` is O(surface) because it clones the positional nodes, so
 * an event-driven allowlist keeps the cost proportional to the number of STEPS
 * rather than to the length of the log.
 *
 * The consequence is stated plainly rather than hidden: samples exist only for
 * events observed while the plugin was loaded. `coverage` reports that in the
 * payload so the client can label the timeline as partial instead of implying
 * it covers the whole session.
 *
 * @module dsh-context-lens/host/timeline
 */

import { json, rejectForeignCaller } from './fence.js'

/** The exact route this module owns. */
export const TIMELINE_PATH = '/api/context-lens/timeline'

/**
 * Event types that move the context enough to be worth a sample.
 *
 * `step/end` is the step-lifecycle authority (exactly one per entered step,
 * appended in a `finally`), so it catches completed, failed and cancelled
 * steps alike. The compaction pair brackets a reclaim, which is the single
 * most interesting transition a context timeline can show.
 */
const SAMPLE_EVENTS = new Set([
  'step/end',
  'turn/end',
  'compaction/start',
  'compaction/summary',
])

/**
 * Classify the movement between two samples.
 * @param previous - earlier total, or undefined for the first sample.
 * @param next - current total.
 * @returns `first` | `grow` | `reclaim` | `flat`.
 */
function kindOf(previous, next) {
  if (previous === undefined) return 'first'
  if (next > previous) return 'grow'
  if (next < previous) return 'reclaim'
  return 'flat'
}

/**
 * Per-session ring of samples, bounded by `maxSamples`.
 *
 * The oldest sample is dropped once the cap is reached and `dropped` counts
 * how many were evicted, so a bounded buffer still reports that it is bounded.
 */
class SessionTrace {
  /**
   * @param config - validated plugin config.
   */
  constructor(config) {
    this.config = config
    this.samples = []
    this.dropped = 0
  }

  /**
   * Take one sample of the session's current context and append it.
   * @param session - the harness session object.
   * @param meter - the `tokenMeter` service.
   * @param event - the event that triggered the sample.
   */
  observe(session, meter, event) {
    let measurement
    try {
      measurement = meter.measure(session)
    } catch {
      // A meter that cannot measure this session contributes no point; the
      // trace stays honest instead of inventing a zero.
      return
    }

    // `measure()` clones the whole positional node set, but no client reads
    // per-node data — only the count is a meaningful property of a sample.
    // Echoing the array made `nodes[]` ~99% of the response body (issue #15),
    // so it is deliberately dropped here rather than capped and shipped.
    const nodes = measurement.nodes ?? []
    const previous = this.samples.length === 0
      ? undefined
      : this.samples[this.samples.length - 1].totalTokens
    const total = measurement.totalTokens

    this.samples.push({
      logRevision: Number(measurement.logRevision),
      eventType: String(event.type),
      turn: typeof event.data?.turn === 'number' ? event.data.turn : undefined,
      step: typeof event.data?.step === 'number' ? event.data.step : undefined,
      totalTokens: total,
      surfaceTokens: measurement.surfaceTokens,
      surfaceDeltaTokens: measurement.surfaceDeltaTokens,
      baselineKind: measurement.baseline?.kind ?? 'none',
      deltaTokens: previous === undefined ? total : total - previous,
      kind: kindOf(previous, total),
      nodeCount: nodes.length,
    })

    while (this.samples.length > this.config.maxSamples) {
      this.samples.shift()
      this.dropped++
    }
  }

  /**
   * Snapshot the trace as a JSON-serializable payload.
   * @returns the timeline payload for one session.
   */
  toPayload() {
    const last = this.samples[this.samples.length - 1]
    return {
      ok: true,
      coverage: 'observed-since-plugin-load',
      truncated: this.dropped > 0,
      dropped: this.dropped,
      sampleCount: this.samples.length,
      maxSamples: this.config.maxSamples,
      finalTotalTokens: last?.totalTokens ?? 0,
      finalSurfaceTokens: last?.surfaceTokens ?? 0,
      samples: this.samples,
    }
  }
}

/**
 * Recorder owning one trace per session.
 *
 * Subscribing is an effect on the plugin's fiber, so unloading the plugin
 * releases the listener and every trace with it.
 */
export class TimelineRecorder {
  /**
   * @param getContext - resolves the plugin context at call time.
   * @param config - validated plugin config.
   */
  constructor(getContext, config) {
    this.getContext = getContext
    this.config = config
    this.traces = new Map()
  }

  /**
   * Subscribe to session events and begin recording boundary samples.
   * @param ctx - the plugin context.
   * @returns a disposer that unsubscribes and drops every trace.
   */
  start(ctx) {
    const meter = ctx.get('tokenMeter')
    if (meter === undefined || typeof meter.measure !== 'function') {
      // No meter means no timeline. This is a missing capability, not an
      // error: the rest of the plugin works from the official projections.
      return () => {}
    }
    const dispose = ctx.on('session/event', (session, event) => {
      if (!SAMPLE_EVENTS.has(String(event?.type))) return
      let trace = this.traces.get(session)
      if (trace === undefined) {
        trace = new SessionTrace(this.config)
        this.traces.set(session, trace)
      }
      trace.observe(session, meter, event)
    })
    return () => {
      dispose()
      this.traces.clear()
    }
  }

  /**
   * Read the recorded trace for one session id.
   *
   * The recorder indexes by session OBJECT, because that is what the event
   * carries; the route addresses sessions by id, so the two are matched here.
   *
   * @param ctx - the plugin context.
   * @param sessionId - the requested session id.
   * @returns the payload, or undefined when nothing was recorded.
   */
  payloadFor(ctx, sessionId) {
    const sessions = ctx.get('sessions')
    const session = sessions?.get?.(sessionId)
    if (session === undefined) return undefined
    const trace = this.traces.get(session)
    if (trace === undefined) return undefined
    return trace.toPayload()
  }
}

/**
 * Create the timeline route handler.
 *
 * @param getContext - resolves the plugin context at call time.
 * @param recorder - the shared recorder.
 * @returns an `http` request handler.
 */
export function createTimelineHandler(getContext, recorder) {
  return function handleTimeline(req, res) {
    if (rejectForeignCaller(req, res)) return

    const ctx = getContext()
    const meter = ctx.get('tokenMeter')
    if (meter === undefined || typeof meter.measure !== 'function') {
      // Fail loud: a timeline with no meter is not an empty timeline, it is a
      // missing capability, and the client must be able to say so.
      json(res, 503, { ok: false, error: 'token-meter-unavailable' })
      return
    }

    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    if (sessionId === null || sessionId === '') {
      json(res, 400, { ok: false, error: 'sessionId-required' })
      return
    }

    const payload = recorder.payloadFor(ctx, sessionId)
    if (payload === undefined) {
      // The session may exist with nothing recorded yet (the plugin loaded
      // after it started). Distinguish that from an unknown session.
      const sessions = ctx.get('sessions')
      const known = sessions?.get?.(sessionId) !== undefined
      json(res, known ? 200 : 404, known
        ? { ok: true, coverage: 'observed-since-plugin-load', truncated: false, dropped: 0, sampleCount: 0, maxSamples: recorder.config.maxSamples, finalTotalTokens: 0, finalSurfaceTokens: 0, samples: [] }
        : { ok: false, error: 'session-not-found' })
      return
    }

    json(res, 200, payload)
  }
}

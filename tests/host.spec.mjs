/**
 * Host-half tests: the loopback fence, the config validator, and the timeline
 * recorder.
 *
 * The fence carries the plugin's entire security surface — an exact route under
 * `/api` bypasses the connection plugin's RPC trust check, so these assertions
 * are the thing standing between "read-only local view" and "any page in the
 * browser can read your session". They are tested adversarially.
 *
 * @module dsh-context-lens/tests/host.spec
 */

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const fence = await import(pathToFileURL(resolve(root, 'lib/host/fence.js')).href)
const config = await import(pathToFileURL(resolve(root, 'lib/host/config.js')).href)
const timeline = await import(pathToFileURL(resolve(root, 'lib/host/timeline.js')).href)
const host = await import(pathToFileURL(resolve(root, 'lib/index.js')).href)

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

test('validateConfig fills defaults for empty input', () => {
  const filled = config.validateConfig(undefined)
  assert.equal(filled.sampleStride, 1)
  assert.equal(filled.maxSamples, 2_000)
  assert.ok(Object.isFrozen(filled), 'the result is frozen')
})

test('validateConfig rejects out-of-range and non-integer values', () => {
  assert.throws(() => config.validateConfig({ sampleStride: 0 }), /within \[1, 10000\]/)
  assert.throws(() => config.validateConfig({ sampleStride: 1.5 }), /must be an integer/)
  assert.throws(() => config.validateConfig({ maxSamples: 'many' }), /must be an integer/)
  assert.throws(() => config.validateConfig({ paceWindow: 0 }), /within/)
  assert.throws(() => config.validateConfig([]), /must be an object/)
  assert.throws(() => config.validateConfig('nope'), /must be an object/)
})

test('validateConfig rejects unknown keys instead of ignoring them', () => {
  // A typo must not silently leave the operator believing a setting took effect.
  assert.throws(() => config.validateConfig({ sampleStrde: 5 }), /unknown config key/)
  assert.throws(() => config.validateConfig({ bogus: 1 }), /known keys are/)
})

test('the Config export is a Standard Schema that reports issues', () => {
  const standard = host.Config['~standard']
  assert.equal(standard.version, 1)
  assert.equal(standard.vendor, 'dsh-context-lens')
  const ok = standard.validate({ sampleStride: 4 })
  assert.equal(ok.value.sampleStride, 4)
  const bad = standard.validate({ sampleStride: -1 })
  assert.ok(Array.isArray(bad.issues) && bad.issues.length === 1)
  assert.match(bad.issues[0].message, /sampleStride/)
})

// ---------------------------------------------------------------------------
// fence
// ---------------------------------------------------------------------------

test('isLoopbackAddress accepts loopback and normalizes IPv4-mapped IPv6', () => {
  assert.equal(fence.isLoopbackAddress('::1'), true)
  assert.equal(fence.isLoopbackAddress('127.0.0.1'), true)
  assert.equal(fence.isLoopbackAddress('127.1.2.3'), true)
  assert.equal(fence.isLoopbackAddress('::ffff:127.0.0.1'), true, 'dual-stack listener')
  assert.equal(fence.isLoopbackAddress('::FFFF:127.0.0.1'), true, 'case-insensitive')
})

test('isLoopbackAddress rejects everything that is not loopback', () => {
  for (const address of [
    undefined, null, '', 'localhost',
    '10.0.0.1', '192.168.1.5', '8.8.8.8',
    '::', '::ffff:10.0.0.1', 'fe80::1',
    '127.0.0.256', '127.0.0', '127.0.0.1.5', '127.a.0.1',
    '128.0.0.1', '0.0.0.0',
  ]) {
    assert.equal(fence.isLoopbackAddress(address), false, `must reject ${JSON.stringify(address)}`)
  }
})

test('hostNameOf parses IPv4, IPv6 literals and rejects junk', () => {
  assert.equal(fence.hostNameOf('localhost:3080'), 'localhost')
  assert.equal(fence.hostNameOf('127.0.0.1:54106'), '127.0.0.1')
  assert.equal(fence.hostNameOf('example.com'), 'example.com')
  assert.equal(fence.hostNameOf('[::1]:3080'), '::1')
  assert.equal(fence.hostNameOf('[::1]'), '::1')
  assert.equal(fence.hostNameOf('LOCALHOST:80'), 'localhost')
  assert.equal(fence.hostNameOf('localhost.'), 'localhost', 'trailing dot')
  // Junk must not be mistaken for a loopback name.
  assert.equal(fence.hostNameOf('[::1]junk'), null)
  assert.equal(fence.hostNameOf('[]'), null)
  assert.equal(fence.hostNameOf('a:b:c'), 'a:b:c', 'unbracketed IPv6 is returned as-is')
  assert.equal(fence.hostNameOf(undefined), null)
  assert.equal(fence.hostNameOf(123), null)
})

/** A minimal request/response pair for exercising the fence. */
function fakeExchange({ method = 'GET', remoteAddress = '127.0.0.1', host = 'localhost:3080' } = {}) {
  const written = {}
  return {
    written,
    req: { method, headers: { host }, socket: { remoteAddress } },
    res: {
      writeHead(status, headers) {
        written.status = status
        written.headers = headers
      },
      end(body) {
        written.body = body
      },
    },
  }
}

test('rejectForeignCaller admits a loopback GET', () => {
  const { req, res, written } = fakeExchange()
  assert.equal(fence.rejectForeignCaller(req, res), false, 'not refused')
  assert.equal(written.status, undefined, 'nothing was written')
})

test('rejectForeignCaller refuses non-GET with 405 before anything else', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']) {
    const { req, res, written } = fakeExchange({ method })
    assert.equal(fence.rejectForeignCaller(req, res), true, `${method} must be refused`)
    assert.equal(written.status, 405, `${method} must be 405`)
    assert.match(written.body, /method-not-allowed/)
  }
})

test('rejectForeignCaller refuses a remote peer with 403', () => {
  const { req, res, written } = fakeExchange({ remoteAddress: '10.0.0.7' })
  assert.equal(fence.rejectForeignCaller(req, res), true)
  assert.equal(written.status, 403)
  assert.match(written.body, /forbidden/)
})

test('rejectForeignCaller refuses a spoofed Host header from a remote peer', () => {
  // The peer address decides; a client-settable Host header cannot open the door.
  const { req, res, written } = fakeExchange({ remoteAddress: '203.0.113.9', host: 'localhost:3080' })
  assert.equal(fence.rejectForeignCaller(req, res), true)
  assert.equal(written.status, 403)
})

test('rejectForeignCaller refuses a loopback peer with a foreign Host', () => {
  // Host is the secondary check: a loopback socket claiming another origin is
  // refused rather than trusted.
  const { req, res, written } = fakeExchange({ remoteAddress: '127.0.0.1', host: 'evil.example.com' })
  assert.equal(fence.rejectForeignCaller(req, res), true)
  assert.equal(written.status, 403)
})

test('json writes a no-cache JSON response', () => {
  const { res, written } = fakeExchange()
  fence.json(res, 200, { ok: true })
  assert.equal(written.status, 200)
  assert.match(written.headers['content-type'], /application\/json/)
  assert.equal(written.headers['cache-control'], 'no-cache')
  assert.deepEqual(JSON.parse(written.body), { ok: true })
})

// ---------------------------------------------------------------------------
// timeline recorder
// ---------------------------------------------------------------------------

/** A meter stub returning a scripted measurement per call. */
function fakeMeter(sequence) {
  let index = 0
  return {
    measure() {
      const value = sequence[Math.min(index, sequence.length - 1)]
      index++
      if (value instanceof Error) throw value
      return value
    },
  }
}

/** A measurement with the fields the recorder reads. */
function measurement(totalTokens, { nodes = 1, revision = 1 } = {}) {
  return {
    logRevision: revision,
    baseline: { kind: 'usage', tokens: totalTokens },
    surfaceDeltaTokens: 0,
    totalTokens,
    surfaceTokens: totalTokens,
    nodes: Array.from({ length: nodes }, (_, i) => ({ seq: i, tokens: 10, heuristicTokens: 8 })),
  }
}

/**
 * A context stub exposing the named services.
 *
 * `sessions.get` models the harness: a session exists independently of whether
 * OUR recorder has seen it, so the default id resolves to a live session object
 * (and only an id outside the list is unknown).
 */
function fakeContext({ meter, session = {}, known = ['session-1'] } = {}) {
  const ctx = {
    get(name) {
      if (name === 'tokenMeter') return meter
      if (name === 'sessions') return { get: id => (known.includes(id) ? session : undefined) }
      return undefined
    },
    on(event, handler) {
      if (event !== 'session/event') throw new Error(`unexpected event: ${event}`)
      ctx.handler = handler
      return () => { ctx.handler = undefined }
    },
  }
  return ctx
}

test('recorder samples only boundary events and tracks growth and reclaims', () => {
  const config_ = config.validateConfig({})
  const meter = fakeMeter([measurement(1_000), measurement(3_000), measurement(1_500)])
  const session = { id: 'session-1' }
  const ctx = fakeContext({ meter, session })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)

  const dispose = recorder.start(ctx)
  assert.equal(typeof dispose, 'function', 'start returns a disposer')

  // A non-boundary event must be ignored entirely.
  ctx.handler(session, { type: 'assistant/message', data: {} })
  assert.equal(recorder.traces.size, 0, 'no trace for an irrelevant event')

  ctx.handler(session, { type: 'step/end', data: { turn: 1, step: 1 } })
  ctx.handler(session, { type: 'step/end', data: { turn: 1, step: 2 } })
  ctx.handler(session, { type: 'compaction/summary', data: {} })

  const payload = recorder.payloadFor(ctx, 'session-1')
  assert.equal(payload.ok, true)
  assert.equal(payload.sampleCount, 3)
  assert.equal(payload.coverage, 'observed-since-plugin-load', 'coverage is stated, not implied')
  assert.equal(payload.samples[0].kind, 'first')
  assert.equal(payload.samples[0].deltaTokens, 1_000)
  assert.equal(payload.samples[1].kind, 'grow')
  assert.equal(payload.samples[1].deltaTokens, 2_000)
  assert.equal(payload.samples[2].kind, 'reclaim', 'a drop is a reclaim')
  assert.equal(payload.samples[2].deltaTokens, -1_500)
  assert.equal(payload.finalTotalTokens, 1_500)
  assert.equal(payload.samples[1].turn, 1)
  assert.equal(payload.samples[1].step, 2)
  assert.equal(payload.samples[2].eventType, 'compaction/summary')
})

test('recorder reports truncation instead of silently dropping samples', () => {
  // maxSamples 3: the oldest are evicted and `dropped` counts them.
  const config_ = config.validateConfig({ maxSamples: 3 })
  const meter = fakeMeter([measurement(1), measurement(2), measurement(3), measurement(4), measurement(5)])
  const session = {}
  const ctx = fakeContext({ meter, session })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  recorder.start(ctx)
  for (let i = 0; i < 5; i++) ctx.handler(session, { type: 'step/end', data: { turn: 1, step: i } })

  const payload = recorder.payloadFor(ctx, 'session-1')
  assert.equal(payload.sampleCount, 3, 'bounded to maxSamples')
  assert.equal(payload.dropped, 2, 'evictions are counted')
  assert.equal(payload.truncated, true, 'truncation is reported')
})

test('a sample carries the node count but never the node set (issue #15)', () => {
  const config_ = config.validateConfig({})
  const meter = fakeMeter([measurement(100, { nodes: 500 })])
  const session = {}
  const ctx = fakeContext({ meter, session })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  recorder.start(ctx)
  ctx.handler(session, { type: 'step/end', data: {} })

  const payload = recorder.payloadFor(ctx, 'session-1')
  const sample = payload.samples[0]
  assert.equal(sample.nodeCount, 500, 'the true count is reported as one integer')
  assert.ok(!('nodes' in sample), 'the node array is not serialised')
  assert.ok(!('nodesTruncated' in sample), 'the node-cap flag is gone with the array')
  // 500 nodes used to add ~23KB of JSON per sample — 99.1% of the body. The
  // whole one-sample body must now be orders of magnitude smaller.
  assert.ok(JSON.stringify(payload).length < 1_000, 'the body no longer scales with surface size')
})

test('maxNodesPerSample is retired, so a profile setting it fails loud', () => {
  assert.throws(() => config.validateConfig({ maxNodesPerSample: 2 }), /unknown config key/)
})

test('an empty known session reports no node echo either', () => {
  const config_ = config.validateConfig({})
  const ctx = fakeContext({ meter: fakeMeter([measurement(1)]) })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  const handler = timeline.createTimelineHandler(() => ctx, recorder)
  const body = JSON.parse(callRoute(handler).body)
  assert.deepEqual(body.samples, [], 'nothing sampled, nothing echoed')
  assert.ok(!('nodes' in body), 'no node array at the top level')
})

test('recorder skips a sample whose measurement throws, without inventing a point', () => {
  const config_ = config.validateConfig({})
  const meter = fakeMeter([measurement(500), new Error('replay failed'), measurement(900)])
  const session = {}
  const ctx = fakeContext({ meter, session })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  recorder.start(ctx)
  ctx.handler(session, { type: 'step/end', data: {} })
  ctx.handler(session, { type: 'step/end', data: {} })
  ctx.handler(session, { type: 'step/end', data: {} })

  const payload = recorder.payloadFor(ctx, 'session-1')
  assert.equal(payload.sampleCount, 2, 'the throwing measurement contributes nothing')
  assert.equal(payload.samples[1].totalTokens, 900)
})

test('recorder start is inert without a token meter', () => {
  const ctx = fakeContext({ meter: undefined })
  const recorder = new timeline.TimelineRecorder(() => ctx, config.validateConfig({}))
  const dispose = recorder.start(ctx)
  assert.equal(typeof dispose, 'function', 'a no-op disposer is still returned')
  assert.equal(ctx.handler, undefined, 'nothing was subscribed')
})

test('the disposer drops every trace', () => {
  const config_ = config.validateConfig({})
  const meter = fakeMeter([measurement(1)])
  const session = {}
  const ctx = fakeContext({ meter, session })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  const dispose = recorder.start(ctx)
  ctx.handler(session, { type: 'step/end', data: {} })
  assert.equal(recorder.traces.size, 1)
  dispose()
  assert.equal(recorder.traces.size, 0, 'unload leaves no recording behind')
})

// ---------------------------------------------------------------------------
// route handler
// ---------------------------------------------------------------------------

/** Drive the handler with a stubbed exchange and return what it wrote. */
function callRoute(handler, { url = '/api/context-lens/timeline?sessionId=session-1', method = 'GET', remoteAddress = '127.0.0.1' } = {}) {
  const written = {}
  const req = { method, url, headers: { host: 'localhost:3080' }, socket: { remoteAddress } }
  const res = {
    writeHead(status) { written.status = status },
    end(body) { written.body = body },
  }
  handler(req, res)
  return written
}

test('the timeline route refuses non-loopback callers and non-GET methods', () => {
  const config_ = config.validateConfig({})
  const recorder = new timeline.TimelineRecorder(() => fakeContext({ meter: fakeMeter([measurement(1)]) }), config_)
  const handler = timeline.createTimelineHandler(() => fakeContext({ meter: fakeMeter([measurement(1)]) }), recorder)

  assert.equal(callRoute(handler, { remoteAddress: '10.1.2.3' }).status, 403)
  assert.equal(callRoute(handler, { method: 'POST' }).status, 405)
})

test('the timeline route fails loud when the meter is absent', () => {
  const config_ = config.validateConfig({})
  const ctx = fakeContext({ meter: undefined })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  const handler = timeline.createTimelineHandler(() => ctx, recorder)

  const written = callRoute(handler)
  assert.equal(written.status, 503, 'a missing capability is not an empty timeline')
  assert.match(written.body, /token-meter-unavailable/)
})

test('the timeline route requires a sessionId', () => {
  const config_ = config.validateConfig({})
  const ctx = fakeContext({ meter: fakeMeter([measurement(1)]) })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  const handler = timeline.createTimelineHandler(() => ctx, recorder)

  assert.equal(callRoute(handler, { url: '/api/context-lens/timeline' }).status, 400)
  assert.equal(callRoute(handler, { url: '/api/context-lens/timeline?sessionId=' }).status, 400)
})

test('the timeline route 404s an unknown session and 200s an empty known one', () => {
  const config_ = config.validateConfig({})
  const ctx = fakeContext({ meter: fakeMeter([measurement(1)]) })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  const handler = timeline.createTimelineHandler(() => ctx, recorder)

  assert.equal(callRoute(handler, { url: '/api/context-lens/timeline?sessionId=other' }).status, 404)

  const known = callRoute(handler)
  assert.equal(known.status, 200)
  const body = JSON.parse(known.body)
  assert.equal(body.sampleCount, 0, 'a known session with nothing recorded reads as empty')
  assert.equal(body.coverage, 'observed-since-plugin-load')
})

test('the timeline route returns recorded samples for a known session', () => {
  const config_ = config.validateConfig({})
  const session = {}
  const meter = fakeMeter([measurement(1_234, { revision: 7 })])
  const ctx = fakeContext({ meter, session })
  const recorder = new timeline.TimelineRecorder(() => ctx, config_)
  recorder.start(ctx)
  ctx.handler(session, { type: 'step/end', data: { turn: 2, step: 3 } })

  const handler = timeline.createTimelineHandler(() => ctx, recorder)
  const written = callRoute(handler)
  assert.equal(written.status, 200)
  const body = JSON.parse(written.body)
  assert.equal(body.samples.length, 1)
  assert.equal(body.samples[0].totalTokens, 1_234)
  assert.equal(body.samples[0].logRevision, 7)
})

// ---------------------------------------------------------------------------
// host plugin body
// ---------------------------------------------------------------------------

test('the host half declares no required service and exports only named values', () => {
  assert.equal(host.name, 'context-lens')
  assert.ok(!('default' in host), 'no default export (regression guard)')
  // The absence of `inject` is the strongest form of the TUI-safety rule.
  assert.equal(host.inject, undefined, 'no inject declaration at all')
})

test('apply is a no-op without a webServer and registers the route with one', () => {
  const registered = []
  const effects = []
  const meter = fakeMeter([measurement(1)])

  const makeCtx = extra => ({
    effect(callback, label) { effects.push(label); return callback() ?? (() => {}) },
    get: extra,
    on: () => () => {},
    logger: { debug() {} },
  })
  const noServer = makeCtx(name => (name === 'tokenMeter' ? meter : undefined))
  host.apply(noServer, {})
  assert.ok(effects.includes('context-lens: timeline recorder'))
  assert.equal(registered.length, 0, 'no route without a webServer')

  const withServer = makeCtx(name => (name === 'tokenMeter'
    ? meter
    : name === 'webServer'
      ? { register: route => { registered.push(route); return () => {} } }
      : undefined))
  host.apply(withServer, {})
  assert.equal(registered.length, 1, 'the exact route is registered')
  assert.equal(registered[0].kind, 'exact', 'an EXACT route, so it wins over the /api prefix handler')
  assert.equal(registered[0].path, '/api/context-lens/timeline')
  assert.equal(typeof registered[0].handler, 'function')
})

test('apply rejects an invalid config before registering anything', () => {
  const noop = {
    effect: cb => cb() ?? (() => {}),
    get: () => undefined,
    on: () => () => {},
    logger: { debug() {} },
  }
  assert.throws(() => host.apply(noop, { sampleStride: 0 }), /within/)
  assert.throws(() => host.apply(noop, { nonsense: true }), /unknown config key/)
})

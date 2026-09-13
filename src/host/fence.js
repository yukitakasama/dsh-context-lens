/**
 * Loopback fencing for the plugin's read-only route.
 *
 * An exact route under `/api/context-lens/*` bypasses the connection plugin's
 * `/api` prefix handler and therefore its RPC trust check, so this handler
 * applies its own fence. The decision is made on the PEER SOCKET address, not
 * the `Host` header, because a browser on any origin can set `Host`; the
 * header is only kept as a second, non-deciding check.
 *
 * @module dsh-context-lens/host/fence
 */

/**
 * Whether an address literal is a loopback interface.
 *
 * IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is normalized first, so a
 * dual-stack listener cannot be talked into accepting a non-loopback peer.
 *
 * @param address - `socket.remoteAddress`, possibly undefined.
 * @returns true for `::1` and any `127.x.x.x`.
 */
export function isLoopbackAddress(address) {
  if (typeof address !== 'string') return false
  const lower = address.toLowerCase()
  if (lower === '::1') return true
  const ipv4 = lower.startsWith('::ffff:') ? lower.slice(7) : lower
  const octets = ipv4.split('.')
  return octets.length === 4
    && octets[0] === '127'
    && octets.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Extract the hostname from a `Host` header without breaking IPv6 literals.
 * @param value - the raw header value.
 * @returns the lowercased hostname, or null when unparseable.
 */
export function hostNameOf(value) {
  if (typeof value !== 'string') return null
  const host = value.trim().toLowerCase()
  if (host.startsWith('[')) {
    const close = host.indexOf(']')
    if (close <= 1) return null
    const suffix = host.slice(close + 1)
    if (suffix !== '' && !/^:\d+$/.test(suffix)) return null
    return host.slice(1, close)
  }
  const firstColon = host.indexOf(':')
  const lastColon = host.lastIndexOf(':')
  if (firstColon !== lastColon) return host
  if (lastColon === -1) return host.replace(/\.$/, '')
  if (!/^\d+$/.test(host.slice(lastColon + 1))) return null
  return host.slice(0, lastColon).replace(/\.$/, '')
}

/**
 * Whether the `Host` header names a loopback origin.
 * @param req - the incoming request.
 * @returns true for `localhost` or a loopback literal.
 */
export function isLoopbackHostHeader(req) {
  const name = hostNameOf(req.headers?.host)
  return name === 'localhost' || isLoopbackAddress(name)
}

/**
 * Reject a non-`GET` method or a non-loopback caller before any work happens.
 *
 * Writes a 405 for any other method and a 403 for a foreign peer, then
 * reports whether the caller should stop.
 *
 * @param req - the incoming request.
 * @param res - the response to write a refusal into.
 * @returns true when the request was refused and handling must stop.
 */
export function rejectForeignCaller(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, error: 'method-not-allowed' }))
    return true
  }
  const peer = req.socket?.remoteAddress
  if (isLoopbackAddress(peer) && isLoopbackHostHeader(req)) return false
  res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ ok: false, error: 'forbidden' }))
  return true
}

/**
 * Write a JSON response.
 * @param res - the response.
 * @param status - HTTP status code.
 * @param value - JSON-serializable body.
 */
export function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-cache',
  })
  res.end(body)
}

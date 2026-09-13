# Security

## What this plugin can access

`dsh-context-lens` is a **read-only observer**. It does not write to any session,
does not send anything off the machine, and adds nothing model-visible.

It has two surfaces worth auditing:

### 1. The timeline route (host half)

`GET /api/context-lens/timeline?sessionId=<id>`

Registered as an **exact** route under `/api`, which means it intentionally
bypasses the connection plugin's `/api` prefix handler and its RPC trust check.
The handler therefore applies its own fence, in this order:

1. **Method** — anything other than `GET` is refused with `405` before any work
   happens.
2. **Peer socket address** — the request must originate from a loopback
   interface (`127.0.0.0/8` or `::1`), with IPv4-mapped IPv6 (`::ffff:127.0.0.1`)
   normalized first. Refused with `403` otherwise.
3. **`Host` header** — must name `localhost` or a loopback literal. Refused with
   `403` otherwise.

The decision is made on the **peer socket address, never the `Host` header**,
because a browser on any origin can set `Host`. The header is a second,
non-deciding check. This ordering is covered by adversarial tests
(`tests/host.spec.mjs`): a remote peer with a spoofed `localhost` Host is still
refused, and a loopback peer claiming a foreign origin is refused too.

The route returns only data already resident in the session's own log. It
performs no filesystem access and no outbound network request.

### 2. Report export (client half)

Export builds a Markdown or JSON document **in memory** and hands it to the
browser as an object URL. Nothing is uploaded. The suggested filename is
sanitized to `[A-Za-z0-9_-]` only, so a session id cannot contribute a `..`
path segment to the download name.

## What it deliberately does not do

- No `eval`, no dynamic code generation, no `child_process`.
- No filesystem writes.
- No outbound network calls from either half.
- No new session events, no `agent-loop` modification, no tool schema.

## Runtime dependencies

**None.** The host half uses only Node built-ins-adjacent language features and
imports nothing outside the package. The browser half requires only modules from
the shell's frozen baseline table (`react`, `react/jsx-runtime`). `scripts/check.mjs`
asserts that the host half contains no bare runtime import.

An install from a git host runs the package's `prepare` script, which executes
code on your machine at install time. pnpm requires you to allowlist that
explicitly (`allowBuilds`). Only install from a source you trust, and pin a
commit.

## Reporting a vulnerability

Open a private security advisory on the repository, or contact the maintainer
directly. Please do not file a public issue for a vulnerability.

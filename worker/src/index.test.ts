// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { handleRequest } from './index'
import { signToken } from './token'
import type { Env, LiveblocksApi } from './liveblocks'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', TOKEN_SECRET: 'test-token-secret' }

function makeApi(overrides: Partial<LiveblocksApi> = {}): LiveblocksApi {
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (room) => `tok-${room}`,
    getYUpdate: async () => new Uint8Array(),
    sendYUpdate: async () => {},
    ...overrides,
  }
}

describe('handleRequest (router + CORS)', () => {
  it('answers a CORS preflight with the allowed methods/headers', async () => {
    const req = new Request('https://worker.test/api/auth', {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    const allowedHeaders = res.headers.get('access-control-allow-headers')?.toLowerCase() ?? ''
    expect(allowedHeaders).toContain('authorization')
    // The owner-secret header is gone — auth is now the Bearer capability token.
    expect(allowedHeaders).not.toContain('x-owner-secret')
  })

  it('allows a matching origin from a comma-separated CORS allow-list', async () => {
    const req = new Request('https://worker.test/api/auth', {
      method: 'OPTIONS',
      headers: { origin: 'https://travel.vansach.me' },
    })
    const res = await handleRequest(
      req,
      {
        ...env,
        ALLOWED_ORIGIN: 'https://travel-planner-86b.pages.dev, https://travel.vansach.me',
      },
      makeApi(),
    )

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://travel.vansach.me')
  })

  it('routes POST /api/auth to the auth handler and adds CORS headers', async () => {
    const token = await signToken({ r: 'r1', p: 'edit', v: 1 }, env.TOKEN_SECRET)
    const req = new Request('https://worker.test/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.example' },
      body: JSON.stringify({ token }),
    })
    const res = await handleRequest(req, env, makeApi())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: 'tok-r1' })
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })

  it('routes POST /api/rooms through the owner gate', async () => {
    const req = new Request('https://worker.test/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ room: 'r2' }),
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(401)
  })

  it('routes GET /api/trip/:room to the trip handler (view+ token, room-matched)', async () => {
    const token = await signToken({ r: 'room1', p: 'view', v: 1 }, env.TOKEN_SECRET)
    const req = new Request('https://worker.test/api/trip/room1', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    const body = (await res.json()) as { trip: { title: string } }
    expect(body.trip.title).toBe('')
  })

  it('routes GET /api/schema to the schema handler (public) with CORS', async () => {
    const req = new Request('https://worker.test/api/schema', {
      method: 'GET',
      headers: { origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    const body = (await res.json()) as { type?: string }
    expect(body.type).toBe('object')
  })

  it('rejects GET /api/trip/:room without a token', async () => {
    const req = new Request('https://worker.test/api/trip/room1', { method: 'GET' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(401)
  })

  it('returns 405 for an unsupported method on /api/trip/:room', async () => {
    const req = new Request('https://worker.test/api/trip/room1', { method: 'DELETE' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(405)
  })

  it('routes POST /mcp to the MCP handler (open discovery, no key) with CORS', async () => {
    const req = new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://app.example' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })

  it('returns 405 for GET /mcp (POST only)', async () => {
    const req = new Request('https://worker.test/mcp', { method: 'GET' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(405)
  })

  it('routes GET /api/versions/:room to the list handler (view+ token, room-matched) with CORS', async () => {
    const token = await signToken({ r: 'room1', p: 'view', v: 1 }, env.TOKEN_SECRET)
    const req = new Request('https://worker.test/api/versions/room1', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    expect((await res.json()) as { versions: unknown[] }).toEqual({ versions: [] })
  })

  it('rejects GET /api/versions/:room without a token', async () => {
    const req = new Request('https://worker.test/api/versions/room1', { method: 'GET' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(401)
  })

  it('routes GET /api/versions/:room/:id to the snapshot handler (404 when absent)', async () => {
    const token = await signToken({ r: 'room1', p: 'view', v: 1 }, env.TOKEN_SECRET)
    const req = new Request('https://worker.test/api/versions/room1/1000', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(404)
  })

  it('returns 405 for a non-GET method on /api/versions/:room', async () => {
    const req = new Request('https://worker.test/api/versions/room1', { method: 'POST' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(405)
  })

  it('returns 404 for an unknown route', async () => {
    const req = new Request('https://worker.test/api/nope', { method: 'POST' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(404)
  })

  it('returns 400 with CORS headers for a malformed room id, not an uncaught throw', async () => {
    // '%C0' is a syntactically valid percent-escape (so it survives the URL
    // parser) but invalid UTF-8, so decodeURIComponent throws a URIError. The
    // handler must catch it and answer 400 with CORS, never let it escape.
    const req = new Request('https://worker.test/api/trip/%C0', {
      method: 'GET',
      headers: { origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(400)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })

  it('returns 405 for a wrong method on a known route', async () => {
    const req = new Request('https://worker.test/api/auth', { method: 'GET' })
    const res = await handleRequest(req, env, makeApi())
    expect(res.status).toBe(405)
  })

  it('returns a CORS-bearing 500 "server misconfigured" when TOKEN_SECRET is missing, not a 502', async () => {
    // A blank/absent TOKEN_SECRET must fail as a clear config error on a
    // token-verifying route, not masquerade as a Liveblocks outage (502).
    const misconfigured: Env = { ...env, TOKEN_SECRET: '' }
    // A well-formed token (signed with the real secret) so the request reaches the
    // secret guard rather than failing token parsing first.
    const token = await signToken({ r: 'room1', p: 'view', v: 1 }, env.TOKEN_SECRET)
    const req = new Request('https://worker.test/api/trip/room1', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, origin: 'https://app.example' },
    })
    const res = await handleRequest(req, misconfigured, makeApi())
    expect(res.status).toBe(500)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
    expect((await res.json()) as { error: string }).toEqual({ error: 'server misconfigured' })
  })

  it('returns the same CORS-bearing 500 for version routes when TOKEN_SECRET is missing', async () => {
    const misconfigured: Env = { ...env, TOKEN_SECRET: '' }
    const token = await signToken({ r: 'room1', p: 'view', v: 1 }, env.TOKEN_SECRET)

    for (const path of ['/api/versions/room1', '/api/versions/room1/1000']) {
      const req = new Request(`https://worker.test${path}`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}`, origin: 'https://app.example' },
      })
      const res = await handleRequest(req, misconfigured, makeApi())
      expect(res.status).toBe(500)
      expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
      expect((await res.json()) as { error: string }).toEqual({ error: 'server misconfigured' })
    }
  })

  it('returns a CORS-bearing 502 when the Liveblocks layer throws, not a bare 500', async () => {
    // The REST layer throws on any non-2xx (outage, 429, 5xx). The router must
    // catch it and still answer with CORS headers, or the browser sees an opaque
    // CORS error instead of a usable status.
    const api = makeApi({
      roomExists: async () => {
        throw new Error('Liveblocks room lookup failed: 503')
      },
    })
    const token = await signToken({ r: 'room1', p: 'view', v: 1 }, env.TOKEN_SECRET)
    const req = new Request('https://worker.test/api/trip/room1', {
      method: 'GET',
      headers: { authorization: `Bearer ${token}`, origin: 'https://app.example' },
    })
    const res = await handleRequest(req, env, api)
    expect(res.status).toBe(502)
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })
})

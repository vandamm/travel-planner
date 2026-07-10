// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleRequest } from './index'
import type { Env, LiveblocksApi } from './liveblocks'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', DEV_AUTH_EMAIL: 'me@example.com' }

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

describe('handleRequest (router + Access gate)', () => {
  it('answers CORS preflight', async () => {
    const res = await handleRequest(
      new Request('https://worker.test/api/auth', {
        method: 'OPTIONS',
        headers: { origin: 'https://app.example' },
      }),
      env,
      makeApi(),
    )

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
  })

  it('routes POST /api/auth when local Access bypass is configured', async () => {
    const res = await handleRequest(
      new Request('https://worker.test/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://app.example' },
        body: JSON.stringify({ room: 'r1' }),
      }),
      env,
      makeApi(),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: 'tok-r1' })
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy()
  })

  it('rejects protected routes without Access identity', async () => {
    const prodEnv: Env = {
      LIVEBLOCKS_SECRET_KEY: 'sk_test',
      ACCESS_TEAM_DOMAIN: 'https://team.cloudflareaccess.com',
      ACCESS_AUD: 'aud',
    }
    const res = await handleRequest(
      new Request('https://worker.test/api/trip/room1', { method: 'GET' }),
      prodEnv,
      makeApi(),
    )
    expect(res.status).toBe(401)
  })

  it('returns server misconfigured when a protected request has an Access token but no Access env', async () => {
    const res = await handleRequest(
      new Request('https://worker.test/api/trip/room1', {
        method: 'GET',
        headers: { 'cf-access-jwt-assertion': 'fake', origin: 'https://app.example' },
      }),
      { LIVEBLOCKS_SECRET_KEY: 'sk_test' },
      makeApi(),
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'server misconfigured' })
  })

  it('keeps schema public', async () => {
    const res = await handleRequest(
      new Request('https://worker.test/api/schema', { method: 'GET' }),
      { LIVEBLOCKS_SECRET_KEY: 'sk_test' },
      makeApi(),
    )
    expect(res.status).toBe(200)
  })

  it('routes /api/rooms, /api/versions, and /mcp behind the same local identity', async () => {
    const roomRes = await handleRequest(
      new Request('https://worker.test/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: 'new-room' }),
      }),
      env,
      makeApi({ roomExists: async () => false }),
    )
    expect(roomRes.status).toBe(201)

    const versionsRes = await handleRequest(
      new Request('https://worker.test/api/versions/room1', { method: 'GET' }),
      env,
      makeApi(),
    )
    expect(versionsRes.status).toBe(200)

    const mcpRes = await handleRequest(
      new Request('https://worker.test/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      env,
      makeApi(),
    )
    expect(mcpRes.status).toBe(200)
  })

  it('returns 404 for unknown routes and 405 for wrong methods', async () => {
    expect(
      await handleRequest(new Request('https://worker.test/api/nope'), env, makeApi()),
    ).toHaveProperty('status', 404)
    expect(
      await handleRequest(new Request('https://worker.test/mcp', { method: 'GET' }), env, makeApi()),
    ).toHaveProperty('status', 405)
  })
})

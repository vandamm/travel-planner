// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { handleAuth } from './auth'
import { signToken } from './token'
import type { Env, LiveblocksApi } from './liveblocks'
import type { TokenPayload } from '../../src/data/token'

const SECRET = 'test-signing-secret'
const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', TOKEN_SECRET: SECRET, OWNER_SECRET: 'owner-pw' }

interface MintCall {
  roomId: string
  userId: string
  opts: { access: 'room:read' | 'room:write'; name?: string }
}

function makeApi(overrides: Partial<LiveblocksApi> = {}): { api: LiveblocksApi; mints: MintCall[] } {
  const mints: MintCall[] = []
  const api: LiveblocksApi = {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (roomId, userId, opts) => {
      mints.push({ roomId, userId, opts })
      return `tok-for-${roomId}`
    },
    getYUpdate: async () => new Uint8Array(),
    sendYUpdate: async () => {},
    ...overrides,
  }
  return { api, mints }
}

async function authRequest(payload: TokenPayload, userId?: string): Promise<Request> {
  const token = await signToken(payload, SECRET)
  return new Request('https://worker.test/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, ...(userId ? { userId } : {}) }),
  })
}

function rawRequest(body: unknown): Request {
  return new Request('https://worker.test/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('handleAuth', () => {
  it('mints a room:read scoped token for a view token', async () => {
    const { api, mints } = makeApi()
    const res = await handleAuth(await authRequest({ r: 'paris-2026', p: 'view', v: 1 }), env, api)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ token: 'tok-for-paris-2026' })
    expect(mints).toHaveLength(1)
    expect(mints[0].roomId).toBe('paris-2026')
    expect(mints[0].opts.access).toBe('room:read')
  })

  it('mints a room:write scoped token for an edit token', async () => {
    const { api, mints } = makeApi()
    const res = await handleAuth(await authRequest({ r: 'r1', p: 'edit', v: 1 }), env, api)
    expect(res.status).toBe(200)
    expect(mints[0].opts.access).toBe('room:write')
  })

  it('mints a room:write scoped token for an owner token', async () => {
    const { api, mints } = makeApi()
    const res = await handleAuth(await authRequest({ r: 'r1', p: 'owner', v: 1 }), env, api)
    expect(res.status).toBe(200)
    expect(mints[0].opts.access).toBe('room:write')
  })

  it('forwards the token name into the mint call (for presence)', async () => {
    const { api, mints } = makeApi()
    await handleAuth(await authRequest({ r: 'r1', p: 'edit', n: 'Alex', v: 1 }), env, api)
    expect(mints[0].opts.name).toBe('Alex')
  })

  it('rejects an invalid (unsigned/tampered) token with 401', async () => {
    const { api, mints } = makeApi()
    const res = await handleAuth(rawRequest({ token: 'garbage.notasignature' }), env, api)
    expect(res.status).toBe(401)
    expect(mints).toHaveLength(0)
  })

  it('rejects a token signed with the wrong key with 401', async () => {
    const { api, mints } = makeApi()
    const token = await signToken({ r: 'r1', p: 'edit', v: 1 }, 'other-secret')
    const res = await handleAuth(rawRequest({ token }), env, api)
    expect(res.status).toBe(401)
    expect(mints).toHaveLength(0)
  })

  it('rejects an absent token with 401', async () => {
    const { api } = makeApi()
    const res = await handleAuth(rawRequest({}), env, api)
    expect(res.status).toBe(401)
  })

  it('denies a room that does not exist with 403', async () => {
    const { api, mints } = makeApi({ roomExists: async () => false })
    const res = await handleAuth(await authRequest({ r: 'ghost', p: 'owner', v: 1 }), env, api)
    expect(res.status).toBe(403)
    expect(mints).toHaveLength(0)
  })

  it('rejects a malformed JSON body with 400', async () => {
    const { api } = makeApi()
    const res = await handleAuth(rawRequest('not json'), env, api)
    expect(res.status).toBe(400)
  })
})

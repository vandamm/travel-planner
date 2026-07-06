// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { handleCreateRoom } from './rooms'
import { signToken, verifyToken } from './token'
import type { Env, LiveblocksApi } from './liveblocks'
import type { Perm, TokenPayload } from '../../src/data/token'

const SECRET = 'test-token-secret'
const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', TOKEN_SECRET: SECRET, OWNER_SECRET: 'owner-pw' }

function makeApi(overrides: Partial<LiveblocksApi> = {}): LiveblocksApi {
  return {
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async () => 'token-123',
    getYUpdate: async () => new Uint8Array(),
    sendYUpdate: async () => {},
    ...overrides,
  }
}

async function roomRequest(body: unknown, token?: string): Promise<Request> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== undefined) headers['authorization'] = `Bearer ${token}`
  return new Request('https://worker.test/api/rooms', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

function ownerToken(payload: Partial<TokenPayload> = {}): Promise<string> {
  return signToken({ r: 'genesis', p: 'owner', v: 1, ...payload }, SECRET)
}

describe('handleCreateRoom', () => {
  it('returns 401 when no token is presented', async () => {
    let created = false
    const api = makeApi({
      createRoom: async (id) => {
        created = true
        return { id }
      },
    })

    const res = await handleCreateRoom(await roomRequest({ room: 'new-room' }), env, api)

    expect(res.status).toBe(401)
    expect(created).toBe(false)
  })

  it('returns 401 for an invalid/tampered token', async () => {
    const res = await handleCreateRoom(await roomRequest({ room: 'new-room' }, 'garbage.sig'), env, makeApi())
    expect(res.status).toBe(401)
  })

  it('returns 401 for a token signed with the wrong key', async () => {
    const token = await signToken({ r: 'genesis', p: 'owner', v: 1 }, 'other-secret')
    const res = await handleCreateRoom(await roomRequest({ room: 'new-room' }, token), env, makeApi())
    expect(res.status).toBe(401)
  })

  it.each(['view', 'edit'] as Perm[])('returns 401 for a non-owner (%s) token', async (perm) => {
    let created = false
    const api = makeApi({
      createRoom: async (id) => {
        created = true
        return { id }
      },
    })
    const token = await signToken({ r: 'r1', p: perm, v: 1 }, SECRET)
    const res = await handleCreateRoom(await roomRequest({ room: 'new-room' }, token), env, api)

    expect(res.status).toBe(401)
    expect(created).toBe(false)
  })

  it('creates the room and returns id + a fresh owner token for an owner token', async () => {
    let createdId: string | undefined
    const api = makeApi({
      createRoom: async (id) => {
        createdId = id
        return { id }
      },
    })

    const res = await handleCreateRoom(await roomRequest({ room: 'rome-2027' }, await ownerToken()), env, api)

    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; token: string }
    expect(body.id).toBe('rome-2027')
    expect(createdId).toBe('rome-2027')

    // The returned token must be a valid owner token for the new room.
    const minted = await verifyToken(body.token, SECRET)
    expect(minted).toMatchObject({ r: 'rome-2027', p: 'owner', v: 1 })
  })

  it('generates a room id when none is supplied', async () => {
    let createdId: string | undefined
    const api = makeApi({
      createRoom: async (id) => {
        createdId = id
        return { id }
      },
    })

    const res = await handleCreateRoom(await roomRequest({}, await ownerToken()), env, api)

    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; token: string }
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
    expect(body.id).toBe(createdId)
    const minted = await verifyToken(body.token, SECRET)
    expect(minted).toMatchObject({ r: body.id, p: 'owner' })
  })
})

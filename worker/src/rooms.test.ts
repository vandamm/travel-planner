// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { handleCreateRoom } from './rooms'
import type { Env, LiveblocksApi } from './liveblocks'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', OWNER_SECRET: 'owner-pw' }

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

function roomRequest(body: unknown, ownerSecret?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (ownerSecret !== undefined) headers['x-owner-secret'] = ownerSecret
  return new Request('https://worker.test/api/rooms', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('handleCreateRoom', () => {
  it('returns 401 when no owner secret is presented', async () => {
    let created = false
    const api = makeApi({
      createRoom: async (id) => {
        created = true
        return { id }
      },
    })

    const res = await handleCreateRoom(roomRequest({ room: 'new-room' }), env, api)

    expect(res.status).toBe(401)
    expect(created).toBe(false)
  })

  it('returns 401 when the owner secret is wrong', async () => {
    const res = await handleCreateRoom(roomRequest({ room: 'new-room' }, 'wrong'), env, makeApi())
    expect(res.status).toBe(401)
  })

  it('creates the room and returns its id with the correct owner secret', async () => {
    let createdId: string | undefined
    const api = makeApi({
      createRoom: async (id) => {
        createdId = id
        return { id }
      },
    })

    const res = await handleCreateRoom(roomRequest({ room: 'rome-2027' }, 'owner-pw'), env, api)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'rome-2027' })
    expect(createdId).toBe('rome-2027')
  })

  it('generates a room id when none is supplied', async () => {
    let createdId: string | undefined
    const api = makeApi({
      createRoom: async (id) => {
        createdId = id
        return { id }
      },
    })

    const res = await handleCreateRoom(roomRequest({}, 'owner-pw'), env, api)

    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string }
    expect(typeof body.id).toBe('string')
    expect(body.id.length).toBeGreaterThan(0)
    expect(body.id).toBe(createdId)
  })
})

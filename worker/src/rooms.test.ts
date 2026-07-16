// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { handleCreateRoom, handleListRooms } from './rooms'
import type { Env, LiveblocksApi } from './liveblocks'
import { getTrip, setTrip } from '../../src/data/doc'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', DEV_AUTH_EMAIL: 'me@example.com' }

function makeApi(overrides: Partial<LiveblocksApi> = {}): {
  api: LiveblocksApi
  created: string[]
} {
  const created: string[] = []
  return {
    created,
    api: {
      listRooms: async () => ({ rooms: [], nextCursor: null }),
      roomExists: async () => false,
      createRoom: async (id) => {
        created.push(id)
        return { id }
      },
      mintAccessToken: async () => 'token-123',
      getYUpdate: async () => new Uint8Array(),
      sendYUpdate: async () => {},
      ...overrides,
    },
  }
}

function roomRequest(body: unknown): Request {
  return new Request('https://worker.test/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('handleCreateRoom', () => {
  it('creates a complete slug room and returns its id', async () => {
    const { api, created } = makeApi()
    const res = await handleCreateRoom(roomRequest({
      room: 'rome-2027',
      title: 'Rome',
      startDate: '2027-05-04',
      endDate: '2027-05-10',
    }), env, api)

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'rome-2027' })
    expect(created).toEqual(['rome-2027'])
  })

  it('stores a stable homepage colour when it creates a room', async () => {
    let update = new Uint8Array()
    const { api } = makeApi({
      sendYUpdate: async (_id, next) => {
        update = next
      },
    })
    await handleCreateRoom(roomRequest({
      room: 'rome-2027',
      title: 'Rome',
      startDate: '2027-05-04',
      endDate: '2027-05-10',
      color: '#5f6f44',
    }), env, api)
    const doc = new Y.Doc()
    Y.applyUpdate(doc, update)
    expect(getTrip(doc).color).toBe('#5f6f44')
  })

  it('stores the complete trip payload in the initial room update', async () => {
    let update = new Uint8Array()
    const { api } = makeApi({
      sendYUpdate: async (_id, next) => {
        update = next
      },
    })
    await handleCreateRoom(roomRequest({
      room: 'rome-2027',
      title: 'Roman Holiday',
      startDate: '2027-05-04',
      endDate: '2027-05-12',
    }), env, api)
    const doc = new Y.Doc()
    Y.applyUpdate(doc, update)
    expect(getTrip(doc)).toMatchObject({
      title: 'Roman Holiday',
      startDate: '2027-05-04',
      endDate: '2027-05-12',
    })
  })

  it.each([
    { room: 'rome-2027', title: '', startDate: '2027-05-04', endDate: '2027-05-10' },
    { room: 'rome-2027', title: 'Rome', startDate: '', endDate: '2027-05-10' },
    { room: 'rome-2027', title: 'Rome', startDate: '2027-05-11', endDate: '2027-05-10' },
    { room: 'rome-2027', title: 'Rome', startDate: '2027-02-30', endDate: '2027-03-01' },
  ])('rejects an incomplete or invalid trip before creating its room', async (body) => {
    const { api, created } = makeApi()
    const res = await handleCreateRoom(roomRequest(body), env, api)
    expect(res.status).toBe(400)
    expect(created).toEqual([])
  })

  it('rejects a null JSON body before creating a room', async () => {
    const { api, created } = makeApi()
    const res = await handleCreateRoom(roomRequest(null), env, api)
    expect(res.status).toBe(400)
    expect(created).toEqual([])
  })

  it('rejects invalid slugs', async () => {
    const { api, created } = makeApi()
    const res = await handleCreateRoom(roomRequest({
      room: 'Rome_2027',
      title: 'Rome',
      startDate: '2027-05-04',
      endDate: '2027-05-10',
    }), env, api)
    expect(res.status).toBe(400)
    expect(created).toEqual([])
  })

  it('rejects duplicate rooms', async () => {
    const { api, created } = makeApi({ roomExists: async () => true })
    const res = await handleCreateRoom(roomRequest({
      room: 'rome-2027',
      title: 'Rome',
      startDate: '2027-05-04',
      endDate: '2027-05-10',
    }), env, api)
    expect(res.status).toBe(409)
    expect(created).toEqual([])
  })

  it('rejects malformed JSON', async () => {
    const { api } = makeApi()
    const res = await handleCreateRoom(roomRequest('not json'), env, api)
    expect(res.status).toBe(400)
  })
})

describe('handleListRooms', () => {
  it('returns a page of valid calendar summaries and skips one bad room', async () => {
    const doc = new Y.Doc()
    setTrip(doc, { title: 'Japan', startDate: '2028-02-28', endDate: '2028-03-01' })
    const { api } = makeApi({
      listRooms: async (cursor) => {
        expect(cursor).toBe('page-1')
        return {
          rooms: [
            { id: 'japan-2028', createdAt: '2027-01-01T00:00:00Z' },
            { id: 'Bad_room', createdAt: '2027-01-01T00:00:00Z' },
            { id: 'broken-room', createdAt: '2027-01-01T00:00:00Z' },
          ],
          nextCursor: 'page-2',
        }
      },
      getYUpdate: async (id) => {
        if (id === 'broken-room') throw new Error('corrupt room')
        if (id === 'Bad_room') throw new Error('invalid IDs must not be fetched')
        return Y.encodeStateAsUpdate(doc)
      },
    })

    const res = await handleListRooms(
      new Request('https://worker.test/api/rooms?cursor=page-1'),
      api,
    )

    expect(await res.json()).toEqual({
      trips: [expect.objectContaining({ id: 'japan-2028', title: 'Japan' })],
      nextCursor: 'page-2',
    })
  })
})

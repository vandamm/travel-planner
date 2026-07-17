// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  handleGetSchema,
  handleGetTrip,
  handleGetVersion,
  handleListVersions,
  handlePostTrip,
} from './trip'
import { recordSnapshot, type SnapshotKv } from './snapshots'
import type { Env, LiveblocksApi } from './liveblocks'
import { addCard, addCity, setTrip } from '../../src/data/doc'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', DEV_AUTH_EMAIL: 'me@example.com' }

function makeKv(): SnapshotKv & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    get: async (key) => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value)
    },
    list: async ({ prefix }) => ({
      keys: [...store.keys()].filter((n) => n.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    }),
  }
}

function makeApi(
  seed?: Y.Doc,
  overrides: Partial<LiveblocksApi> = {},
): LiveblocksApi & {
  sentCount(): number
} {
  let state: Uint8Array = seed ? Y.encodeStateAsUpdate(seed) : new Uint8Array()
  let sent = 0
  return {
    listRooms: async () => ({ rooms: [], nextCursor: null }),
    roomExists: async () => true,
    createRoom: async (id) => ({ id }),
    mintAccessToken: async (room) => `tok-${room}`,
    getYUpdate: async () => state,
    sendYUpdate: async (_room, update) => {
      sent += 1
      const doc = new Y.Doc()
      if (state.byteLength > 0) Y.applyUpdate(doc, state)
      Y.applyUpdate(doc, update)
      state = Y.encodeStateAsUpdate(doc)
    },
    sentCount: () => sent,
    ...overrides,
  }
}

function seededDoc(): Y.Doc {
  const doc = new Y.Doc()
  setTrip(doc, { title: 'Seed Trip', startDate: '2027-01-01', endDate: '2027-01-02' })
  addCity(doc, { id: 'c1', name: 'Paris', color: '#0000ff' })
  addCard(doc, { id: 'k1', dayKey: '2027-01-01', title: 'Louvre' })
  return doc
}

function tripRequest(method: string, body?: unknown): Request {
  return new Request('https://worker.test/api/trip/room1', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function versionRequest(path = '/api/versions/room1'): Request {
  return new Request(`https://worker.test${path}`, { method: 'GET' })
}

const validTrip = {
  trip: { title: 'Italy', startDate: '2027-05-01', endDate: '2027-05-03', dayStart: '06:00', dayEnd: '21:00' },
  cities: [{ id: 'c2', name: 'Rome', color: '#ff0000' }],
  accommodations: [],
  cards: [{ id: 'k2', dayKey: '2027-05-01', title: 'Colosseum', order: 0, duration: 'custom', durationHours: 1 }],
  dayOverrides: {},
}

describe('trip HTTP handlers', () => {
  it('serializes a slug room to trip JSON', async () => {
    const res = await handleGetTrip(tripRequest('GET'), env, makeApi(seededDoc()), 'room1')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { trip: { title: string }; cities: unknown[] }
    expect(body.trip.title).toBe('Seed Trip')
    expect(body.cities).toHaveLength(1)
  })

  it('rejects invalid slugs and unknown rooms', async () => {
    expect(await handleGetTrip(tripRequest('GET'), env, makeApi(), 'Bad_room')).toHaveProperty(
      'status',
      400,
    )
    expect(
      await handleGetTrip(
        tripRequest('GET'),
        env,
        makeApi(undefined, { roomExists: async () => false }),
        'room1',
      ),
    ).toHaveProperty('status', 404)
  })

  it('publishes the JSON Schema', async () => {
    const res = await handleGetSchema()
    expect(res.status).toBe(200)
    const schema = JSON.stringify(await res.json())
    expect(schema).toContain('"trip"')
    expect(schema).toContain('"minimum":0.25')
    expect(schema).toContain('"multipleOf":0.25')
  })

  it('validates and applies a trip, snapshotting previous state when KV is bound', async () => {
    const kv = makeKv()
    const api = makeApi(seededDoc())
    const res = await handlePostTrip(
      tripRequest('POST', validTrip),
      { ...env, SNAPSHOTS: kv },
      api,
      'room1',
    )

    expect(res.status).toBe(200)
    expect(api.sentCount()).toBe(1)
    expect(kv.store.size).toBe(1)
    expect(await res.json()).toMatchObject({ trip: { title: 'Italy' } })
  })

  it('rejects invalid trip JSON without mutating', async () => {
    const api = makeApi(seededDoc())
    const res = await handlePostTrip(tripRequest('POST', { nope: true }), env, api, 'room1')
    expect(res.status).toBe(400)
    expect(api.sentCount()).toBe(0)
  })

  it('lists and returns snapshots for a slug room', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', JSON.stringify(validTrip), 1000)

    const list = await handleListVersions(
      versionRequest(),
      { ...env, SNAPSHOTS: kv },
      makeApi(),
      'room1',
    )
    expect(list.status).toBe(200)
    const body = (await list.json()) as { versions: Array<{ id: string }> }
    expect(body.versions).toHaveLength(1)

    const one = await handleGetVersion(
      versionRequest(`/api/versions/room1/${body.versions[0].id}`),
      { ...env, SNAPSHOTS: kv },
      makeApi(),
      'room1',
      body.versions[0].id,
    )
    expect(one.status).toBe(200)
    expect(await one.json()).toMatchObject({ trip: { title: 'Italy' } })
  })

  it('returns empty history when KV is unbound', async () => {
    const res = await handleListVersions(versionRequest(), env, makeApi(), 'room1')
    expect(await res.json()).toEqual({ versions: [] })
  })
})

// @vitest-environment node
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { handleGetTrip, handlePostTrip } from './trip'
import type { Env, LiveblocksApi } from './liveblocks'
import { addCard, addCity, setTrip } from '../../src/data/doc'

const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', OWNER_SECRET: 'owner-pw' }

/**
 * A fake Liveblocks backend that keeps the room's Yjs state in memory. `getYUpdate`
 * returns the encoded state and `sendYUpdate` merges the update back in, so a
 * GET/POST round-trip exercises the real serialize + apply path end to end —
 * including that a POST's diff update correctly deletes entities the new trip drops.
 */
function makeApi(seed?: Y.Doc, overrides: Partial<LiveblocksApi> = {}): LiveblocksApi {
  let state: Uint8Array = seed ? Y.encodeStateAsUpdate(seed) : new Uint8Array()
  let sent = 0
  const api: LiveblocksApi & { sentCount(): number } = {
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
  return api
}

function tripRequest(method: string, body?: unknown, ownerSecret?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (ownerSecret !== undefined) headers['x-owner-secret'] = ownerSecret
  return new Request('https://worker.test/api/trip/room1', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function seededDoc(): Y.Doc {
  const doc = new Y.Doc()
  setTrip(doc, { title: 'Seed Trip', startDate: '2027-01-01', numDays: 2 })
  addCity(doc, { id: 'c1', name: 'Paris', color: '#0000ff' })
  addCard(doc, { id: 'k1', dayKey: '2027-01-01', title: 'Louvre' })
  return doc
}

const validTrip = {
  trip: { title: 'Italy', startDate: '2027-05-01', numDays: 3 },
  cities: [{ id: 'c2', name: 'Rome', color: '#ff0000' }],
  accommodations: [],
  cards: [{ id: 'k2', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
  dayOverrides: {},
}

describe('handleGetTrip', () => {
  it('serializes the room Yjs doc to trip JSON with the owner secret', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, 'owner-pw'), env, makeApi(seededDoc()), 'room1')

    expect(res.status).toBe(200)
    const body = (await res.json()) as { trip: unknown; cities: unknown[]; cards: unknown[] }
    expect(body.trip).toEqual({ title: 'Seed Trip', startDate: '2027-01-01', numDays: 2 })
    expect(body.cities).toEqual([{ id: 'c1', name: 'Paris', color: '#0000ff' }])
    expect(body.cards).toEqual([{ id: 'k1', dayKey: '2027-01-01', title: 'Louvre', order: 0 }])
  })

  it('returns an empty-but-valid trip for a room with no Yjs data yet', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, 'owner-pw'), env, makeApi(), 'room1')

    expect(res.status).toBe(200)
    const body = (await res.json()) as { trip: unknown; cities: unknown[] }
    expect(body.trip).toEqual({ title: '', startDate: '', numDays: 0 })
    expect(body.cities).toEqual([])
  })

  it('rejects without the owner secret (401)', async () => {
    const res = await handleGetTrip(tripRequest('GET'), env, makeApi(seededDoc()), 'room1')
    expect(res.status).toBe(401)
  })

  it('returns 404 for a room that does not exist', async () => {
    const api = makeApi(seededDoc(), { roomExists: async () => false })
    const res = await handleGetTrip(tripRequest('GET', undefined, 'owner-pw'), env, api, 'room1')
    expect(res.status).toBe(404)
  })
})

describe('handlePostTrip', () => {
  it('validates and applies a trip, pushing the update to Liveblocks', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip, 'owner-pw'), env, api, 'room1')

    expect(res.status).toBe(200)
    expect(api.sentCount()).toBe(1)

    // A follow-up GET reflects the applied trip.
    const after = await handleGetTrip(tripRequest('GET', undefined, 'owner-pw'), env, api, 'room1')
    const body = (await after.json()) as { trip: unknown; cities: unknown[]; cards: unknown[] }
    expect(body.trip).toEqual(validTrip.trip)
    expect(body.cities).toEqual(validTrip.cities)
    expect(body.cards).toEqual(validTrip.cards)
  })

  it('full-replaces existing data — entities dropped by the new trip disappear', async () => {
    const api = makeApi(seededDoc())
    await handlePostTrip(tripRequest('POST', validTrip, 'owner-pw'), env, api, 'room1')

    const after = await handleGetTrip(tripRequest('GET', undefined, 'owner-pw'), env, api, 'room1')
    const body = (await after.json()) as { cities: Array<{ id: string }>; cards: Array<{ id: string }> }
    expect(body.cities.map((c) => c.id)).toEqual(['c2'])
    expect(body.cards.map((c) => c.id)).toEqual(['k2'])
  })

  it('rejects without the owner secret (401) and does not mutate', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip), env, api, 'room1')
    expect(res.status).toBe(401)
    expect(api.sentCount()).toBe(0)
  })

  it('returns 400 for malformed JSON', async () => {
    const bad = new Request('https://worker.test/api/trip/room1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-owner-secret': 'owner-pw' },
      body: 'not json',
    })
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(bad, env, api, 'room1')
    expect(res.status).toBe(400)
    expect(api.sentCount()).toBe(0)
  })

  it('returns 400 for JSON that fails schema validation', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(
      tripRequest('POST', { trip: { title: 'x', startDate: 'nope', numDays: -1 } }, 'owner-pw'),
      env,
      api,
      'room1',
    )
    expect(res.status).toBe(400)
    expect(api.sentCount()).toBe(0)
  })

  it('returns 404 for a room that does not exist', async () => {
    const api = makeApi(undefined, { roomExists: async () => false }) as LiveblocksApi & {
      sentCount(): number
    }
    const res = await handlePostTrip(tripRequest('POST', validTrip, 'owner-pw'), env, api, 'room1')
    expect(res.status).toBe(404)
    expect(api.sentCount()).toBe(0)
  })
})

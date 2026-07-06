// @vitest-environment node
import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import {
  handleGetSchema,
  handleGetTrip,
  handleGetVersion,
  handleListVersions,
  handlePostTrip,
} from './trip'
import { signToken } from './token'
import type { Env, LiveblocksApi } from './liveblocks'
import { recordSnapshot, type SnapshotKv } from './snapshots'
import { addCard, addCity, setTrip } from '../../src/data/doc'

const SECRET = 'test-token-secret'
const env: Env = { LIVEBLOCKS_SECRET_KEY: 'sk_test', TOKEN_SECRET: SECRET }

// Capability tokens scoped to `room1` (the room every request below targets), plus
// one scoped to a different room to prove the token's room must match `:room`.
const viewTok = await signToken({ r: 'room1', p: 'view', v: 1 }, SECRET)
const editTok = await signToken({ r: 'room1', p: 'edit', v: 1 }, SECRET)
const ownerTok = await signToken({ r: 'room1', p: 'owner', v: 1 }, SECRET)
const otherRoomTok = await signToken({ r: 'other-room', p: 'owner', v: 1 }, SECRET)

/** In-memory KV fake — the small slice `snapshots.ts` uses. */
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

/** A request to /api/trip/room1 carrying `token` as a Bearer credential (omit for none). */
function tripRequest(method: string, body?: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token !== undefined) headers['authorization'] = `Bearer ${token}`
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
  trip: { title: 'Italy', startDate: '2027-05-01', numDays: 3, dayStart: '06:00', dayEnd: '21:00' },
  cities: [{ id: 'c2', name: 'Rome', color: '#ff0000' }],
  accommodations: [],
  cards: [{ id: 'k2', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
  dayOverrides: {},
}

describe('handleGetTrip', () => {
  it('serializes the room Yjs doc to trip JSON with a view token', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, viewTok), env, makeApi(seededDoc()), 'room1')

    expect(res.status).toBe(200)
    const body = (await res.json()) as { trip: unknown; cities: unknown[]; cards: unknown[] }
    expect(body.trip).toEqual({
      title: 'Seed Trip',
      startDate: '2027-01-01',
      numDays: 2,
      dayStart: '06:00',
      dayEnd: '21:00',
    })
    expect(body.cities).toEqual([{ id: 'c1', name: 'Paris', color: '#0000ff' }])
    expect(body.cards).toEqual([{ id: 'k1', dayKey: '2027-01-01', title: 'Louvre', order: 0 }])
  })

  it('accepts an edit or owner token too (view+ grants read)', async () => {
    for (const tok of [editTok, ownerTok]) {
      const res = await handleGetTrip(tripRequest('GET', undefined, tok), env, makeApi(seededDoc()), 'room1')
      expect(res.status).toBe(200)
    }
  })

  it('returns an empty-but-valid trip for a room with no Yjs data yet', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, viewTok), env, makeApi(), 'room1')

    expect(res.status).toBe(200)
    const body = (await res.json()) as { trip: unknown; cities: unknown[] }
    expect(body.trip).toEqual({ title: '', startDate: '', numDays: 0, dayStart: '06:00', dayEnd: '21:00' })
    expect(body.cities).toEqual([])
  })

  it('points an empty trip at the schema endpoint via $schema so an agent learns the shape', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, viewTok), env, makeApi(), 'room1')
    const body = (await res.json()) as { $schema: string }
    expect(body.$schema).toBe('https://worker.test/api/schema')
  })

  it('rejects without a token (401)', async () => {
    const res = await handleGetTrip(tripRequest('GET'), env, makeApi(seededDoc()), 'room1')
    expect(res.status).toBe(401)
  })

  it('rejects an invalid/tampered token (401)', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, 'garbage.sig'), env, makeApi(seededDoc()), 'room1')
    expect(res.status).toBe(401)
  })

  it('rejects a token scoped to a different room (401)', async () => {
    const res = await handleGetTrip(tripRequest('GET', undefined, otherRoomTok), env, makeApi(seededDoc()), 'room1')
    expect(res.status).toBe(401)
  })

  it('returns 404 for a room that does not exist', async () => {
    const api = makeApi(seededDoc(), { roomExists: async () => false })
    const res = await handleGetTrip(tripRequest('GET', undefined, viewTok), env, api, 'room1')
    expect(res.status).toBe(404)
  })
})

describe('handleGetSchema', () => {
  it('returns the JSON Schema derived from the trip document schema — no token required', async () => {
    const res = await handleGetSchema()
    expect(res.status).toBe(200)
    const body = (await res.json()) as { type?: string; properties?: Record<string, unknown> }
    expect(body.type).toBe('object')
    // Derived from tripDocumentSchema — the same single source of truth, not a duplicate.
    expect(Object.keys(body.properties ?? {})).toEqual(
      expect.arrayContaining(['trip', 'cities', 'accommodations', 'cards', 'dayOverrides']),
    )
  })
})

describe('handlePostTrip', () => {
  it('validates and applies a trip with an edit token, pushing the update to Liveblocks', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip, editTok), env, api, 'room1')

    expect(res.status).toBe(200)
    expect(api.sentCount()).toBe(1)

    // A follow-up GET reflects the applied trip.
    const after = await handleGetTrip(tripRequest('GET', undefined, viewTok), env, api, 'room1')
    const body = (await after.json()) as { trip: unknown; cities: unknown[]; cards: unknown[] }
    expect(body.trip).toEqual(validTrip.trip)
    expect(body.cities).toEqual(validTrip.cities)
    expect(body.cards).toEqual(validTrip.cards)
  })

  it('accepts an owner token too (edit+ grants write)', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip, ownerTok), env, api, 'room1')
    expect(res.status).toBe(200)
    expect(api.sentCount()).toBe(1)
  })

  it('rejects a view-only token (401) and does not mutate', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip, viewTok), env, api, 'room1')
    expect(res.status).toBe(401)
    expect(api.sentCount()).toBe(0)
  })

  it('rejects a token scoped to a different room (401) and does not mutate', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip, otherRoomTok), env, api, 'room1')
    expect(res.status).toBe(401)
    expect(api.sentCount()).toBe(0)
  })

  it('full-replaces existing data — entities dropped by the new trip disappear', async () => {
    const api = makeApi(seededDoc())
    await handlePostTrip(tripRequest('POST', validTrip, editTok), env, api, 'room1')

    const after = await handleGetTrip(tripRequest('GET', undefined, viewTok), env, api, 'room1')
    const body = (await after.json()) as { cities: Array<{ id: string }>; cards: Array<{ id: string }> }
    expect(body.cities.map((c) => c.id)).toEqual(['c2'])
    expect(body.cards.map((c) => c.id)).toEqual(['k2'])
  })

  it('rejects without a token (401) and does not mutate', async () => {
    const api = makeApi() as LiveblocksApi & { sentCount(): number }
    const res = await handlePostTrip(tripRequest('POST', validTrip), env, api, 'room1')
    expect(res.status).toBe(401)
    expect(api.sentCount()).toBe(0)
  })

  it('returns 400 for malformed JSON', async () => {
    const bad = new Request('https://worker.test/api/trip/room1', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${editTok}` },
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
      tripRequest('POST', { trip: { title: 'x', startDate: 'nope', numDays: -1 } }, editTok),
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
    const res = await handlePostTrip(tripRequest('POST', validTrip, editTok), env, api, 'room1')
    expect(res.status).toBe(404)
    expect(api.sentCount()).toBe(0)
  })

  it('records a pre-write snapshot of the current trip before applying', async () => {
    const kv = makeKv()
    const api = makeApi(seededDoc())
    await handlePostTrip(tripRequest('POST', validTrip, editTok), { ...env, SNAPSHOTS: kv }, api, 'room1')

    const snapshots = [...kv.store.values()]
    expect(snapshots).toHaveLength(1)
    // The snapshot captures the state *before* the write (the seed), not the new trip.
    expect((JSON.parse(snapshots[0]) as { trip: { title: string } }).trip.title).toBe('Seed Trip')
  })

  it('records no snapshot when the payload fails validation', async () => {
    const kv = makeKv()
    const api = makeApi(seededDoc())
    const res = await handlePostTrip(
      tripRequest('POST', { trip: { title: 'x', startDate: 'nope', numDays: -1 } }, editTok),
      { ...env, SNAPSHOTS: kv },
      api,
      'room1',
    )
    expect(res.status).toBe(400)
    expect(kv.store.size).toBe(0)
  })

  it('still writes (skipping the snapshot) when the current state is unserializable', async () => {
    // Simulate the post-merge dangling reference a concurrent remove-city can
    // leave: a dayOverride pointing at a city that no longer exists, which makes
    // `exportTrip` throw. The corrective write must still land.
    const seed = seededDoc()
    seed.getMap('dayOverrides').set('2027-01-01', 'ghost-city')
    const kv = makeKv()
    const api = makeApi(seed) as LiveblocksApi & { sentCount(): number }

    const res = await handlePostTrip(tripRequest('POST', validTrip, editTok), { ...env, SNAPSHOTS: kv }, api, 'room1')

    expect(res.status).toBe(200)
    expect(api.sentCount()).toBe(1)
    // The unserializable snapshot was skipped, not thrown.
    expect(kv.store.size).toBe(0)
  })

  it('still writes when the KV snapshot put fails (transient outage)', async () => {
    // Snapshotting is best-effort: a KV write error must not take down the write
    // path — otherwise write_board, the tool used to repair a board, would 502.
    const kv = makeKv()
    kv.put = async () => {
      throw new Error('KV unavailable')
    }
    const api = makeApi(seededDoc()) as LiveblocksApi & { sentCount(): number }

    const res = await handlePostTrip(tripRequest('POST', validTrip, editTok), { ...env, SNAPSHOTS: kv }, api, 'room1')

    expect(res.status).toBe(200)
    expect(api.sentCount()).toBe(1)
  })
})

describe('version history (link-gated)', () => {
  it('lists a room’s snapshots newest first — no owner secret needed', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', '{"trip":{"title":"v1"}}', 1000)
    await recordSnapshot(kv, 'room1', '{"trip":{"title":"v2"}}', 2000)

    const res = await handleListVersions({ ...env, SNAPSHOTS: kv }, makeApi(), 'room1')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { versions: Array<{ id: string; timestamp: number }> }
    expect(body.versions.map((v) => v.timestamp)).toEqual([2000, 1000])
  })

  it('returns an empty list when KV is not bound', async () => {
    const res = await handleListVersions(env, makeApi(), 'room1')
    expect(res.status).toBe(200)
    expect((await res.json()) as { versions: unknown[] }).toEqual({ versions: [] })
  })

  it('404s the list for a room that does not exist', async () => {
    const kv = makeKv()
    const api = makeApi(undefined, { roomExists: async () => false })
    const res = await handleListVersions({ ...env, SNAPSHOTS: kv }, api, 'room1')
    expect(res.status).toBe(404)
  })

  it('returns a single snapshot’s trip JSON verbatim', async () => {
    const kv = makeKv()
    const { id } = await recordSnapshot(kv, 'room1', '{"trip":{"title":"Snapshotted"}}', 1000)

    const res = await handleGetVersion({ ...env, SNAPSHOTS: kv }, makeApi(), 'room1', id)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect((await res.json()) as { trip: { title: string } }).toEqual({ trip: { title: 'Snapshotted' } })
  })

  it('404s an unknown snapshot id', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', '{"trip":{}}', 1000)
    const res = await handleGetVersion({ ...env, SNAPSHOTS: kv }, makeApi(), 'room1', '9999')
    expect(res.status).toBe(404)
  })

  it('404s a snapshot fetch for a room that does not exist', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', '{"trip":{}}', 1000)
    const api = makeApi(undefined, { roomExists: async () => false })
    const res = await handleGetVersion({ ...env, SNAPSHOTS: kv }, api, 'room1', '1000')
    expect(res.status).toBe(404)
  })

  it('round-trips a real pre-write snapshot: POST then restore its listed version', async () => {
    const kv = makeKv()
    const api = makeApi(seededDoc())
    // A write snapshots the seed ("Seed Trip") before replacing it with validTrip.
    await handlePostTrip(tripRequest('POST', validTrip, editTok), { ...env, SNAPSHOTS: kv }, api, 'room1')

    const list = (await (await handleListVersions({ ...env, SNAPSHOTS: kv }, api, 'room1')).json()) as {
      versions: Array<{ id: string }>
    }
    expect(list.versions).toHaveLength(1)

    const snap = (await (
      await handleGetVersion({ ...env, SNAPSHOTS: kv }, api, 'room1', list.versions[0].id)
    ).json()) as { trip: { title: string } }
    expect(snap.trip.title).toBe('Seed Trip')
  })
})

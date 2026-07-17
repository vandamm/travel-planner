// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { getSnapshot, listSnapshots, recordSnapshot, type SnapshotKv } from './snapshots'

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

describe('snapshot store', () => {
  it('records a snapshot and reads it back by id', async () => {
    const kv = makeKv()
    const { id } = await recordSnapshot(kv, 'room1', '{"trip":"a"}', 1000)
    expect(await getSnapshot(kv, 'room1', id)).toBe('{"trip":"a"}')
  })

  it('preserves a quarter-hour custom duration in snapshot JSON', async () => {
    const kv = makeKv()
    const json = JSON.stringify({ cards: [{ duration: 'custom', durationHours: 0.25 }] })
    const { id } = await recordSnapshot(kv, 'room1', json, 1000)
    expect(await getSnapshot(kv, 'room1', id)).toBe(json)
  })

  it('lists a room’s snapshots newest first with ids and timestamps', async () => {
    const kv = makeKv()
    const v1 = await recordSnapshot(kv, 'room1', 'v1', 1000)
    await recordSnapshot(kv, 'room1', 'v2', 2000)
    await recordSnapshot(kv, 'room1', 'v3', 3000)

    const list = await listSnapshots(kv, 'room1')
    expect(list.map((s) => s.timestamp)).toEqual([3000, 2000, 1000])
    // Each id carries its ms timestamp as a prefix (plus a uniqueness suffix).
    expect(list.every((s) => s.id.startsWith(`${s.timestamp}-`))).toBe(true)
    expect(await getSnapshot(kv, 'room1', v1.id)).toBe('v1')
  })

  it('keeps both snapshots when two writes land in the same millisecond', async () => {
    const kv = makeKv()
    const a = await recordSnapshot(kv, 'room1', 'first', 1000)
    const b = await recordSnapshot(kv, 'room1', 'second', 1000)
    // Distinct keys → neither overwrites the other; both rollback points survive.
    expect(a.id).not.toBe(b.id)
    expect(await getSnapshot(kv, 'room1', a.id)).toBe('first')
    expect(await getSnapshot(kv, 'room1', b.id)).toBe('second')
    expect((await listSnapshots(kv, 'room1')).length).toBe(2)
  })

  it('returns null for an unknown snapshot id', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', 'v1', 1000)
    expect(await getSnapshot(kv, 'room1', '9999')).toBeNull()
  })

  it('isolates rooms — one room’s list never bleeds into another', async () => {
    const kv = makeKv()
    const a = await recordSnapshot(kv, 'room1', 'a', 1000)
    await recordSnapshot(kv, 'room2', 'b', 1000)
    expect((await listSnapshots(kv, 'room1')).length).toBe(1)
    expect((await listSnapshots(kv, 'room2')).length).toBe(1)
    expect(await getSnapshot(kv, 'room1', a.id)).toBe('a')
  })

  it('does not confuse a room with another whose id is a prefix (a vs a:b)', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'a', 'plain', 1000)
    await recordSnapshot(kv, 'a:b', 'nested', 2000)
    // Encoding the room in the key keeps "a" from matching "a:b"'s snapshots.
    expect((await listSnapshots(kv, 'a')).map((s) => s.timestamp)).toEqual([1000])
    expect((await listSnapshots(kv, 'a:b')).map((s) => s.timestamp)).toEqual([2000])
  })

  it('pages through the cursor so the newest snapshots past the 1000-key cap survive', async () => {
    // Fake a KV that hands back one key per page (list_complete only on the last)
    // — the newest id (3000) is on the final page and must still surface first.
    const pages = [
      { keys: [{ name: 'snap:room1:1000' }], list_complete: false, cursor: 'c1' },
      { keys: [{ name: 'snap:room1:2000' }], list_complete: false, cursor: 'c2' },
      { keys: [{ name: 'snap:room1:3000' }], list_complete: true },
    ]
    let calls = 0
    const kv: SnapshotKv = {
      get: async () => null,
      put: async () => {},
      list: async () => pages[calls++],
    }
    const list = await listSnapshots(kv, 'room1')
    expect(calls).toBe(3)
    expect(list.map((s) => s.timestamp)).toEqual([3000, 2000, 1000])
  })
})

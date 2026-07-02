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

  it('lists a room’s snapshots newest first with ids and timestamps', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', 'v1', 1000)
    await recordSnapshot(kv, 'room1', 'v2', 2000)
    await recordSnapshot(kv, 'room1', 'v3', 3000)

    const list = await listSnapshots(kv, 'room1')
    expect(list.map((s) => s.timestamp)).toEqual([3000, 2000, 1000])
    expect(list.map((s) => s.id)).toEqual(['3000', '2000', '1000'])
    expect(await getSnapshot(kv, 'room1', list[2].id)).toBe('v1')
  })

  it('returns null for an unknown snapshot id', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', 'v1', 1000)
    expect(await getSnapshot(kv, 'room1', '9999')).toBeNull()
  })

  it('isolates rooms — one room’s list never bleeds into another', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'room1', 'a', 1000)
    await recordSnapshot(kv, 'room2', 'b', 1000)
    expect((await listSnapshots(kv, 'room1')).length).toBe(1)
    expect((await listSnapshots(kv, 'room2')).length).toBe(1)
    expect(await getSnapshot(kv, 'room1', '1000')).toBe('a')
  })

  it('does not confuse a room with another whose id is a prefix (a vs a:b)', async () => {
    const kv = makeKv()
    await recordSnapshot(kv, 'a', 'plain', 1000)
    await recordSnapshot(kv, 'a:b', 'nested', 2000)
    // Encoding the room in the key keeps "a" from matching "a:b"'s snapshots.
    expect(await listSnapshots(kv, 'a')).toEqual([{ id: '1000', timestamp: 1000 }])
    expect(await listSnapshots(kv, 'a:b')).toEqual([{ id: '2000', timestamp: 2000 }])
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

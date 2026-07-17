// Wiring that turns a room id into a live, synced `Y.Doc`:
//   1. `y-indexeddb` for immediate local-first persistence (works fully offline).
//   2. A Liveblocks Yjs provider for background real-time sync, authenticated
//      through the Worker's `/api/auth` endpoint (the secret key never reaches
//      the client).
//
// The provider wiring degrades gracefully: with no IndexedDB (e.g. a test/SSR
// runtime) it uses an in-memory doc, and with sync disabled it never touches the
// network — so the app always loads and edits locally.

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

/** Sync lifecycle as the UI cares about it. */
export type SyncStatus = 'local' | 'connecting' | 'synced' | 'error' | 'missing'

export interface Presence {
  userId: string
  name: string
  color: string
}

/** Strip a trailing slash so we can safely append `/api/...`. */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

export interface ConnectOptions {
  roomId: string
  /** Worker base URL used for the Liveblocks auth endpoint. */
  workerUrl: string
  /** Reuse an existing doc instead of creating one (handy for tests). */
  doc?: Y.Doc
  /**
   * Enable background Liveblocks sync. Defaults to true when a room id is
   * present. An empty worker URL uses same-origin `/api/auth`.
   */
  enableSync?: boolean
  /** Presence published for this connection's current user. */
  initialPresence?: Presence
}

export interface RoomConnection {
  doc: Y.Doc
  /** Resolves once local IndexedDB data (if any) has been loaded into the doc. */
  whenLocalLoaded: Promise<void>
  getStatus(): SyncStatus
  /** Subscribe to status changes; returns an unsubscribe function. */
  onStatus(cb: (status: SyncStatus) => void): () => void
  getPresences(): Presence[]
  onPresences(cb: (presences: Presence[]) => void): () => void
  /** Publish a partial update for the current user. */
  updatePresence(partial: Partial<Omit<Presence, 'userId'>>): void
  destroy(): void
}

/** Whether a real IndexedDB is available in this runtime. */
function hasIndexedDb(): boolean {
  return typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null
}

/**
 * Connect a room: attach local persistence and (optionally) Liveblocks sync to
 * a `Y.Doc`. Always returns synchronously with a usable doc; sync, when
 * enabled, is wired up asynchronously and reported via `onStatus`.
 */
export function connectRoom(opts: ConnectOptions): RoomConnection {
  const doc = opts.doc ?? new Y.Doc()
  const listeners = new Set<(s: SyncStatus) => void>()
  const presenceListeners = new Set<(p: Presence[]) => void>()
  let status: SyncStatus = 'local'
  let presences: Presence[] = []

  const setStatus = (next: SyncStatus) => {
    status = next
    for (const cb of listeners) cb(next)
  }

  const setPresences = (next: Presence[]) => {
    presences = next
    for (const cb of presenceListeners) cb(next)
  }

  const cleanups: Array<() => void> = []
  let destroyed = false
  let publishPresence: (partial: Partial<Omit<Presence, 'userId'>>) => void = () => {}

  // 1) Local-first persistence (browser only; in-memory elsewhere).
  let whenLocalLoaded: Promise<void> = Promise.resolve()
  if (hasIndexedDb()) {
    const idb = new IndexeddbPersistence(`travel-planner:${opts.roomId}`, doc)
    whenLocalLoaded = new Promise<void>((resolve) => idb.once('synced', () => resolve()))
    cleanups.push(() => void idb.destroy())
  }

  // 2) Background sync via the Worker-authenticated Liveblocks Yjs provider.
  const wantSync = opts.enableSync ?? Boolean(opts.roomId)
  if (wantSync) {
    setStatus('connecting')
    void setupLiveblocksSync(
      opts,
      doc,
      setStatus,
      setPresences,
      (publisher) => {
        publishPresence = publisher
      },
      (teardown) => {
        if (destroyed) teardown()
        else cleanups.push(teardown)
      },
    ).catch(() => setStatus('error'))
  }

  return {
    doc,
    whenLocalLoaded,
    getStatus: () => status,
    onStatus(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getPresences: () => presences,
    onPresences(cb) {
      presenceListeners.add(cb)
      return () => presenceListeners.delete(cb)
    },
    updatePresence(partial) {
      publishPresence(partial)
    },
    destroy() {
      destroyed = true
      for (const c of cleanups) c()
      cleanups.length = 0
      listeners.clear()
      presenceListeners.clear()
    },
  }
}

/**
 * Lazily wire up Liveblocks so the heavy client is only loaded when sync is
 * actually requested (keeps it out of local-only paths and unit tests).
 */
async function setupLiveblocksSync(
  opts: ConnectOptions,
  doc: Y.Doc,
  setStatus: (s: SyncStatus) => void,
  setPresences: (p: Presence[]) => void,
  registerPresencePublisher: (
    publisher: (partial: Partial<Omit<Presence, 'userId'>>) => void,
  ) => void,
  registerTeardown: (teardown: () => void) => void,
): Promise<void> {
  const base = trimSlash(opts.workerUrl)
  const [{ createClient }, { LiveblocksYjsProvider }] = await Promise.all([
    import('@liveblocks/client'),
    import('@liveblocks/yjs'),
  ])

  let missing = false

  const client = createClient({
    // Cloudflare Access authenticates the browser before this reaches the Worker.
    // The Worker then mints a Liveblocks token scoped to this slug room.
    authEndpoint: async () => {
      const res = await fetch(`${base}/api/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: opts.roomId }),
      })
      if (res.status === 404) {
        missing = true
        setStatus('missing')
        throw new Error('room not found')
      }
      if (!res.ok) throw new Error(`auth failed: ${res.status}`)
      return (await res.json()) as { token: string }
    },
  })

  const { room, leave } = client.enterRoom(opts.roomId, {
    initialPresence: (opts.initialPresence ?? {
      userId: '',
      name: '',
      color: '',
    }) as unknown as Record<string, string>,
  })
  registerPresencePublisher((partial) => room.updatePresence(partial))
  const provider = new LiveblocksYjsProvider(room, doc)
  const onProviderStatus = (s: unknown) => {
    if (!missing) setStatus(s === 'synchronized' ? 'synced' : 'connecting')
  }
  provider.on('status', onProviderStatus)
  onProviderStatus(provider.getStatus())

  // Subscribe to others' presence updates
  const unsubPresence = room.subscribe('others', (others) => {
    const list = others
      .map((o) => o.presence)
      .filter((p) => {
        return p && typeof p === 'object' && 'userId' in p && 'name' in p && 'color' in p
      }) as unknown as Presence[]
    setPresences(list)
  })

  registerTeardown(() => {
    provider.off('status', onProviderStatus)
    unsubPresence()
    provider.destroy()
    leave()
  })
}

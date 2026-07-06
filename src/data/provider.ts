// Wiring that turns a room id into a live, synced `Y.Doc`:
//   1. `y-indexeddb` for immediate local-first persistence (works fully offline).
//   2. A Liveblocks Yjs provider for background real-time sync, authenticated
//      through the Worker's `/api/auth` endpoint (the secret key never reaches
//      the client).
//
// The pure helpers (`roomIdFromHash`, `roomHash`, `createRoom`) are unit-tested
// directly. The actual provider wiring degrades gracefully: with no IndexedDB
// (e.g. a test/SSR runtime) it uses an in-memory doc, and with sync disabled it
// never touches the network — so the app always loads and edits locally.

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

// `roomIdFromHash` lives in the environment-agnostic `roomLink` module so the
// Worker's MCP tools parse the pasted link with the same logic. Re-exported
// here so client callers (and their tests) keep importing it from `provider`.
export { roomIdFromHash } from './roomLink'

/** Sync lifecycle as the UI cares about it. */
export type SyncStatus = 'local' | 'connecting' | 'synced' | 'error'

/** Strip a trailing slash so we can safely append `/api/...`. */
function trimSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Build the shareable secret-link hash for a room id. */
export function roomHash(roomId: string): string {
  return `#room=${encodeURIComponent(roomId)}`
}

export interface CreateRoomOptions {
  /** Base URL of the Worker (e.g. `https://worker.example.com`). */
  workerUrl: string
  /** Owner secret presented as `x-owner-secret`; gates room creation. */
  ownerSecret: string
  /** Optional explicit room id; the Worker generates one when omitted. */
  roomId?: string
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch
}

/**
 * Create a new room via the owner-gated Worker endpoint and return its id.
 * This is how "new trip" comes into existence; everyone else joins an existing
 * room with the secret link (no owner secret, no login).
 */
export async function createRoom(opts: CreateRoomOptions): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch
  const res = await doFetch(`${trimSlash(opts.workerUrl)}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-owner-secret': opts.ownerSecret },
    body: JSON.stringify(opts.roomId ? { room: opts.roomId } : {}),
  })
  if (!res.ok) throw new Error(`Room creation failed: ${res.status}`)
  const data = (await res.json()) as { id: string }
  return data.id
}

export interface ConnectOptions {
  roomId: string
  /**
   * The raw capability token (URL fragment) POSTed to `/api/auth` — the sole
   * credential. The Worker verifies it and derives the room + perms; the client
   * never sends the room id separately.
   */
  token?: string | null
  /** Worker base URL used for the Liveblocks auth endpoint. */
  workerUrl: string
  /** Reuse an existing doc instead of creating one (handy for tests). */
  doc?: Y.Doc
  /**
   * Enable background Liveblocks sync. Defaults to true when both a room id and
   * a worker URL are present. Set false for a purely local doc.
   */
  enableSync?: boolean
}

export interface RoomConnection {
  doc: Y.Doc
  /** Resolves once local IndexedDB data (if any) has been loaded into the doc. */
  whenLocalLoaded: Promise<void>
  getStatus(): SyncStatus
  /** Subscribe to status changes; returns an unsubscribe function. */
  onStatus(cb: (status: SyncStatus) => void): () => void
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
  let status: SyncStatus = 'local'
  const setStatus = (next: SyncStatus) => {
    status = next
    for (const cb of listeners) cb(next)
  }

  const cleanups: Array<() => void> = []
  let destroyed = false

  // 1) Local-first persistence (browser only; in-memory elsewhere).
  let whenLocalLoaded: Promise<void> = Promise.resolve()
  if (hasIndexedDb()) {
    const idb = new IndexeddbPersistence(`travel-planner:${opts.roomId}`, doc)
    whenLocalLoaded = new Promise<void>((resolve) => idb.once('synced', () => resolve()))
    cleanups.push(() => void idb.destroy())
  }

  // 2) Background sync via the Worker-authenticated Liveblocks Yjs provider.
  const wantSync = opts.enableSync ?? Boolean(opts.roomId && opts.workerUrl)
  if (wantSync && opts.workerUrl) {
    setStatus('connecting')
    void setupLiveblocksSync(opts, doc, setStatus, (teardown) => {
      if (destroyed) teardown()
      else cleanups.push(teardown)
    }).catch(() => setStatus('error'))
  }

  return {
    doc,
    whenLocalLoaded,
    getStatus: () => status,
    onStatus(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    destroy() {
      destroyed = true
      for (const c of cleanups) c()
      cleanups.length = 0
      listeners.clear()
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
  registerTeardown: (teardown: () => void) => void,
): Promise<void> {
  const base = trimSlash(opts.workerUrl)
  const [{ createClient }, { LiveblocksYjsProvider }] = await Promise.all([
    import('@liveblocks/client'),
    import('@liveblocks/yjs'),
  ])

  const client = createClient({
    // The capability token is the credential: POST it to the Worker, which
    // verifies it, derives the room + perms, and mints a perm-scoped Liveblocks
    // token only if the room already exists. The room id is never sent separately.
    authEndpoint: async () => {
      const res = await fetch(`${base}/api/auth`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: opts.token }),
      })
      if (!res.ok) throw new Error(`auth failed: ${res.status}`)
      return (await res.json()) as { token: string }
    },
  })

  const { room, leave } = client.enterRoom(opts.roomId)
  const provider = new LiveblocksYjsProvider(room, doc)
  const onProviderStatus = (s: unknown) => setStatus(s === 'synchronized' ? 'synced' : 'connecting')
  provider.on('status', onProviderStatus)
  onProviderStatus(provider.getStatus())

  registerTeardown(() => {
    provider.off('status', onProviderStatus)
    provider.destroy()
    leave()
  })
}

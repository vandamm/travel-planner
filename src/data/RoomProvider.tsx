// React context that owns the room connection and exposes the synced doc plus
// its live sync status to the tree. UI components read the doc via `useRoom()`
// and mutate it through the `doc.ts` mutators.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as Y from 'yjs'
import { installDevBridge } from './devBridge'
import { connectRoom, type SyncStatus } from './provider'
import { parseToken, tokenFromLink, type Perm } from './token'

export interface RoomContextValue {
  doc: Y.Doc
  /** Raw capability token from the URL fragment, if present. */
  token: string | null
  roomId: string | null
  /** Capability level decoded (NOT verified) from the token — shapes local UX. */
  perm: Perm | null
  /** Optional display name decoded from the token. */
  name: string | null
  status: SyncStatus
  /** Worker base URL (may be '' — then Worker-backed features fetch relative). */
  workerUrl: string
}

const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used within a <RoomProvider>')
  return ctx
}

export interface RoomProviderProps {
  /** Worker base URL; defaults to `import.meta.env.VITE_WORKER_URL`. */
  workerUrl?: string
  /**
   * The raw capability token (URL fragment). When omitted, it is read from
   * `location.hash`. Pass `null` explicitly for a local-only doc with no room.
   * Room id, perms and name are decoded from it (NO signature check — the client
   * only shapes local rendering; the Worker verifies on `/api/auth`).
   */
  token?: string | null
  /** Force-enable/disable background sync (defaults to auto from room + url). */
  enableSync?: boolean
  children: ReactNode
}

function currentHash(): string {
  return typeof location !== 'undefined' ? location.hash : ''
}

export function RoomProvider({
  workerUrl,
  token: tokenProp,
  enableSync,
  children,
}: RoomProviderProps) {
  const workerBase = workerUrl ?? import.meta.env.VITE_WORKER_URL ?? ''
  const token = tokenProp === null ? null : tokenFromLink(tokenProp ?? currentHash()) || null
  const payload = token ? parseToken(token) : null
  const roomId = payload?.r ?? null
  const perm = payload?.p ?? null
  const name = payload?.n ?? null

  // The Y.Doc is cheap and owns no external resources, so it can live in useMemo
  // and be available synchronously for the first render. The *connection*
  // (IndexedDB + Liveblocks providers) is an external resource with a one-way
  // destroy(), so it is created AND torn down inside the effect: StrictMode's
  // mount→unmount→remount then rebuilds it on the same doc, instead of leaving
  // the app wired to a destroyed connection (which silently kills background sync).
  //
  // The deps are intentional cache keys, not values the factory reads: a change
  // of room identity (or transport) yields a clean doc, matching the pre-fix
  // behaviour where connectRoom minted the doc under these same deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doc = useMemo(() => new Y.Doc(), [roomId, workerBase, enableSync])
  const [status, setStatus] = useState<SyncStatus>('local')

  useEffect(() => {
    const connection = connectRoom({
      roomId: roomId ?? 'local',
      token,
      workerUrl: workerBase,
      enableSync: enableSync ?? Boolean(roomId && workerBase),
      doc,
    })
    installDevBridge(doc)
    setStatus(connection.getStatus())
    const unsubscribe = connection.onStatus(setStatus)
    return () => {
      unsubscribe()
      connection.destroy()
    }
  }, [doc, roomId, token, workerBase, enableSync])

  const value = useMemo<RoomContextValue>(
    () => ({ doc, token, roomId, perm, name, status, workerUrl: workerBase }),
    [doc, token, roomId, perm, name, status, workerBase],
  )

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

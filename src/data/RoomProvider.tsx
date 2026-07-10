// React context that owns the room connection and exposes the synced doc plus
// its live sync status to the tree. UI components read the doc via `useRoom()`
// and mutate it through the `doc.ts` mutators.

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import * as Y from 'yjs'
import { installDevBridge } from './devBridge'
import { connectRoom, type SyncStatus } from './provider'
import { RoomContext, type RoomContextValue } from './RoomContext'
import { slugFromPath } from './slug'

export interface RoomProviderProps {
  /** Worker base URL; defaults to `import.meta.env.VITE_WORKER_URL`. */
  workerUrl?: string
  /** Room slug. When omitted, it is read from `location.pathname`. */
  roomId?: string | null
  /** Force-enable/disable background sync (defaults to auto from room slug). */
  enableSync?: boolean
  children: ReactNode
}

function currentRoomId(): string | null {
  return typeof location !== 'undefined' ? slugFromPath(location.pathname) : null
}

export function RoomProvider({
  workerUrl,
  roomId: roomIdProp,
  enableSync,
  children,
}: RoomProviderProps) {
  const workerBase = workerUrl ?? import.meta.env.VITE_WORKER_URL ?? ''
  const roomId = roomIdProp === undefined ? currentRoomId() : roomIdProp
  const autoSync = import.meta.env.MODE !== 'test' && Boolean(roomId)

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
      workerUrl: workerBase,
      enableSync: enableSync ?? autoSync,
      doc,
    })
    installDevBridge(doc)
    setStatus(connection.getStatus())
    const unsubscribe = connection.onStatus(setStatus)
    return () => {
      unsubscribe()
      connection.destroy()
    }
  }, [doc, roomId, workerBase, enableSync, autoSync])

  const value = useMemo<RoomContextValue>(
    () => ({ doc, roomId, status, workerUrl: workerBase }),
    [doc, roomId, status, workerBase],
  )

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

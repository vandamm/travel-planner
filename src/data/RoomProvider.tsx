// React context that owns the room connection and exposes the synced doc plus
// its live sync status to the tree. UI components read the doc via `useRoom()`
// and mutate it through the `doc.ts` mutators.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type * as Y from 'yjs'
import { installDevBridge } from './devBridge'
import { connectRoom, roomIdFromHash, type SyncStatus } from './provider'

export interface RoomContextValue {
  doc: Y.Doc
  roomId: string | null
  status: SyncStatus
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
   * Room id. When omitted, it is derived from `location.hash`. Pass `null`
   * explicitly for a local-only doc with no room.
   */
  roomId?: string | null
  /** Force-enable/disable background sync (defaults to auto from room + url). */
  enableSync?: boolean
  children: ReactNode
}

function currentHash(): string {
  return typeof location !== 'undefined' ? location.hash : ''
}

export function RoomProvider({
  workerUrl,
  roomId: roomIdProp,
  enableSync,
  children,
}: RoomProviderProps) {
  const workerBase = workerUrl ?? import.meta.env.VITE_WORKER_URL ?? ''
  const roomId = roomIdProp !== undefined ? roomIdProp : roomIdFromHash(currentHash())

  const connection = useMemo(
    () =>
      connectRoom({
        roomId: roomId ?? 'local',
        workerUrl: workerBase,
        enableSync: enableSync ?? Boolean(roomId && workerBase),
      }),
    [roomId, workerBase, enableSync],
  )

  const [status, setStatus] = useState<SyncStatus>(() => connection.getStatus())

  useEffect(() => {
    setStatus(connection.getStatus())
    installDevBridge(connection.doc)
    const unsubscribe = connection.onStatus(setStatus)
    return () => {
      unsubscribe()
      connection.destroy()
    }
  }, [connection])

  const value = useMemo<RoomContextValue>(
    () => ({ doc: connection.doc, roomId, status }),
    [connection, roomId, status],
  )

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

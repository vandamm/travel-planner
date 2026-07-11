import { createContext, useContext } from 'react'
import type * as Y from 'yjs'
import type { SyncStatus } from './provider'

export interface Presence {
  userId: string
  name: string
  color: string
}

export interface RoomContextValue {
  doc: Y.Doc
  roomId: string | null
  status: SyncStatus
  /** Worker base URL (may be '' — then Worker-backed features fetch relative). */
  workerUrl: string
  /** Current user's presence, or null if not yet loaded. */
  myself: Presence | null
  /** All presences in the room (includes myself). */
  presences: Presence[]
  /** Update the current user's presence (partial). */
  setPresence: (partial: Partial<Omit<Presence, 'userId'>>) => void
}

export const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used within a <RoomProvider>')
  return ctx
}

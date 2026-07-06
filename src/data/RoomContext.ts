import { createContext, useContext } from 'react'
import type * as Y from 'yjs'
import type { SyncStatus } from './provider'
import type { Perm } from './token'

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

export const RoomContext = createContext<RoomContextValue | null>(null)

export function useRoom(): RoomContextValue {
  const ctx = useContext(RoomContext)
  if (!ctx) throw new Error('useRoom must be used within a <RoomProvider>')
  return ctx
}

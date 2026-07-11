// React context that owns the room connection and exposes the synced doc plus
// its live sync status to the tree. UI components read the doc via "useRoom()"
// and mutate it through the "doc.ts" mutators.

import { useEffect, useMemo, useState, type ReactNode } from "react"
import * as Y from "yjs"
import { installDevBridge } from "./devBridge"
import { connectRoom, type SyncStatus } from "./provider"
import { RoomContext, type Presence as ContextPresence, type RoomContextValue } from "./RoomContext"
import { slugFromPath } from "./slug"
import { randomCityColor } from "../features/cities/colors"

export interface RoomProviderProps {
  /** Worker base URL; defaults to "import.meta.env.VITE_WORKER_URL". */
  workerUrl?: string
  /** Room slug. When omitted, it is read from "location.pathname". */
  roomId?: string | null
  /** Force-enable/disable background sync (defaults to auto from room slug). */
  enableSync?: boolean
  children: ReactNode
}

function generateUserId(): string {
  let id = localStorage.getItem("travel-planner-user-id")
  if (!id) {
    id = "user-" + Math.random().toString(36).substring(2, 11)
    localStorage.setItem("travel-planner-user-id", id)
  }
  return id
}

function getUserName(): string {
  let name = localStorage.getItem("travel-planner-name")
  if (!name) {
    const id = generateUserId()
    const suffix = id.substring(5, 7).toUpperCase()
    name = "User " + suffix
    localStorage.setItem("travel-planner-name", name)
  }
  return name
}

function getUserColor(): string {
  let color = localStorage.getItem("travel-planner-color")
  if (!color) {
    color = randomCityColor([])
    localStorage.setItem("travel-planner-color", color)
  }
  return color
}

function currentRoomId(): string | null {
  return typeof location !== "undefined" ? slugFromPath(location.pathname) : null
}

export function RoomProvider({
  workerUrl,
  roomId: roomIdProp,
  enableSync,
  children,
}: RoomProviderProps) {
  const workerBase = workerUrl ?? import.meta.env.VITE_WORKER_URL ?? ""
  const roomId = roomIdProp === undefined ? currentRoomId() : roomIdProp
  const autoSync = import.meta.env.MODE !== "test" && Boolean(roomId && workerBase)
  const hasIndexedDb = typeof globalThis.indexedDB !== "undefined" && globalThis.indexedDB !== null

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
  const [loadedDoc, setLoadedDoc] = useState<Y.Doc | null>(hasIndexedDb ? null : doc)
  const [status, setStatus] = useState<SyncStatus>("local")
  const [presences, setPresences] = useState<ContextPresence[]>([])
  const [myself, setMyself] = useState<ContextPresence | null>(null)

  useEffect(() => {
    const connection = connectRoom({
      roomId: roomId ?? "local",
      workerUrl: workerBase,
      enableSync: enableSync ?? autoSync,
      doc,
    })
    installDevBridge(doc)
    setStatus(connection.getStatus())
    let active = true

    // ponytail: generate user presence on mount, update Liveblocks
    const userId = generateUserId()
    const name = getUserName()
    const color = getUserColor()
    const myPresence = { userId, name, color }
    setMyself(myPresence)

    // Subscribe to presence updates from Liveblocks
    const unsubPresence = connection.onPresences((list) => {
      if (active) setPresences(list)
    })

    void connection.whenLocalLoaded.then(() => {
      if (active) setLoadedDoc(doc)
    })
    const unsubscribe = connection.onStatus(setStatus)

    return () => {
      active = false
      unsubscribe()
      unsubPresence()
      connection.destroy()
    }
  }, [doc, roomId, workerBase, enableSync, autoSync])

  const value = useMemo<RoomContextValue>(
    () => ({
      doc,
      roomId,
      status,
      workerUrl: workerBase,
      myself,
      presences,
      setPresence: (partial) => {
        if (myself) {
          const updated = { ...myself, ...partial }
          setMyself(updated)
        }
      },
    }),
    [doc, roomId, status, workerBase, myself, presences],
  )

  return (
    <RoomContext.Provider value={value}>
      {!hasIndexedDb || loadedDoc === doc ? (
        children
      ) : (
        <main
          role="status"
          className="flex min-h-screen items-center justify-center bg-surface text-ink-500"
        >
          Loading trip…
        </main>
      )}
    </RoomContext.Provider>
  )
}

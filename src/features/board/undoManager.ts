// Session-local undo/redo for hand edits, built on `Y.UndoManager`.
//
// The manager tracks the `null`-origin transactions the `doc.ts` mutators emit
// (every hand edit) and — because its trackedOrigins is `{null}` — leaves the
// string-origin `APPLY_TRIP_ORIGIN` transactions out. So an agent write, a JSON
// paste-apply, or a version restore (all full-replace applies) and remote
// Liveblocks sync (its own origin) never get chunked into the keystroke undo
// stack; only the durable snapshot log rolls those back. This is per-session,
// in-memory — not persisted.

import { useCallback, useEffect, useState } from 'react'
import * as Y from 'yjs'

/** The top-level doc containers whose edits are undoable. */
const TRACKED_KEYS = ['trip', 'cities', 'dayOverrides', 'cards', 'accommodations'] as const

/**
 * A `Y.UndoManager` scoped to the board's top-level types. `trackedOrigins`
 * stays the default `{null}` so full-replace applies (`APPLY_TRIP_ORIGIN`,
 * a string origin) and remote sync are excluded by construction.
 */
export function createTripUndoManager(doc: Y.Doc): Y.UndoManager {
  const scope = TRACKED_KEYS.map((key) => doc.getMap(key))
  return new Y.UndoManager(scope, { trackedOrigins: new Set([null]) })
}

export interface UndoControls {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

/** Was the keydown fired from a text field the browser should undo itself? */
function isTextTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return (
    !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true)
  )
}

/**
 * Live undo/redo for the current room's doc: Cmd/Ctrl+Z undoes, Shift+Cmd/Ctrl+Z
 * redoes (skipped while a text field is focused, so native input undo still
 * works), plus `undo`/`redo` callbacks and reactive `canUndo`/`canRedo` flags
 * for toolbar buttons.
 */
export function useUndoManager(doc: Y.Doc): UndoControls {
  // Own the manager's lifecycle in an effect (not useMemo): under StrictMode the
  // mount→cleanup→remount cycle would otherwise leave a destroyed manager whose
  // observer no longer tracks edits. Recreated per-doc; destroyed on unmount.
  const [manager, setManager] = useState<Y.UndoManager | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    const um = createTripUndoManager(doc)
    setManager(um)
    const update = () => {
      setCanUndo(um.canUndo())
      setCanRedo(um.canRedo())
    }
    update()
    um.on('stack-item-added', update)
    um.on('stack-item-popped', update)
    um.on('stack-cleared', update)

    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      if (isTextTarget(e.target)) return
      e.preventDefault()
      if (e.shiftKey) um.redo()
      else um.undo()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      um.off('stack-item-added', update)
      um.off('stack-item-popped', update)
      um.off('stack-cleared', update)
      um.destroy()
      setManager(null)
    }
  }, [doc])

  const undo = useCallback(() => manager?.undo(), [manager])
  const redo = useCallback(() => manager?.redo(), [manager])

  return { undo, redo, canUndo, canRedo }
}

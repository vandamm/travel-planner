// The board's drag-and-drop context: dnd-kit sensors plus the single drop
// handler that routes every finished drag through the shared Yjs mutators (via
// `applyCardDragEnd`). It takes the doc and the viewer's time direction as props
// so the same mutation logic the unit tests exercise runs unchanged in the UI.

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { ReactNode } from 'react'
import type * as Y from 'yjs'
import { applyCardDragEnd } from './dndHandlers'
import type { TimeDirection } from './timeDirection'

export interface BoardDndProps {
  doc: Y.Doc
  direction: TimeDirection
  children: ReactNode
}

export function BoardDnd({ doc, direction, children }: BoardDndProps) {
  const sensors = useSensors(
    // A small distance threshold so clicking a card to edit it never starts a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null
    applyCardDragEnd(doc, { activeId: String(event.active.id), overId }, direction)
  }

  return (
    // closestCenter is the recommended strategy for sortable lists: it always
    // resolves to the nearest card/column center, so reorders register reliably
    // even as items reflow mid-drag.
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  )
}

// The board's drag-and-drop context: dnd-kit sensors plus the single drop
// handler that routes every finished drag through the shared Yjs mutators (via
// `applyCardDragEnd`). It takes the doc and the viewer's time direction as props
// so the same mutation logic the unit tests exercise runs unchanged in the UI.
//
// It also renders a <DragOverlay> so the dragged card follows the cursor across
// day columns (a plain sortable item is clipped/hidden once it leaves its
// column), and tracks which day the pointer is over so that column can show a
// drop-target highlight (the "where it lands" hint).

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState, type ReactNode } from 'react'
import type * as Y from 'yjs'
import { getCard } from '../../data/doc'
import type { Card as CardType } from '../../data/schema'
import { Card } from '../cards/Card'
import { boardCollisionDetection } from './dndCollision'
import { DragOverDayContext } from './dragOverDayContext'
import { applyCardDragEnd, dayKeyFromDroppableId, isDayDroppableId } from './dndHandlers'
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

  // The card being dragged (rendered in the overlay) and the day under the
  // pointer (highlighted as the drop target). Both are cleared on end/cancel.
  const [activeCard, setActiveCard] = useState<CardType | null>(null)
  const [overDayKey, setOverDayKey] = useState<string | null>(null)

  // Resolve the day a drop target belongs to: a column droppable maps directly,
  // a card maps to its own day.
  function dayKeyOf(overId: string | null): string | null {
    if (!overId) return null
    if (isDayDroppableId(overId)) return dayKeyFromDroppableId(overId)
    return getCard(doc, overId)?.dayKey ?? null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveCard(getCard(doc, String(event.active.id)) ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    setOverDayKey(dayKeyOf(event.over ? String(event.over.id) : null))
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null
    applyCardDragEnd(doc, { activeId: String(event.active.id), overId }, direction)
    setActiveCard(null)
    setOverDayKey(null)
  }

  function handleDragCancel() {
    setActiveCard(null)
    setOverDayKey(null)
  }

  return (
    // A card's timing gap is part of its drop zone. Prefer that card over the
    // day body below it, then use closest-center when the pointer hits neither.
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DragOverDayContext.Provider value={overDayKey}>{children}</DragOverDayContext.Provider>
      {/* Renders at the cursor, in a portal above the columns, so the card stays
          visible while crossing day boundaries. Presentational (no drag handle). */}
      <DragOverlay>{activeCard ? <Card card={activeCard} /> : null}</DragOverlay>
    </DndContext>
  )
}

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
import { useState, type ReactNode } from 'react'
import type * as Y from 'yjs'
import { getCard } from '../../data/doc'
import type { Card as CardType } from '../../data/schema'
import { Card } from '../cards/Card'
import { boardCollisionDetection } from './dndCollision'
import { DragOverDayContext } from './dragOverDayContext'
import {
  applyCardDrop,
  dayKeyFromDroppableId,
  isDayDroppableId,
  timelineDropOffset,
} from './dndHandlers'
import type { TimeDirection } from './timeDirection'

export interface BoardDndProps {
  doc: Y.Doc
  direction: TimeDirection
  dayStart?: string
  dayEnd?: string
  onDrop?: () => void
  children: ReactNode
}

export function BoardDnd({
  doc,
  direction,
  dayStart = '06:00',
  dayEnd = '21:00',
  onDrop,
  children,
}: BoardDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )
  const [activeCard, setActiveCard] = useState<CardType | null>(null)
  const [overDayKey, setOverDayKey] = useState<string | null>(null)

  function handleDragStart(event: DragStartEvent) {
    setActiveCard(getCard(doc, String(event.active.id)) ?? null)
  }

  function dayKeyOf(overId: string | null): string | null {
    if (!overId) return null
    if (isDayDroppableId(overId)) return dayKeyFromDroppableId(overId)
    return getCard(doc, overId)?.dayKey ?? null
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null
    setOverDayKey(dayKeyOf(overId))
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null
    const targetDayKey = dayKeyOf(overId)
    const initial = event.active.rect.current.initial
    const droppedTop = initial ? initial.top + event.delta.y : event.active.rect.current.translated?.top
    const dayBody = targetDayKey
      ? document.querySelector<HTMLElement>(
          `[data-day="${targetDayKey}"] [data-testid="day-body"]`,
        )
      : null
    if (targetDayKey && droppedTop !== undefined && dayBody) {
      const dayBodyRect = dayBody.getBoundingClientRect()
      applyCardDrop(
        doc,
        {
          activeId: String(event.active.id),
          targetDayKey,
          offsetPx: timelineDropOffset(droppedTop, dayBodyRect.top, dayBody.scrollTop),
        },
        direction,
      )
      onDrop?.()
    }
    setActiveCard(null)
    setOverDayKey(null)
  }

  function handleDragCancel() {
    setActiveCard(null)
    setOverDayKey(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <DragOverDayContext.Provider value={overDayKey}>{children}</DragOverDayContext.Provider>
      <DragOverlay>
        {activeCard ? <Card card={activeCard} dayStart={dayStart} dayEnd={dayEnd} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type * as Y from 'yjs'
import { getCard } from '../../data/doc'
import type { Card as CardType } from '../../data/schema'
import { resolvedDurationHours } from '../cards/cardHeight'
import {
  applyCardResize,
  CardResizeContext,
  planCardResize,
  type CardResizeController,
} from './cardResize'
import { boardCollisionDetection } from './dndCollision'
import { DragOverDayContext, DragPreviewContext } from './dragOverDayContext'
import {
  commitCardDropPlan,
  dayKeyFromDroppableId,
  isDayDroppableId,
  planCardDrop,
  timelineDropOffset,
  type CardDropPlan,
} from './dndHandlers'
import type { TimeDirection } from './timeDirection'

export interface BoardDndProps {
  doc: Y.Doc
  direction: TimeDirection
  dayStart?: string
  dayEnd?: string
  onTimelineChange?: () => void
  children: ReactNode
}

export function BoardDnd({
  doc,
  direction,
  dayStart = '06:00',
  dayEnd = '21:00',
  onTimelineChange,
  children,
}: BoardDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  )
  const [activeCard, setActiveCard] = useState<CardType | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    dayKey: string
    startTime: string | null
    durationHours: number
  } | null>(null)
  const [overDayKey, setOverDayKey] = useState<string | null>(null)
  useEffect(() => {
    document.body.classList.toggle('cursor-grabbing', Boolean(activeCard))
    return () => document.body.classList.remove('cursor-grabbing')
  }, [activeCard])
  const resizeController = useMemo<CardResizeController>(
    () => ({
      plan(cardId, edge, deltaPx) {
        const card = getCard(doc, cardId)
        if (!card) return null
        return planCardResize({
          card,
          edge,
          deltaPx,
          direction,
          dayStart,
          dayEnd,
        })
      },
      commit(cardId, edge, deltaPx) {
        if (applyCardResize(doc, cardId, edge, deltaPx, direction)) onTimelineChange?.()
      },
    }),
    [dayEnd, dayStart, direction, doc, onTimelineChange],
  )

  function handleDragStart(event: DragStartEvent) {
    const card = getCard(doc, String(event.active.id)) ?? null
    setActiveCard(card)
    setDragPreview(
      card
        ? {
            dayKey: card.dayKey,
            startTime: card.startTime ?? null,
            durationHours: resolvedDurationHours(card, dayStart, dayEnd),
          }
        : null,
    )
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

  function planFromEvent(event: DragMoveEvent | DragEndEvent): CardDropPlan | null {
    const card = getCard(doc, String(event.active.id))
    const targetDayKey = dayKeyOf(event.over ? String(event.over.id) : null)
    const initial = event.active.rect.current.initial
    const droppedTop =
      event.active.rect.current.translated?.top ??
      (initial ? initial.top + event.delta.y : undefined)
    const timelineTrack = targetDayKey
      ? document.querySelector<HTMLElement>(`[data-day="${targetDayKey}"] [data-testid="timeline-track"]`)
      : null
    if (!card || !targetDayKey || droppedTop === undefined || !timelineTrack) return null

    const timelineRect = timelineTrack.getBoundingClientRect()
    return planCardDrop({
      card,
      targetDayKey,
      offsetPx: timelineDropOffset(droppedTop, timelineRect.top, 0),
      dayStart,
      dayEnd,
      direction,
    })
  }

  function handleDragMove(event: DragMoveEvent) {
    const plan = planFromEvent(event)
    if (!plan) return
    setDragPreview({
      dayKey: plan.dayKey,
      startTime: plan.startTime,
      durationHours: plan.durationHours,
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const plan = planFromEvent(event)
    if (plan && commitCardDropPlan(doc, String(event.active.id), plan)) {
      onTimelineChange?.()
    }
    setActiveCard(null)
    setDragPreview(null)
    setOverDayKey(null)
  }

  function handleDragCancel() {
    setActiveCard(null)
    setDragPreview(null)
    setOverDayKey(null)
  }

  return (
    <CardResizeContext.Provider value={resizeController}>
      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <DragPreviewContext.Provider
          value={activeCard && dragPreview ? { card: activeCard, ...dragPreview } : null}
        >
          <DragOverDayContext.Provider value={overDayKey}>{children}</DragOverDayContext.Provider>
        </DragPreviewContext.Provider>
      </DndContext>
    </CardResizeContext.Provider>
  )
}

import { createContext } from 'react'
import type * as Y from 'yjs'
import { getCard, getTrip, updateCard, updateCardSchedules } from '../../data/doc'
import type { Card } from '../../data/schema'
import { clockMinutes, clockString, PX_PER_HOUR, resolvedDurationHours } from '../cards/cardHeight'
import { planTimelineSchedule, type TimelineEditKind } from './timelineSchedule'
import type { TimeDirection } from './timeDirection'

export type CardResizeEdge = 'start' | 'end'

export interface CardResizeInput {
  card: Card
  edge: CardResizeEdge
  /** Vertical pointer/keyboard movement in display pixels. */
  deltaPx: number
  direction: TimeDirection
  dayStart: string
  dayEnd: string
}

export interface CardResizePlan {
  startTime: string
  duration: 'custom'
  durationHours: number
  heightPx: number
  /** Change to the card's displayed top while previewing the resize. */
  topOffsetPx: number
}

function resizeEdit(edge: CardResizeEdge, direction: TimeDirection): TimelineEditKind {
  if (edge === 'start') return direction === 'down' ? 'resize-top' : 'resize-bottom'
  return direction === 'down' ? 'resize-bottom' : 'resize-top'
}

function interval(card: Card, dayStart: string, dayEnd: string) {
  return {
    id: card.id,
    start: clockMinutes(card.startTime!),
    duration: resolvedDurationHours(card, dayStart, dayEnd) * 60,
  }
}

/** Plan a snapped resize without mutating the card or document. */
export function planCardResize({
  card,
  edge,
  deltaPx,
  direction,
  dayStart,
  dayEnd,
}: CardResizeInput): CardResizePlan | null {
  if (!card.startTime) return null

  const active = interval(card, dayStart, dayEnd)
  const clockDelta = (deltaPx / PX_PER_HOUR) * 60 * (direction === 'down' ? 1 : -1)
  const requestedStart = edge === 'start' ? active.start + clockDelta : active.start
  const requestedEnd =
    edge === 'end' ? active.start + active.duration + clockDelta : active.start + active.duration
  const result = planTimelineSchedule({
    active,
    requested: { start: requestedStart, duration: requestedEnd - requestedStart },
    dayStart: clockMinutes(dayStart),
    dayEnd: clockMinutes(dayEnd),
    edit: resizeEdit(edge, direction),
    direction,
  })
  const originalEnd = active.start + active.duration
  const resizedEnd = result.activeStart + result.activeDuration
  const topOffsetMinutes =
    direction === 'down' ? result.activeStart - active.start : originalEnd - resizedEnd

  return {
    startTime: clockString(result.activeStart),
    duration: 'custom',
    durationHours: result.activeDuration / 60,
    heightPx: (result.activeDuration / 60) * PX_PER_HOUR,
    topOffsetPx: (topOffsetMinutes / 60) * PX_PER_HOUR,
  }
}

/** Commit one resize and its collision chain as one collaborative transaction. */
export function applyCardResize(
  doc: Y.Doc,
  cardId: string,
  edge: CardResizeEdge,
  deltaPx: number,
  direction: TimeDirection,
): CardResizePlan | null {
  const card = getCard(doc, cardId)
  if (!card) return null
  const { dayStart, dayEnd } = getTrip(doc)
  const result = planCardResize({
    card,
    edge,
    deltaPx,
    direction,
    dayStart,
    dayEnd,
  })
  if (!result) return null

  doc.transact(() => {
    updateCard(doc, cardId, {
      duration: result.duration,
      durationHours: result.durationHours,
    })
    updateCardSchedules(doc, [{ id: cardId, startTime: result.startTime }])
  })
  return result
}

export interface CardResizeController {
  plan: (cardId: string, edge: CardResizeEdge, deltaPx: number) => CardResizePlan | null
  commit: (cardId: string, edge: CardResizeEdge, deltaPx: number) => void
}

/** Board-scoped resize access used by every timed card, including mobile cards. */
export const CardResizeContext = createContext<CardResizeController | undefined>(undefined)

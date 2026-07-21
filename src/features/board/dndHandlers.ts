import type * as Y from 'yjs'
import { getCard, getTrip, updateCardSchedules } from '../../data/doc'
import type { Card } from '../../data/schema'
import { clockMinutes, clockString, PX_PER_HOUR, resolvedDurationHours } from '../cards/cardHeight'
import {
  planTimelineSchedule,
  TIMELINE_SNAP_MINUTES,
  type TimelineEditKind,
} from './timelineSchedule'
import type { TimeDirection } from './timeDirection'

export const DAY_DROPPABLE_PREFIX = 'day:'

export function dayDroppableId(dayKey: string): string {
  return `${DAY_DROPPABLE_PREFIX}${dayKey}`
}

export function isDayDroppableId(id: string): boolean {
  return id.startsWith(DAY_DROPPABLE_PREFIX)
}

export function dayKeyFromDroppableId(id: string): string {
  return id.slice(DAY_DROPPABLE_PREFIX.length)
}

export function timelineDropOffset(
  droppedTop: number,
  timelineTop: number,
  scrollTop: number,
): number {
  return droppedTop - timelineTop + scrollTop
}

export function dropTimeForOffset(
  offsetPx: number,
  durationHours: number,
  dayStart: string,
  dayEnd: string,
  direction: TimeDirection,
): string {
  const first = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const earliest = Math.ceil(first / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES
  const latest =
    Math.floor((end - durationHours * 60) / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES
  if (latest < earliest) return clockString(first)
  const raw =
    direction === 'down'
      ? first + (offsetPx / PX_PER_HOUR) * 60
      : end - durationHours * 60 - (offsetPx / PX_PER_HOUR) * 60
  const snapped = Math.round(raw / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES
  return clockString(Math.min(Math.max(snapped, earliest), latest))
}

export interface CardDrop {
  activeId: string
  targetDayKey: string
  /** Dropped card top, in pixels from the target timeline's top edge. */
  offsetPx: number
}

export interface CardDropPlanInput {
  card: Card
  targetDayKey: string
  offsetPx: number
  dayStart: string
  dayEnd: string
  direction: TimeDirection
}

export interface CardDropPlan {
  dayKey: string
  startTime: string
  durationHours: number
}

function moveEditKind(
  currentStart: number,
  requestedStart: number,
  direction: TimeDirection,
): TimelineEditKind {
  const movedTowardTop =
    direction === 'down' ? requestedStart < currentStart : requestedStart > currentStart
  return movedTowardTop ? 'move-top' : 'move-bottom'
}

export function planCardDrop({
  card,
  targetDayKey,
  offsetPx,
  dayStart,
  dayEnd,
  direction,
}: CardDropPlanInput): CardDropPlan {
  const durationHours = resolvedDurationHours(card, dayStart, dayEnd)
  const requested = clockMinutes(
    dropTimeForOffset(offsetPx, durationHours, dayStart, dayEnd, direction),
  )
  const currentStart = card.startTime ? clockMinutes(card.startTime) : requested
  const result = planTimelineSchedule({
    active: { id: card.id, start: currentStart, duration: durationHours * 60 },
    requested: { start: requested, duration: durationHours * 60 },
    dayStart: clockMinutes(dayStart),
    dayEnd: clockMinutes(dayEnd),
    edit: moveEditKind(currentStart, requested, direction),
    direction,
  })

  return {
    dayKey: targetDayKey,
    startTime: clockString(result.activeStart),
    durationHours: result.activeDuration / 60,
  }
}

export function commitCardDropPlan(doc: Y.Doc, activeId: string, plan: CardDropPlan): boolean {
  if (!getCard(doc, activeId)) return false
  updateCardSchedules(doc, [{ id: activeId, dayKey: plan.dayKey, startTime: plan.startTime }])
  return true
}

/** Schedule only the dropped card; overlaps are valid timeline state. */
export function applyCardDrop(
  doc: Y.Doc,
  { activeId, targetDayKey, offsetPx }: CardDrop,
  direction: TimeDirection = 'down',
): CardDropPlan | null {
  const active = getCard(doc, activeId)
  if (!active) return null

  const { dayStart, dayEnd } = getTrip(doc)
  const plan = planCardDrop({
    card: active,
    targetDayKey,
    offsetPx,
    dayStart,
    dayEnd,
    direction,
  })

  commitCardDropPlan(doc, activeId, plan)
  return plan
}

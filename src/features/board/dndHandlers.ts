import type * as Y from 'yjs'
import { getCard, getTrip, updateCardSchedules } from '../../data/doc'
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

function moveEditKind(
  currentStart: number,
  requestedStart: number,
  direction: TimeDirection,
): TimelineEditKind {
  const movedTowardTop =
    direction === 'down' ? requestedStart < currentStart : requestedStart > currentStart
  return movedTowardTop ? 'move-top' : 'move-bottom'
}

/** Schedule only the dropped card; overlaps are valid timeline state. */
export function applyCardDrop(
  doc: Y.Doc,
  { activeId, targetDayKey, offsetPx }: CardDrop,
  direction: TimeDirection = 'down',
): void {
  const active = getCard(doc, activeId)
  if (!active) return

  const { dayStart, dayEnd } = getTrip(doc)
  const activeDuration = resolvedDurationHours(active, dayStart, dayEnd)
  const requested = clockMinutes(
    dropTimeForOffset(offsetPx, activeDuration, dayStart, dayEnd, direction),
  )
  const currentStart = active.startTime ? clockMinutes(active.startTime) : requested
  const result = planTimelineSchedule({
    active: { id: activeId, start: currentStart, duration: activeDuration * 60 },
    requested: { start: requested, duration: activeDuration * 60 },
    dayStart: clockMinutes(dayStart),
    dayEnd: clockMinutes(dayEnd),
    edit: moveEditKind(currentStart, requested, direction),
    direction,
  })

  updateCardSchedules(doc, [
    { id: activeId, dayKey: targetDayKey, startTime: clockString(result.activeStart) },
  ])
}

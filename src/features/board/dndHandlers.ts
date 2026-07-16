import type * as Y from 'yjs'
import { getCard, getTrip, listCards, updateCardSchedules } from '../../data/doc'
import type { Card } from '../../data/schema'
import {
  clockMinutes,
  clockString,
  PX_PER_HOUR,
  resolvedDurationHours,
} from '../cards/cardHeight'
import { isTimed } from '../cards/cardSort'
import type { TimeDirection } from './timeDirection'

const SNAP_MINUTES = 30
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

export function timelineDropOffset(droppedTop: number, timelineTop: number, scrollTop: number): number {
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
  const earliest = Math.ceil(first / SNAP_MINUTES) * SNAP_MINUTES
  const latest = Math.floor((end - durationHours * 60) / SNAP_MINUTES) * SNAP_MINUTES
  if (latest < earliest) return clockString(first)
  const raw =
    direction === 'down'
      ? first + (offsetPx / PX_PER_HOUR) * 60
      : end - durationHours * 60 - (offsetPx / PX_PER_HOUR) * 60
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES
  return clockString(Math.min(Math.max(snapped, earliest), latest))
}

export interface CardDrop {
  activeId: string
  targetDayKey: string
  /** Dropped card top, in pixels from the target timeline's top edge. */
  offsetPx: number
}

interface PushResult {
  pushed: Map<string, number>
  end: number
}

function pushCollisions(
  cards: Card[],
  desiredStart: number,
  activeDurationMinutes: number,
  dayStart: string,
  dayEnd: string,
): PushResult {
  const pushed = new Map<string, number>()
  let cursor = desiredStart + activeDurationMinutes
  const firstCollision = cards.findIndex((card) => {
    const start = clockMinutes(card.startTime!)
    const end = start + resolvedDurationHours(card, dayStart, dayEnd) * 60
    return end > desiredStart
  })

  if (firstCollision < 0) return { pushed, end: cursor }

  for (const card of cards.slice(firstCollision)) {
    const start = clockMinutes(card.startTime!)
    if (start >= cursor) break
    pushed.set(card.id, cursor)
    cursor += resolvedDurationHours(card, dayStart, dayEnd) * 60
  }
  return { pushed, end: cursor }
}

/** Schedule a dropped card and push its collision chain later on the timeline. */
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
  const first = Math.ceil(clockMinutes(dayStart) / SNAP_MINUTES) * SNAP_MINUTES
  const last = clockMinutes(dayEnd)
  const targetCards = listCards(doc)
    .filter((card) => card.id !== activeId && card.dayKey === targetDayKey && isTimed(card))
    .sort(
      (a, b) =>
        clockMinutes(a.startTime!) - clockMinutes(b.startTime!) ||
        a.order - b.order ||
        a.id.localeCompare(b.id),
    )

  let start = requested
  let result = pushCollisions(targetCards, start, activeDuration * 60, dayStart, dayEnd)
  for (
    let guard = 0;
    result.end > last && start > first && guard <= targetCards.length;
    guard += 1
  ) {
    const overflow = result.end - last
    start = Math.max(first, Math.floor((start - overflow) / SNAP_MINUTES) * SNAP_MINUTES)
    result = pushCollisions(targetCards, start, activeDuration * 60, dayStart, dayEnd)
  }

  // If even the earliest packing cannot fit, keep the requested drop and
  // preserve the existing schedule. Overlap is visible and editable; a time
  // outside the configured day is not.
  if (result.end > last) {
    start = requested
    result = { pushed: new Map(), end: requested + activeDuration * 60 }
  }

  updateCardSchedules(doc, [
    { id: activeId, dayKey: targetDayKey, startTime: clockString(start) },
    ...[...result.pushed].map(([id, minutes]) => ({ id, startTime: clockString(minutes) })),
  ])
}

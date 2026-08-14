import type { Card } from '../../data/schema'
import { clockMinutes, clockString, resolvedDurationHours } from '../cards/cardHeight'
import { sortCardsForColumn } from '../cards/cardSort'

export interface TimelineSlot {
  startTime: string
  endTime: string
}

export interface TimelineCardPlacement {
  card: Card
  /** Distance from the visual top of the timeline, in minutes. */
  offsetMinutes: number
  durationMinutes: number
}

/**
 * Lay cards onto the visible timeline. Timed cards aim for their clock position;
 * when that position is already occupied they follow the preceding card.
 * Untimed cards always follow the preceding rendered card.
 */
export function layoutTimelineCards(
  cards: Card[],
  dayStart: string,
  dayEnd: string,
): TimelineCardPlacement[] {
  const start = clockMinutes(dayStart)
  let cursor = 0

  return sortCardsForColumn(cards).map((card) => {
    const durationMinutes = resolvedDurationHours(card, dayStart, dayEnd) * 60
    const desiredOffset = card.startTime ? clockMinutes(card.startTime) - start : cursor
    const offsetMinutes = Math.max(0, cursor, desiredOffset)
    cursor = offsetMinutes + durationMinutes
    return { card, offsetMinutes, durationMinutes }
  })
}

/** Free portions of the configured day after rendered card positions are occupied. */
export function freeTimelineSlots(
  cards: Card[],
  dayStart: string,
  dayEnd: string,
): TimelineSlot[] {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const windowMinutes = end - start
  const occupied = layoutTimelineCards(cards, dayStart, dayEnd)
    .map(({ offsetMinutes, durationMinutes }) => ({
      start: Math.min(windowMinutes, offsetMinutes),
      end: Math.min(windowMinutes, offsetMinutes + durationMinutes),
    }))
    .filter((interval) => interval.end > interval.start)

  let cursor = 0
  const slots: TimelineSlot[] = []
  for (const interval of occupied) {
    if (interval.start > cursor) {
      slots.push(toClockSlot(cursor, interval.start, start))
    }
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < windowMinutes) {
    slots.push(toClockSlot(cursor, windowMinutes, start))
  }
  return slots
}

function toClockSlot(offsetStart: number, offsetEnd: number, dayStart: number): TimelineSlot {
  return {
    startTime: clockString(dayStart + offsetStart),
    endTime: clockString(dayStart + offsetEnd),
  }
}

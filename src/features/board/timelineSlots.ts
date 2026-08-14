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
 * Lay cards onto the visible timeline. A timed card sits at its clock position —
 * always, even when that overlaps its neighbour. Untimed cards have no time of
 * their own, so they flow after the last card rendered before them.
 *
 * Timed cards used to be pushed down to clear an earlier card. That quietly
 * broke the grid's one promise: a card's top edge is its start time. Stretching
 * one card's end shifted the *next* card away from the hour it still displayed,
 * so the card and the gutter disagreed. Overlaps are allowed here and called out
 * by the "Overlap" badge instead.
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
    const offsetMinutes = card.startTime
      ? Math.max(0, clockMinutes(card.startTime) - start)
      : cursor
    // Untimed cards stack below everything placed so far, overlaps included.
    cursor = Math.max(cursor, offsetMinutes + durationMinutes)
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

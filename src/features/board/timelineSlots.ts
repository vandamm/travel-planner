import type { Card } from '../../data/schema'
import { clockMinutes, clockString, resolvedDurationHours } from '../cards/cardHeight'
import { orderCardsForDirection, type TimeDirection } from './timeDirection'

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

/** Human-readable duration for the resting free-time target label. */
export function formatFreeDuration(startTime: string, endTime: string): string {
  const minutes = clockMinutes(endTime) - clockMinutes(startTime)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} free`
  return `${hours}h ${remainder}m free`
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
  direction: TimeDirection,
): TimelineCardPlacement[] {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  let cursor = 0

  return orderCardsForDirection(cards, direction).map((card) => {
    const durationMinutes = resolvedDurationHours(card, dayStart, dayEnd) * 60
    const desiredOffset = card.startTime
      ? direction === 'up'
        ? end - (clockMinutes(card.startTime) + durationMinutes)
        : clockMinutes(card.startTime) - start
      : cursor
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
  direction: TimeDirection = 'down',
): TimelineSlot[] {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const windowMinutes = end - start
  const occupied = layoutTimelineCards(cards, dayStart, dayEnd, direction)
    .map(({ offsetMinutes, durationMinutes }) => ({
      start: Math.min(windowMinutes, offsetMinutes),
      end: Math.min(windowMinutes, offsetMinutes + durationMinutes),
    }))
    .filter((interval) => interval.end > interval.start)

  let cursor = 0
  const slots: TimelineSlot[] = []
  for (const interval of occupied) {
    if (interval.start > cursor) {
      slots.push(toClockSlot(cursor, interval.start, start, end, direction))
    }
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < windowMinutes) {
    slots.push(toClockSlot(cursor, windowMinutes, start, end, direction))
  }
  return slots
}

function toClockSlot(
  offsetStart: number,
  offsetEnd: number,
  dayStart: number,
  dayEnd: number,
  direction: TimeDirection,
): TimelineSlot {
  return direction === 'up'
    ? { startTime: clockString(dayEnd - offsetEnd), endTime: clockString(dayEnd - offsetStart) }
    : { startTime: clockString(dayStart + offsetStart), endTime: clockString(dayStart + offsetEnd) }
}

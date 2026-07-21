import type { Card } from '../../data/schema'
import { clockMinutes, clockString, resolvedDurationHours } from '../cards/cardHeight'

export interface TimelineSlot {
  startTime: string
  endTime: string
}

/** Free portions of the configured day after all timed activities are merged. */
export function freeTimelineSlots(cards: Card[], dayStart: string, dayEnd: string): TimelineSlot[] {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const occupied = cards
    .filter((card) => card.startTime)
    .map((card) => ({
      start: Math.max(start, clockMinutes(card.startTime!)),
      end: Math.min(
        end,
        clockMinutes(card.startTime!) + resolvedDurationHours(card, dayStart, dayEnd) * 60,
      ),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start)

  let cursor = start
  const slots: TimelineSlot[] = []
  for (const interval of occupied) {
    if (interval.start > cursor) {
      slots.push({ startTime: clockString(cursor), endTime: clockString(interval.start) })
    }
    cursor = Math.max(cursor, interval.end)
  }
  if (cursor < end) slots.push({ startTime: clockString(cursor), endTime: clockString(end) })
  return slots
}

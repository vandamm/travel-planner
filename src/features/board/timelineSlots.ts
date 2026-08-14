import type { Card } from '../../data/schema'
import { clockMinutes, clockString, resolvedDurationHours } from '../cards/cardHeight'
import { sortCardsForColumn } from '../cards/cardSort'
import { travelLeadMinutes } from '../cards/travelTime'

export interface TimelineSlot {
  startTime: string
  endTime: string
}

export interface TimelineCardPlacement {
  card: Card
  /** Distance from the visual top of the timeline, in minutes. */
  offsetMinutes: number
  durationMinutes: number
  /**
   * Travel lead-in above {@link offsetMinutes}, in minutes. Occupied time, not
   * decoration — the card's block really begins `leadMinutes` earlier.
   */
  leadMinutes: number
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
  showTravelTimes = true,
): TimelineCardPlacement[] {
  const start = clockMinutes(dayStart)
  let cursor = 0

  return sortCardsForColumn(cards).map((card) => {
    const durationMinutes = resolvedDurationHours(card, dayStart, dayEnd) * 60
    const leadMinutes = travelLeadMinutes(card, showTravelTimes)
    const offsetMinutes = card.startTime
      ? Math.max(0, clockMinutes(card.startTime) - start)
      : cursor
    // Untimed cards stack below everything placed so far, overlaps included.
    cursor = Math.max(cursor, offsetMinutes + durationMinutes)
    return { card, offsetMinutes, durationMinutes, leadMinutes }
  })
}

/**
 * Free portions of the configured day after rendered card positions are
 * occupied. A card's travel lead-in occupies time too — offering "＋ plan
 * something" during the drive there would be offering time that is already spent.
 */
export function freeTimelineSlots(
  cards: Card[],
  dayStart: string,
  dayEnd: string,
  showTravelTimes = true,
): TimelineSlot[] {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const windowMinutes = end - start
  const occupied = layoutTimelineCards(cards, dayStart, dayEnd, showTravelTimes)
    .map(({ offsetMinutes, durationMinutes, leadMinutes }) => ({
      // A lead-in may reach back past the window's start; clamp it to the top
      // rather than letting a negative bound reopen time before the day begins.
      start: Math.max(0, Math.min(windowMinutes, offsetMinutes - leadMinutes)),
      end: Math.min(windowMinutes, offsetMinutes + durationMinutes),
    }))
    .filter((interval) => interval.end > interval.start)
    // Card order is start-*time* order, which a lead-in can invert: a 09:00 card
    // with an hour of travel opens before an 08:30 one with none. The sweep below
    // walks the intervals in order, so re-sort on the occupied start.
    .sort((a, b) => a.start - b.start)

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

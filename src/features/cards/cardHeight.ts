// The vertical scale of the day timeline and a card's height on it.
//
// Pure logic (no React/dnd imports) so `DayColumn` stays presentational and the
// math is unit-testable. A card's height is normally its *duration* (empty time
// stays visible); a `size` preset overrides that with a height relative to the
// day's timeline window — `small` a sliver, `half` half the window, `full` the
// whole window.

import type { Card } from '../../data/schema'

/** Pixels per hour of the time window — the timeline's vertical scale. */
export const PX_PER_HOUR = 44
/** Fallback span (hours) for an untimed card or a timed card with no end. */
export const DEFAULT_CARD_HOURS = 1
/** Height (hours) of the `small` preset. */
const SMALL_CARD_HOURS = 0.5

/** Minutes since midnight for an 'HH:mm' clock string; 0 when unparseable. */
export function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0
}

/** 'HH:mm' for minutes since midnight (inverse of {@link clockMinutes}). */
export function clockString(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Length of the day window in hours (floored to a default block). */
function windowHours(dayStart: string, dayEnd: string): number {
  return Math.max((clockMinutes(dayEnd) - clockMinutes(dayStart)) / 60, DEFAULT_CARD_HOURS)
}

/** Body height (px) for the day window; never shorter than one default block. */
export function windowHeightPx(dayStart: string, dayEnd: string): number {
  return windowHours(dayStart, dayEnd) * PX_PER_HOUR
}

/**
 * A card's height (px). A `size` preset (other than `auto`) sets a fixed height
 * relative to the day window; otherwise the height is scaled by the card's
 * duration: end−start, with a timed card lacking an end (and any untimed card)
 * given the default block. Bad/overnight ranges floor to the default block.
 */
export function cardHeightPx(card: Card, dayStart: string, dayEnd: string): number {
  switch (card.size) {
    case 'small':
      return SMALL_CARD_HOURS * PX_PER_HOUR
    case 'half':
      return Math.max(windowHours(dayStart, dayEnd) / 2, DEFAULT_CARD_HOURS) * PX_PER_HOUR
    case 'full':
      return windowHours(dayStart, dayEnd) * PX_PER_HOUR
  }
  if (!card.startTime) return DEFAULT_CARD_HOURS * PX_PER_HOUR
  const start = clockMinutes(card.startTime)
  const end = card.endTime ? clockMinutes(card.endTime) : start + 60
  return Math.max((end - start) / 60, DEFAULT_CARD_HOURS) * PX_PER_HOUR
}

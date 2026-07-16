// The vertical scale of the day timeline and a card's height on it.
//
// Pure logic (no React/dnd imports) so `DayColumn` stays presentational and the
// math is unit-testable. A card's duration is either the configured day, half
// that window, or its explicit custom-hour value.

import type { Card } from '../../data/schema'

/** Pixels per hour of the time window — the timeline's vertical scale. */
export const PX_PER_HOUR = 60
/** Default span for a new custom card. */
export const DEFAULT_CARD_HOURS = 1

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
 * Fraction (0..1) of the day window at which noon (12:00) falls — drives the
 * board's positional NOON divider. Clamped to the window, so a window that never
 * reaches noon pins the divider to an edge rather than overflowing.
 */
export function noonFraction(dayStart: string, dayEnd: string): number {
  const start = clockMinutes(dayStart)
  const span = clockMinutes(dayEnd) - start
  if (span <= 0) return 0.5
  return Math.min(1, Math.max(0, (clockMinutes('12:00') - start) / span))
}

/** Resolve a card duration to positive hours for layout, labels, and drag math. */
export function resolvedDurationHours(card: Card, dayStart: string, dayEnd: string): number {
  switch (card.duration) {
    case 'day':
      return windowHours(dayStart, dayEnd)
    case 'half':
      return windowHours(dayStart, dayEnd) / 2
    case 'custom':
      return card.durationHours && card.durationHours > 0 ? card.durationHours : DEFAULT_CARD_HOURS
  }
}

/** A card's height in pixels. */
export function cardHeightPx(card: Card, dayStart: string, dayEnd: string): number {
  return resolvedDurationHours(card, dayStart, dayEnd) * PX_PER_HOUR
}

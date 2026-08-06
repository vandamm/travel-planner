// The vertical scale of the day timeline and a card's height on it.
//
// Pure logic (no React/dnd imports) so `DayColumn` stays presentational and the
// math is unit-testable. A card's duration is either the configured day, half
// that window, or its explicit custom-hour value.

import type { Card } from '../../data/schema'

/** Pixels per hour of the time window — the timeline's vertical scale. */
export const PX_PER_HOUR = 60
/** Space reserved outside the activity track for the Morning/Evening labels. */
export const TIMELINE_VERTICAL_PADDING_PX = 24
/** Timeline and custom-duration granularity. */
export const SNAP_MINUTES = 15
/** Smallest permitted custom-card duration. */
export const MIN_CARD_MINUTES = SNAP_MINUTES
/** Default span for a new custom card. */
export const DEFAULT_CARD_HOURS = 1

/** Convert a duration between the document's hours and timeline minutes. */
export function hoursToMinutes(hours: number): number {
  return hours * 60
}

/** Convert a duration between the timeline's minutes and document hours. */
export function minutesToHours(minutes: number): number {
  return minutes / 60
}

/** Whether a custom duration is at least one snapped 15-minute interval. */
export function isValidCustomDurationHours(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  const minutes = hoursToMinutes(value)
  return Number.isInteger(minutes) && minutes >= MIN_CARD_MINUTES && minutes % SNAP_MINUTES === 0
}

/** Whether a stored custom duration can be rendered without data loss. */
function isReadableCustomDurationHours(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minutesToHours(MIN_CARD_MINUTES)
}

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

/** Resolve a card duration to positive hours for layout, labels, and drag math. */
export function resolvedDurationHours(card: Card, dayStart: string, dayEnd: string): number {
  switch (card.duration) {
    case 'day':
      return windowHours(dayStart, dayEnd)
    case 'half':
      return windowHours(dayStart, dayEnd) / 2
    case 'custom':
      return isReadableCustomDurationHours(card.durationHours)
        ? card.durationHours
        : DEFAULT_CARD_HOURS
  }
}

/** A card's height in pixels. */
export function cardHeightPx(card: Card, dayStart: string, dayEnd: string): number {
  return resolvedDurationHours(card, dayStart, dayEnd) * PX_PER_HOUR
}

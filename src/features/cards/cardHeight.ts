// The vertical scale of the day timeline and a card's height on it.
//
// Pure logic (no React/dnd imports) so `DayColumn` stays presentational and the
// math is unit-testable. A card's duration is either the configured day, half
// that window, or its explicit custom-hour value.

import type { Card } from '../../data/schema'

/**
 * Pixels per hour of the time window — the timeline's vertical scale.
 *
 * The board stretches this so the day fills the viewport (see
 * {@link fitPxPerHour}), so it is a *runtime* value, passed to every helper
 * here as a trailing argument. This constant is the floor and the default: what
 * anything without a viewport to measure uses — tests, the Worker — and the
 * smallest an hour is ever drawn, below which the board scrolls instead.
 */
export const MIN_PX_PER_HOUR = 50

/**
 * The scale that makes a `windowHours`-long day exactly fill `availableHeightPx`,
 * never squeezing an hour below {@link MIN_PX_PER_HOUR} — past that the day is
 * taller than the space and the board scrolls, which beats an illegible grid.
 *
 * Floored to a whole pixel so rails and card edges land on the same device
 * pixel rather than drifting a fraction apart down the column.
 */
export function fitPxPerHour(availableHeightPx: number, windowHours: number): number {
  if (!Number.isFinite(availableHeightPx) || windowHours <= 0) return MIN_PX_PER_HOUR
  return Math.max(MIN_PX_PER_HOUR, Math.floor(availableHeightPx / windowHours))
}
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

/**
 * The even hours inside a day window — the ones that get a gutter label and a
 * horizontal rail. The scale is marked every two hours, not every hour (v4).
 */
export function evenHourMarks(dayStart: string, dayEnd: string): number[] {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const first = Math.ceil(start / 60)
  return Array.from({ length: Math.max(0, Math.ceil(end / 60) - first + 1) }, (_, i) => first + i)
    .filter((hour) => hour % 2 === 0 && hour * 60 >= start && hour * 60 <= end)
}

/**
 * How an hour label should sit against its rail. Centred normally, but the
 * first and last rails are the track's own edges — centring there would hang
 * half the label outside the grid, where the footer covers it (and where it
 * counts toward the scroll height).
 */
export function hourMarkAlignment(
  offsetPx: number,
  trackHeightPx: number,
): 'start' | 'center' | 'end' {
  if (offsetPx <= 0) return 'start'
  if (offsetPx >= trackHeightPx) return 'end'
  return 'center'
}

/** Length of the day window in hours (floored to a default block). */
export function windowHours(dayStart: string, dayEnd: string): number {
  return Math.max((clockMinutes(dayEnd) - clockMinutes(dayStart)) / 60, DEFAULT_CARD_HOURS)
}

/** Body height (px) for the day window; never shorter than one default block. */
export function windowHeightPx(
  dayStart: string,
  dayEnd: string,
  pxPerHour: number = MIN_PX_PER_HOUR,
): number {
  return windowHours(dayStart, dayEnd) * pxPerHour
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
export function cardHeightPx(
  card: Card,
  dayStart: string,
  dayEnd: string,
  pxPerHour: number = MIN_PX_PER_HOUR,
): number {
  return resolvedDurationHours(card, dayStart, dayEnd) * pxPerHour
}

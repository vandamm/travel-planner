// Pure day-list generation for the board.
//
// A trip is the inclusive range from `startDate` through `endDate`. Each day's
// `key` is its ISO date 'YYYY-MM-DD' — also the
// identity used by cards (`dayKey`) and per-day city overrides. Resolution of a
// day's *city* lives separately in `cityResolution.ts`; this module only lays
// out the dates.

import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import type { Day } from './schema'

/** The canonical day-key format: ISO date-only, 'YYYY-MM-DD'. */
export const DAY_KEY_FORMAT = 'yyyy-MM-dd'

/**
 * Hard upper bound on the number of days a trip can span. It guards every day
 * source — the setup UI, JSON import, and the agent API — against a pathological
 * date range that would otherwise build an enormous array and
 * freeze or OOM the tab. ~2 years is far beyond any real trip.
 */
export const MAX_TRIP_DAYS = 730

/** Format a `Date` as a day key in trip-local calendar terms. */
export function toDayKey(date: Date): string {
  return format(date, DAY_KEY_FORMAT)
}

/** Number of calendar days in an inclusive trip range, or zero when unset/invalid. */
export function inclusiveDayCount(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (!isValid(start) || !isValid(end)) return 0
  return Math.max(0, differenceInCalendarDays(end, start) + 1)
}

/**
 * Build the ordered list of days for a trip. Returns `[]` when there is no
 * complete, non-reversed range, so callers can render an empty board
 * before the trip is set up. Day math is calendar-based (date-fns), so month,
 * leap-year, and year boundaries are handled correctly.
 */
export function generateDays(startDate: string, endDate: string): Day[] {
  const count = Math.min(inclusiveDayCount(startDate, endDate), MAX_TRIP_DAYS)
  if (count === 0) return []
  const start = parseISO(startDate)
  const days: Day[] = []
  for (let index = 0; index < count; index++) {
    days.push({ key: toDayKey(addDays(start, index)), index })
  }
  return days
}

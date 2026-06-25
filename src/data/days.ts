// Pure day-list generation for the board.
//
// A trip is `numDays` consecutive calendar days starting at `startDate`
// (inclusive). Each day's `key` is its ISO date 'YYYY-MM-DD' — also the
// identity used by cards (`dayKey`) and per-day city overrides. Resolution of a
// day's *city* lives separately in `cityResolution.ts`; this module only lays
// out the dates.

import { addDays, format, parseISO } from 'date-fns'
import type { Day } from './schema'

/** The canonical day-key format: ISO date-only, 'YYYY-MM-DD'. */
export const DAY_KEY_FORMAT = 'yyyy-MM-dd'

/** Format a `Date` as a day key in trip-local calendar terms. */
export function toDayKey(date: Date): string {
  return format(date, DAY_KEY_FORMAT)
}

/**
 * Build the ordered list of days for a trip. Returns `[]` when there is no
 * start date or the count is not positive, so callers can render an empty board
 * before the trip is set up. Day math is calendar-based (date-fns), so month,
 * leap-year, and year boundaries are handled correctly.
 */
export function generateDays(startDate: string, numDays: number): Day[] {
  if (!startDate || numDays <= 0) return []
  const start = parseISO(startDate)
  const days: Day[] = []
  for (let index = 0; index < numDays; index++) {
    days.push({ key: toDayKey(addDays(start, index)), index })
  }
  return days
}

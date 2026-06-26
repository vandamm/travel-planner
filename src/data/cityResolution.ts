// Hybrid resolution of a day's city (and therefore its color).
//
// Precedence, highest first:
//   1. A per-day manual override (`dayOverrides`) — the planner pinned a city.
//   2. The covering accommodation's city — you sleep there, so the day inherits
//      that city. When stays overlap (e.g. a checkout/check-in day), the most
//      recent check-in wins.
//   3. Nothing — a travel day with no stay and no override has no city.
//
// All inputs are plain values (ISO date strings, plain accommodation objects),
// so this is environment-agnostic and shared by the client and the Worker.
// ISO 'YYYY-MM-DD' strings sort lexicographically, which is why the span checks
// and the "latest check-in" comparison can use plain string comparison.

import type { Accommodation, Day } from './schema'

/**
 * Whether an accommodation's inclusive night span covers a given day. A stay
 * with `startNight`..`endNight` colors exactly the day columns on which a night
 * is slept; the checkout morning (`endNight` + 1) is not covered.
 */
export function accommodationCoversDay(acc: Accommodation, dayKey: string): boolean {
  return acc.startNight <= dayKey && dayKey <= acc.endNight
}

/**
 * Resolve the city id for a single day. Returns `undefined` when nothing
 * applies (a travel day). `overrides` maps day key → city id.
 */
export function resolveDayCity(
  dayKey: string,
  accommodations: Accommodation[],
  overrides: Record<string, string> = {},
): string | undefined {
  const override = overrides[dayKey]
  if (override) return override

  const covering = accommodations
    .filter((a) => a.cityId && accommodationCoversDay(a, dayKey))
    // Most recent check-in wins on overlapping days.
    .sort((a, b) => (a.startNight < b.startNight ? 1 : a.startNight > b.startNight ? -1 : 0))

  return covering[0]?.cityId
}

/**
 * Day keys not covered by any stay. A day is "covered" if some accommodation's
 * night span includes it (cityId irrelevant — sleeping there is what counts).
 * These are the trip's gaps: the nights still missing a place to sleep.
 */
export function uncoveredDays(days: Day[], accommodations: Accommodation[]): string[] {
  return days
    .map((d) => d.key)
    .filter((key) => !accommodations.some((a) => accommodationCoversDay(a, key)))
}

/** First uncovered day key, or `undefined` when every day has a stay. */
export function firstUncoveredDay(
  days: Day[],
  accommodations: Accommodation[],
): string | undefined {
  return uncoveredDays(days, accommodations)[0]
}

/**
 * Uncovered days grouped into contiguous runs (by `days` order). Each run is the
 * full list of day keys in that gap; `gap[0]` is the gap's first day — where the
 * per-gap "Add stay" button lives.
 */
export function uncoveredGaps(days: Day[], accommodations: Accommodation[]): string[][] {
  const order = days.map((d) => d.key)
  const uncovered = new Set(uncoveredDays(days, accommodations))
  const gaps: string[][] = []
  let run: string[] = []
  for (const key of order) {
    if (uncovered.has(key)) {
      run.push(key)
    } else if (run.length) {
      gaps.push(run)
      run = []
    }
  }
  if (run.length) gaps.push(run)
  return gaps
}

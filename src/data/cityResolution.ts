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

import type { Accommodation } from './schema'

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

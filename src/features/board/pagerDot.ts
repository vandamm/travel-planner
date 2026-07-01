// The fill colour for the mobile pager's active day dot: the day's resolved city
// colour (via the same `resolveDayCity` the board uses), falling back to
// `NO_CITY_COLOR` for a travel day with no city. Pure and DOM-free so it stays
// unit-testable and never drifts from the day-header colour.

import type { Accommodation, City } from '../../data/schema'
import { resolveDayCity } from '../../data/cityResolution'
import { NO_CITY_COLOR } from '../cities/colors'

export function dayDotColor(
  dayKey: string,
  accommodations: Accommodation[],
  overrides: Record<string, string>,
  cityById: Map<string, City>,
): string {
  const cityId = resolveDayCity(dayKey, accommodations, overrides)
  return (cityId ? cityById.get(cityId)?.color : undefined) ?? NO_CITY_COLOR
}

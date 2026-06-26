// A small palette of visually distinct city colours and a picker that prefers
// an unused one, so a freshly added city doesn't default to the same blue every
// time (still overridable via the colour input in `CityManager`).

/** ~12 distinct, legible hex colours for city colour-coding. */
export const CITY_PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#eab308', // yellow
] as const

/**
 * Pick a palette colour, preferring one not in `used`. Falls back to any
 * palette colour once all are taken.
 */
export function randomCityColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()))
  const free = CITY_PALETTE.filter((c) => !taken.has(c.toLowerCase()))
  const pool = free.length > 0 ? free : CITY_PALETTE
  return pool[Math.floor(Math.random() * pool.length)]
}

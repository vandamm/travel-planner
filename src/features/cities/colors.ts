// A small palette of visually distinct city colours and a picker that prefers
// an unused one, so a freshly added city doesn't default to the same blue every
// time (still overridable via the colour input in `CityModal`).

/**
 * Curated "ink & type" city hues. Leads with the four named design hues
 * (vermilion/pine/indigo/plum) followed by a few harmonious extras for variety.
 */
export const CITY_PALETTE = [
  '#c0392b', // vermilion
  '#5f6f44', // pine
  '#3a4a5c', // indigo
  '#8a5a78', // plum
  '#b07d3f', // ochre
  '#4f7c74', // teal-green
  '#6b5b8a', // muted violet
  '#a85c3a', // terracotta
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

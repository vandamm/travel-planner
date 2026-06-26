import { describe, expect, it } from 'vitest'
import { CITY_PALETTE, randomCityColor } from './colors'

describe('randomCityColor', () => {
  it('returns a palette colour when nothing is used', () => {
    expect(CITY_PALETTE).toContain(randomCityColor([]))
  })

  it('prefers a palette colour not already used', () => {
    // Every palette colour but the last is taken → the last is the only choice.
    const used = CITY_PALETTE.slice(0, -1)
    const last = CITY_PALETTE[CITY_PALETTE.length - 1]
    expect(randomCityColor(used)).toBe(last)
  })

  it('still returns a palette colour when all are used', () => {
    expect(CITY_PALETTE).toContain(randomCityColor([...CITY_PALETTE]))
  })

  it('ignores used colours outside the palette', () => {
    expect(CITY_PALETTE).toContain(randomCityColor(['#123456', '#abcdef']))
  })
})

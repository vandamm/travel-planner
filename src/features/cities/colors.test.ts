import { describe, expect, it } from 'vitest'
import { CITY_PALETTE, randomCityColor } from './colors'

describe('CITY_PALETTE', () => {
  it('leads with the four design hues (vermilion/pine/indigo/plum)', () => {
    expect(CITY_PALETTE.slice(0, 4)).toEqual([
      '#c0392b', // vermilion
      '#5f6f44', // pine
      '#3a4a5c', // indigo
      '#8a5a78', // plum
    ])
  })
})

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

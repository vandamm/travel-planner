import { describe, expect, it } from 'vitest'
import type { Accommodation, City } from '../../data/schema'
import { NO_CITY_COLOR } from '../cities/colors'
import { dayDotColor } from './pagerDot'

const cityById = new Map<string, City>([['kyoto', { id: 'kyoto', name: 'Kyoto', color: '#5f6f44' }]])

describe('dayDotColor', () => {
  it('uses the resolved city colour when the day has a city', () => {
    const stay: Accommodation = {
      id: 's1',
      label: 'Ryokan',
      cityId: 'kyoto',
      startNight: '2027-05-01',
      endNight: '2027-05-03',
    }
    expect(dayDotColor('2027-05-02', [stay], {}, cityById)).toBe('#5f6f44')
  })

  it('honours a manual day override', () => {
    expect(dayDotColor('2027-05-02', [], { '2027-05-02': 'kyoto' }, cityById)).toBe('#5f6f44')
  })

  it('falls back to NO_CITY_COLOR on a travel day with no city', () => {
    expect(dayDotColor('2027-05-02', [], {}, cityById)).toBe(NO_CITY_COLOR)
  })

  it('falls back to NO_CITY_COLOR when the resolved city is unknown', () => {
    expect(dayDotColor('2027-05-02', [], { '2027-05-02': 'ghost' }, cityById)).toBe(NO_CITY_COLOR)
  })
})

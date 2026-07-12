import { describe, expect, it } from 'vitest'
import { buildMonth, tripsOnDay, type TripSummary } from './yearCalendar'

const trip: TripSummary = {
  id: 'japan-2028',
  title: 'Japan',
  startDate: '2028-02-28',
  numDays: 3,
}

describe('year calendar', () => {
  it('builds leap-year months as complete Monday-first weeks', () => {
    const days = buildMonth(2028, 1)
    expect(days).toHaveLength(35)
    expect(days.find((day) => day.key === '2028-02-29')?.inMonth).toBe(true)
    expect(days[0].key).toBe('2028-01-31')
  })

  it('marks every day covered by a trip across a month boundary', () => {
    expect(tripsOnDay('2028-02-28', [trip])).toEqual([trip])
    expect(tripsOnDay('2028-02-29', [trip])).toEqual([trip])
    expect(tripsOnDay('2028-03-01', [trip])).toEqual([trip])
    expect(tripsOnDay('2028-03-02', [trip])).toEqual([])
  })
})

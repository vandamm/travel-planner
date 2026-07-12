import { describe, expect, it } from 'vitest'
import {
  buildMonth,
  parseSchoolHolidays,
  ribbonEdges,
  schoolHolidayEdges,
  schoolHolidayOnDay,
  tripsOnDay,
  type TripSummary,
} from './yearCalendar'

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

  it('caps a trip only at its start, end, and weekly row breaks', () => {
    const days = buildMonth(2028, 1)
    const spanningTrip = { ...trip, startDate: '2028-02-08', numDays: 8 }
    const edges = (key: string) =>
      ribbonEdges(
        days,
        days.findIndex((day) => day.key === key),
        spanningTrip,
        [spanningTrip],
      )

    expect(edges('2028-02-08')).toEqual({ start: true, end: false })
    expect(edges('2028-02-09')).toEqual({ start: false, end: false })
    expect(edges('2028-02-13')).toEqual({ start: false, end: true })
    expect(edges('2028-02-14')).toEqual({ start: true, end: false })
    expect(edges('2028-02-15')).toEqual({ start: false, end: true })
  })

  it('parses external school holidays and matches their inclusive date range', () => {
    const holidays = parseSchoolHolidays([
      {
        startDate: '2026-08-03',
        endDate: '2026-09-14',
        name: [{ language: 'EN', text: 'Summer Holidays' }],
      },
      { startDate: 123, endDate: null },
    ])

    expect(holidays).toEqual([
      { startDate: '2026-08-03', endDate: '2026-09-14', name: 'Summer Holidays' },
    ])
    expect(schoolHolidayOnDay('2026-08-03', holidays)?.name).toBe('Summer Holidays')
    expect(schoolHolidayOnDay('2026-09-14', holidays)?.name).toBe('Summer Holidays')
    expect(schoolHolidayOnDay('2026-09-15', holidays)).toBeUndefined()

    const days = buildMonth(2026, 7)
    expect(schoolHolidayEdges(days, 7, holidays[0], holidays)).toEqual({
      start: true,
      end: false,
    })
    expect(schoolHolidayEdges(days, 8, holidays[0], holidays)).toEqual({
      start: false,
      end: false,
    })
    expect(schoolHolidayEdges(days, 13, holidays[0], holidays)).toEqual({
      start: false,
      end: true,
    })
  })
})

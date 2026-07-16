import { describe, expect, it } from 'vitest'
import {
  buildMonth,
  parsePublicHolidays,
  parseSchoolHolidays,
  publicHolidayOnDay,
  ribbonEdges,
  schoolHolidayEdges,
  schoolHolidayOnDay,
  timelineMonthMarkers,
  formatCountdown,
  futureDatedTrips,
  timelineDaysForHeight,
  timelineHeight,
  timelineLabelTops,
  tripsOnDay,
  type TripSummary,
} from './yearCalendar'

const trip: TripSummary = {
  id: 'japan-2028',
  title: 'Japan',
  startDate: '2028-02-28',
  endDate: '2028-03-01',
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
    const spanningTrip = { ...trip, startDate: '2028-02-08', endDate: '2028-02-15' }
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

  it('parses Bavarian public holidays while excluding municipal-only dates', () => {
    const holidays = parsePublicHolidays([
      {
        startDate: '2026-01-06',
        endDate: '2026-01-06',
        regionalScope: 'Regional',
        name: [{ language: 'EN', text: 'Epiphany' }],
      },
      {
        startDate: '2026-08-08',
        endDate: '2026-08-08',
        regionalScope: 'Local',
        name: [{ language: 'EN', text: 'High Festival of Peace' }],
      },
    ])

    expect(holidays).toEqual([
      { startDate: '2026-01-06', endDate: '2026-01-06', name: 'Epiphany' },
    ])
    expect(publicHolidayOnDay('2026-01-06', holidays)?.name).toBe('Epiphany')
    expect(publicHolidayOnDay('2026-08-08', holidays)).toBeUndefined()
  })

  it('uses one fixed scale for timeline dates', () => {
    expect(timelineHeight(30)).toBe(270)
    expect(timelineDaysForHeight(270)).toBe(30)
  })

  it('stacks nearby timeline labels without changing their date positions', () => {
    expect(timelineLabelTops([0, timelineHeight(1), timelineHeight(2)])).toEqual([0, 52, 104])
  })

  it('uses days, weeks, and months for countdowns', () => {
    expect(formatCountdown(1)).toBe('in 1 day')
    expect(formatCountdown(15)).toBe('in 2 weeks')
    expect(formatCountdown(75)).toBe('in 3 months')
  })

  it('keeps ongoing trips, drops finished trips, and sorts the timeline', () => {
    expect(
      futureDatedTrips(
        [
          { ...trip, id: 'finished', startDate: '2026-01-01', endDate: '2026-01-02' },
          { ...trip, id: 'later', startDate: '2026-08-01', endDate: '2026-08-02' },
          { ...trip, id: 'ongoing', startDate: '2026-07-10', endDate: '2026-07-12' },
        ],
        new Date('2026-07-12T12:00:00'),
      ).map((item) => item.id),
    ).toEqual(['ongoing', 'later'])
  })

  it('keeps month ticks when trips or holidays cross a month boundary', () => {
    expect(
      timelineMonthMarkers(
        '2026-07-12',
        '2026-09-30',
        [{ ...trip, startDate: '2026-07-30', endDate: '2026-08-03' }],
        [{ startDate: '2026-09-01', endDate: '2026-09-10', name: 'Summer Holidays' }],
      ),
    ).toEqual([
      { date: '2026-08-01', embedded: false },
      { date: '2026-09-01', embedded: true },
    ])
  })

  it('omits the starting month marker because Today already names it', () => {
    expect(timelineMonthMarkers('2026-08-01', '2026-09-30', [], [])).toEqual([
      { date: '2026-09-01', embedded: false },
    ])
  })
})

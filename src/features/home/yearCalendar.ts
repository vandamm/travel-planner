import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export interface TripSummary {
  id: string
  createdAt?: string
  title: string
  startDate: string
  numDays: number
}

export interface CalendarDay {
  key: string
  day: number
  inMonth: boolean
}

export interface SchoolHoliday {
  startDate: string
  endDate: string
  name: string
}

function isDayKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function buildMonth(year: number, month: number): CalendarDay[] {
  const first = startOfMonth(new Date(year, month, 1))
  return eachDayOfInterval({
    start: startOfWeek(first, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(first), { weekStartsOn: 1 }),
  }).map((date) => ({
    key: format(date, 'yyyy-MM-dd'),
    day: date.getDate(),
    inMonth: isSameMonth(date, first),
  }))
}

export function tripsOnDay(dayKey: string, trips: TripSummary[]): TripSummary[] {
  return trips.filter(({ startDate, numDays }) => {
    if (!startDate || numDays < 1) return false
    const end = new Date(parseISO(startDate))
    end.setDate(end.getDate() + numDays - 1)
    return dayKey >= startDate && dayKey <= format(end, 'yyyy-MM-dd')
  })
}

/** Rounded caps for one visible ribbon segment; calendar rows break on Sunday. */
export function ribbonEdges(
  days: CalendarDay[],
  index: number,
  trip: TripSummary,
  trips: TripSummary[],
): { start: boolean; end: boolean } {
  const sameTrip = (day: CalendarDay | undefined) =>
    day?.inMonth && tripsOnDay(day.key, trips)[0]?.id === trip.id

  return rangeEdges(days, index, sameTrip)
}

function rangeEdges(
  days: CalendarDay[],
  index: number,
  sameRange: (day: CalendarDay | undefined) => boolean | undefined,
): { start: boolean; end: boolean } {
  return {
    start: index % 7 === 0 || !sameRange(days[index - 1]),
    end: index % 7 === 6 || !sameRange(days[index + 1]),
  }
}

export function parseSchoolHolidays(value: unknown): SchoolHoliday[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const { startDate, endDate, name } = item as Record<string, unknown>
    if (
      typeof startDate !== 'string' ||
      typeof endDate !== 'string' ||
      !isDayKey(startDate) ||
      !isDayKey(endDate) ||
      endDate < startDate
    ) {
      return []
    }
    const names = Array.isArray(name) ? name : []
    const english = names.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        (entry as Record<string, unknown>).language === 'EN' &&
        typeof (entry as Record<string, unknown>).text === 'string',
    ) as Record<string, unknown> | undefined
    return [{ startDate, endDate, name: (english?.text as string) || 'School holidays' }]
  })
}

export function schoolHolidayOnDay(
  dayKey: string,
  holidays: SchoolHoliday[],
): SchoolHoliday | undefined {
  return holidays.find(({ startDate, endDate }) => dayKey >= startDate && dayKey <= endDate)
}

export function schoolHolidayEdges(
  days: CalendarDay[],
  index: number,
  holiday: SchoolHoliday,
  holidays: SchoolHoliday[],
): { start: boolean; end: boolean } {
  return rangeEdges(
    days,
    index,
    (day) => day?.inMonth && schoolHolidayOnDay(day.key, holidays)?.startDate === holiday.startDate,
  )
}

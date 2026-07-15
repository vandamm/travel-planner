import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { inclusiveDayCount } from '../../data/days'

export interface TripSummary {
  id: string
  createdAt?: string
  title: string
  startDate: string
  endDate: string
  color?: string
}

export const TRIP_COLORS = ['#c0392b', '#5f6f44', '#3a4a5c', '#8a5a78'] as const

export function tripDurationDays({ startDate, endDate }: Pick<TripSummary, 'startDate' | 'endDate'>): number {
  return inclusiveDayCount(startDate, endDate)
}

export function timelineHeight(days: number): number {
  return (Math.max(0, days) * 112) / 30
}

export function timelineDaysForHeight(height: number): number {
  return Math.ceil((Math.max(0, height) * 30) / 112)
}

export function formatCountdown(daysUntil: number): string {
  if (daysUntil < 1) return 'Starting soon'
  if (daysUntil < 14) return `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
  if (daysUntil < 60) {
    const weeks = Math.round(daysUntil / 7)
    return `in ${weeks} week${weeks === 1 ? '' : 's'}`
  }
  const months = Math.round(daysUntil / 30)
  return `in ${months} month${months === 1 ? '' : 's'}`
}

export function futureDatedTrips(trips: TripSummary[], referenceDate: Date = new Date()): TripSummary[] {
  const today = format(referenceDate, 'yyyy-MM-dd')
  return trips
    .filter((trip) => tripDurationDays(trip) > 0 && trip.endDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

export function timelineMonthMarkers(
  startDate: string,
  endDate: string,
  trips: TripSummary[],
  holidays: SchoolHoliday[],
): Array<{ date: string; embedded: boolean }> {
  const markers: Array<{ date: string; embedded: boolean }> = []
  for (let date = startOfMonth(new Date(`${startDate}T00:00:00`)); format(date, 'yyyy-MM-dd') <= endDate; date = addDays(endOfMonth(date), 1)) {
    const key = format(date, 'yyyy-MM-dd')
    if (key >= startDate && !tripsOnDay(key, trips).length) {
      markers.push({ date: key, embedded: Boolean(schoolHolidayOnDay(key, holidays)) })
    }
  }
  return markers
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
  return trips.filter(({ startDate, endDate }) => {
    if (inclusiveDayCount(startDate, endDate) === 0) return false
    return dayKey >= startDate && dayKey <= endDate
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

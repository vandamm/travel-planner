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

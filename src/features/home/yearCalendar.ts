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

/** Rounded caps for one visible ribbon segment; calendar rows break on Sunday. */
export function ribbonEdges(
  days: CalendarDay[],
  index: number,
  trip: TripSummary,
  trips: TripSummary[],
): { start: boolean; end: boolean } {
  const sameTrip = (day: CalendarDay | undefined) =>
    day?.inMonth && tripsOnDay(day.key, trips)[0]?.id === trip.id

  return {
    start: index % 7 === 0 || !sameTrip(days[index - 1]),
    end: index % 7 === 6 || !sameTrip(days[index + 1]),
  }
}

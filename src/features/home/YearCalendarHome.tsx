import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { NewTripModal } from './NewTripModal'
import {
  buildMonth,
  parsePublicHolidays,
  parseSchoolHolidays,
  publicHolidayOnDay,
  ribbonEdges,
  schoolHolidayEdges,
  schoolHolidayOnDay,
  tripsOnDay,
  type PublicHoliday,
  type SchoolHoliday,
  type TripSummary,
} from './yearCalendar'

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, month, 1)),
)
const COLORS = ['#3157d5', '#ef6a5b', '#258477', '#8b5bb5', '#d68b24']
const SCHOOL_HOLIDAYS_API = 'https://openholidaysapi.org/SchoolHolidays'
const PUBLIC_HOLIDAYS_API = 'https://openholidaysapi.org/PublicHolidays'

function workerBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')
}

function tripLabel(trip: TripSummary): string {
  return trip.title.trim() || trip.id
}

export function Month({
  year,
  month,
  trips,
  holidays,
  publicHolidays,
  onAddTrip,
}: {
  year: number
  month: number
  trips: TripSummary[]
  holidays: SchoolHoliday[]
  publicHolidays: PublicHoliday[]
  onAddTrip?: (date: string) => void
}) {
  const days = buildMonth(year, month)
  return (
    <section className="rounded-2xl border border-[#dce4f4] bg-white p-4 shadow-[0_10px_30px_rgba(23,35,60,0.05)]">
      <h2 className="mb-3 font-serif text-xl font-semibold text-[#17233c]">{MONTHS[month]}</h2>
      <div
        className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-bold uppercase tracking-[0.14em] text-[#7b879e]"
        aria-hidden
      >
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <span key={index} className={index >= 5 ? 'text-city-vermilion/70' : undefined}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {days.map((day, index) => {
          const matches = day.inMonth ? tripsOnDay(day.key, trips) : []
          const holiday = day.inMonth ? schoolHolidayOnDay(day.key, holidays) : undefined
          const publicHoliday = day.inMonth ? publicHolidayOnDay(day.key, publicHolidays) : undefined
          const isWeekend = day.inMonth && index % 7 >= 5
          const isRedDay = Boolean(publicHoliday) || isWeekend
          const trip = matches[0]
          const color = trip ? COLORS[trips.indexOf(trip) % COLORS.length] : undefined
          const isTripStart = trip?.startDate === day.key
          const edges = trip
            ? ribbonEdges(days, index, trip, trips)
            : holiday
              ? schoolHolidayEdges(days, index, holiday, holidays)
              : null
          const corners = edges
            ? edges.start && edges.end
              ? 'rounded-md'
              : edges.start
                ? 'rounded-l-md'
                : edges.end
                  ? 'rounded-r-md'
                  : 'rounded-none'
            : 'rounded-md'
          const className = `relative flex h-8 items-center justify-center ${corners} text-xs ${
            day.inMonth ? 'text-[#17233c]' : 'text-[#c7cfdd]'
          } ${trip ? 'font-bold text-white' : `${publicHoliday ? 'bg-[#fff0ee]' : holiday ? 'bg-[#edf1e1]' : ''} ${isRedDay ? 'text-city-vermilion' : ''}`}`
          const dayTitle = publicHoliday
            ? `${publicHoliday.name} · Bavaria public holiday`
            : holiday
              ? `${holiday.name} · Bavaria school holidays`
              : undefined
          const contents = trip ? (
            <>
              <time dateTime={day.key}>{day.day}</time>
              {isTripStart && (
                <span className="absolute left-1 top-0 max-w-[calc(700%-0.5rem)] -translate-y-[85%] truncate rounded-full bg-[#17233c] px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  {tripLabel(trip)}
                </span>
              )}
              {matches.length > 1 && (
                <span className="absolute bottom-0.5 right-0.5 text-[8px]">
                  +{matches.length - 1}
                </span>
              )}
            </>
          ) : (
            day.day
          )
          return trip ? (
            <a
              key={day.key}
              href={`/${encodeURIComponent(trip.id)}`}
              aria-label={`${tripLabel(trip)} on ${format(parseISO(day.key), 'd MMMM yyyy')}`}
              title={dayTitle}
              className={className}
              style={{ backgroundColor: color }}
            >
              {contents}
            </a>
          ) : day.inMonth && onAddTrip ? (
            <div key={day.key} title={dayTitle} className={`${className} group`}>
              <time dateTime={day.key}>{contents}</time>
              <button
                type="button"
                aria-label={`Plan trip starting ${format(parseISO(day.key), 'd MMMM yyyy')}`}
                onClick={() => onAddTrip?.(day.key)}
                className="absolute inset-0 grid place-items-center bg-surface text-lg font-semibold text-city-vermilion opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-city-vermilion"
              >
                ＋
              </button>
            </div>
          ) : (
            <time key={day.key} dateTime={day.key} title={dayTitle} className={className}>
              {contents}
            </time>
          )
        })}
      </div>
    </section>
  )
}

export function YearCalendarHome() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([])
  const [publicHolidays, setPublicHolidays] = useState<PublicHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingDate, setCreatingDate] = useState<string | null>(null)

  async function loadTrips() {
    setLoading(true)
    setError('')
    try {
      const allTrips: TripSummary[] = []
      const seen = new Set<string>()
      let cursor: string | null = null
      do {
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
        const response = await fetch(`${workerBase()}/api/rooms${query}`)
        if (!response.ok) throw new Error('Could not load trips')
        const body = (await response.json()) as {
          trips: TripSummary[]
          nextCursor?: string | null
        }
        allTrips.push(...body.trips)
        cursor = body.nextCursor ?? null
        if (cursor && seen.has(cursor)) throw new Error('Repeated room cursor')
        if (cursor) seen.add(cursor)
      } while (cursor)
      setTrips(allTrips)
    } catch {
      setError('Could not load trips. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTrips()
  }, [])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({
      countryIsoCode: 'DE',
      subdivisionCode: 'DE-BY',
      languageIsoCode: 'EN',
      validFrom: `${year}-01-01`,
      validTo: `${year}-12-31`,
    })
    void fetch(`${SCHOOL_HOLIDAYS_API}?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load school holidays')
        return parseSchoolHolidays(await response.json())
      })
      .then((next) => {
        if (active) setHolidays(next)
      })
      .catch(() => {
        if (active) setHolidays([])
      })
    void fetch(`${PUBLIC_HOLIDAYS_API}?${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load public holidays')
        return parsePublicHolidays(await response.json())
      })
      .then((next) => {
        if (active) setPublicHolidays(next)
      })
      .catch(() => {
        if (active) setPublicHolidays([])
      })
    return () => {
      active = false
    }
  }, [year])

  const yearTrips = useMemo(
    () =>
      trips.filter((trip) => {
        if (!trip.startDate || !trip.endDate || trip.endDate < trip.startDate) return false
        return Number(trip.startDate.slice(0, 4)) <= year && Number(trip.endDate.slice(0, 4)) >= year
      }),
    [trips, year],
  )

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-6 text-[#17233c] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-[1480px]">
        <header className="mb-5 flex flex-wrap items-end gap-5 border-b border-[#ccd6e8] pb-6">
          <div className="mr-auto">
            <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-[#3157d5]">
              Travel Planner
            </p>
            <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">
              Your travel year
            </h1>
          </div>
          <div
            className="flex items-center rounded-full border border-[#c7d1e3] bg-white p-1 shadow-sm"
            aria-label="Choose calendar year"
          >
            <button
              aria-label="Previous year"
              onClick={() => setYear((value) => value - 1)}
              className="rounded-full px-3 py-2 text-lg hover:bg-[#eef2fa]"
            >
              ←
            </button>
            <strong className="min-w-20 text-center text-sm">{year}</strong>
            <button
              aria-label="Next year"
              onClick={() => setYear((value) => value + 1)}
              className="rounded-full px-3 py-2 text-lg hover:bg-[#eef2fa]"
            >
              →
            </button>
          </div>
          <button
            onClick={() => setCreatingDate('')}
            className="rounded-full bg-[#3157d5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(49,87,213,0.25)] hover:bg-[#2747b5]"
          >
            ＋ New trip
          </button>
        </header>

        <div className="mb-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-[#65728b]">
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded bg-[#edf1e1]" aria-hidden />
            Bavaria school holidays
          </span>
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-[#f0c4bd] bg-[#fff0ee]" aria-hidden />
            Weekends &amp; Bavaria public holidays
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-xl bg-[#fff0ee] px-4 py-3 text-sm font-semibold text-[#a23b31]"
          >
            {error}
            <button onClick={() => void loadTrips()} className="underline">
              Retry
            </button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {MONTHS.map((_, month) => (
            <Month
              key={month}
              year={year}
              month={month}
              trips={yearTrips}
              holidays={holidays}
              publicHolidays={publicHolidays}
              onAddTrip={setCreatingDate}
            />
          ))}
        </div>

        <section className="mt-8 rounded-2xl bg-[#17233c] p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-serif text-3xl font-semibold">Trips in {year}</h2>
            <span className="text-sm text-[#b8c7e2]">{yearTrips.length} planned</span>
          </div>
          {loading ? (
            <p className="mt-5 text-sm text-[#b8c7e2]">Loading trips…</p>
          ) : yearTrips.length ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {yearTrips.map((trip, index) => {
                const end = parseISO(trip.endDate)
                return (
                  <a
                    key={trip.id}
                    href={`/${encodeURIComponent(trip.id)}`}
                    className="group flex items-center gap-4 rounded-xl bg-white/8 p-4 outline-none ring-white focus-visible:ring-2 hover:bg-white/12"
                  >
                    <span
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="min-w-0">
                      <strong className="block truncate">{tripLabel(trip)}</strong>
                      <span className="text-xs text-[#b8c7e2]">
                        {format(parseISO(trip.startDate), 'd MMM')} – {format(end, 'd MMM')}
                      </span>
                    </span>
                    <span
                      className="ml-auto transition-transform group-hover:translate-x-1"
                      aria-hidden
                    >
                      →
                    </span>
                  </a>
                )
              })}
            </div>
          ) : (
            <p className="mt-5 text-sm text-[#b8c7e2]">No dated trips in this year yet.</p>
          )}
        </section>
      </div>
      {creatingDate !== null && (
        <NewTripModal startDate={creatingDate || undefined} endDate="" onClose={() => setCreatingDate(null)} />
      )}
    </main>
  )
}

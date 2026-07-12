import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Modal } from '../../components/Modal'
import {
  buildMonth,
  parseSchoolHolidays,
  ribbonEdges,
  schoolHolidayEdges,
  schoolHolidayOnDay,
  tripsOnDay,
  type SchoolHoliday,
  type TripSummary,
} from './yearCalendar'

const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, month, 1)),
)
const COLORS = ['#3157d5', '#ef6a5b', '#258477', '#8b5bb5', '#d68b24']
const SCHOOL_HOLIDAYS_API = 'https://openholidaysapi.org/SchoolHolidays'

function workerBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')
}

function tripLabel(trip: TripSummary): string {
  return trip.title.trim() || trip.id
}

function Month({
  year,
  month,
  trips,
  holidays,
}: {
  year: number
  month: number
  trips: TripSummary[]
  holidays: SchoolHoliday[]
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
          <span key={index}>{day}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1">
        {days.map((day, index) => {
          const matches = day.inMonth ? tripsOnDay(day.key, trips) : []
          const holiday = day.inMonth ? schoolHolidayOnDay(day.key, holidays) : undefined
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
          } ${trip ? 'font-bold text-white' : holiday ? 'bg-[#e8efff]' : ''}`
          const holidayTitle = holiday ? `${holiday.name} · Bavaria school holidays` : undefined
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
              title={holidayTitle}
              className={className}
              style={{ backgroundColor: color }}
            >
              {contents}
            </a>
          ) : (
            <time key={day.key} dateTime={day.key} title={holidayTitle} className={className}>
              {contents}
            </time>
          )
        })}
      </div>
    </section>
  )
}

function NewTripModal({ onClose }: { onClose: () => void }) {
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function createTrip(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`${workerBase()}/api/rooms`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ room: slug }),
      })
      const body = (await response.json()) as { id?: string; error?: string }
      if (!response.ok || !body.id) throw new Error(body.error || 'Could not create trip')
      location.assign(`/${body.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create trip')
      setSaving(false)
    }
  }

  return (
    <Modal label="Create a new trip" onClose={onClose} className="w-full max-w-md">
      <form onSubmit={createTrip} className="space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3157d5]">
            New journey
          </p>
          <h2 className="mt-1 font-serif text-3xl font-semibold text-[#17233c]">
            Name the trip link
          </h2>
        </div>
        <label className="block text-sm font-semibold text-[#17233c]">
          Trip slug
          <input
            autoFocus
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="japan-spring-2027"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            className="mt-2 w-full rounded-xl border border-[#b8c4da] px-4 py-3 font-sans text-base outline-none focus:border-[#3157d5] focus:ring-2 focus:ring-[#3157d5]/20"
          />
        </label>
        <p className="text-xs text-[#67738b]">Lowercase letters, numbers, and hyphens.</p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#b84235]">
            {error}
          </p>
        )}
        <button
          disabled={saving}
          className="w-full rounded-xl bg-[#3157d5] px-5 py-3 text-sm font-bold text-white hover:bg-[#2747b5] disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create trip'}
        </button>
      </form>
    </Modal>
  )
}

export function YearCalendarHome() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

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
    return () => {
      active = false
    }
  }, [year])

  const yearTrips = useMemo(
    () =>
      trips.filter((trip) => {
        if (!trip.startDate || trip.numDays < 1) return false
        const lastDay = addDays(parseISO(trip.startDate), trip.numDays - 1)
        return Number(trip.startDate.slice(0, 4)) <= year && lastDay.getFullYear() >= year
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
            onClick={() => setCreating(true)}
            className="rounded-full bg-[#3157d5] px-5 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(49,87,213,0.25)] hover:bg-[#2747b5]"
          >
            ＋ New trip
          </button>
        </header>

        <div className="mb-6 flex items-center gap-2 text-xs font-semibold text-[#65728b]">
          <span className="h-4 w-4 rounded bg-[#e8efff]" aria-hidden />
          Bavaria school holidays
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
            <Month key={month} year={year} month={month} trips={yearTrips} holidays={holidays} />
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
                const end = addDays(parseISO(trip.startDate), trip.numDays - 1)
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
      {creating && <NewTripModal onClose={() => setCreating(false)} />}
    </main>
  )
}

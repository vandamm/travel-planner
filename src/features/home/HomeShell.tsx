import { useEffect, useState } from 'react'
import {
  parseSchoolHolidays,
  type SchoolHoliday,
  type TripSummary,
} from './yearCalendar'
import { TimelineHome, NewTripModal } from './TimelineHome'
import { Month } from './YearCalendarHome'

const SCHOOL_HOLIDAYS_API = 'https://openholidaysapi.org/SchoolHolidays'
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, month, 1)),
)

function workerBase(): string {
  return (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')
}

function HomeHeader({ view, onCreate }: { view: 'timeline' | 'calendar'; onCreate: () => void }) {
  return (
    <header className="mx-auto grid max-w-[1180px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-4 sm:gap-6 sm:px-7 sm:py-7">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[2px] bg-city-vermilion font-serif text-xl font-semibold italic text-white"
        >
          I
        </span>
        <div className="min-w-0 max-[620px]:hidden">
          <p className="m-0 text-[10px] font-bold uppercase tracking-[.16em] text-ink-500">
            Travel Planner
          </p>
          <h1 className="truncate font-serif text-[22px] font-semibold tracking-tight">
            Our journeys
          </h1>
        </div>
      </div>
      <nav
        className="flex rounded-frame border border-edge-300 bg-white p-[3px] text-xs font-bold"
        aria-label="Choose home view"
      >
        <a
          href="/"
          aria-current={view === 'timeline' ? 'page' : undefined}
          className={`rounded-chip px-2.5 py-2 no-underline sm:px-3 ${view === 'timeline' ? 'bg-ink text-white' : 'text-ink-600'}`}
        >
          Timeline
        </a>
        <a
          href="/?view=calendar"
          aria-current={view === 'calendar' ? 'page' : undefined}
          className={`rounded-chip px-2.5 py-2 no-underline sm:px-3 ${view === 'calendar' ? 'bg-ink text-white' : 'text-ink-600'}`}
        >
          Calendar
        </a>
      </nav>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-[38px] items-center gap-1 rounded-card bg-city-vermilion px-3 text-xs font-bold text-white hover:bg-[#a83226] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-city-vermilion"
          aria-label="New trip"
        >
          <span aria-hidden>＋</span>
          <span className="max-[359px]:hidden">Trip</span>
        </button>
      </div>
    </header>
  )
}

export function HomeShell() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [trips, setTrips] = useState<TripSummary[]>([])
  const [holidays, setHolidays] = useState<SchoolHoliday[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingDate, setCreatingDate] = useState<string | null>(null)

  const view =
    new URLSearchParams(location.search).get('view') === 'calendar' ? 'calendar' : 'timeline'

  useEffect(() => {
    async function loadTrips() {
      setLoading(true)
      setError('')
      try {
        const all: TripSummary[] = []
        const seen = new Set<string>()
        let cursor: string | null = null

        do {
          const response = await fetch(
            `${workerBase()}/api/rooms${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
          )
          if (!response.ok) throw new Error('Failed to fetch trips')

          const body = (await response.json()) as {
            trips: TripSummary[]
            nextCursor?: string | null
          }
          all.push(...body.trips)
          cursor = body.nextCursor ?? null

          if (cursor && seen.has(cursor)) throw new Error('Cursor loop detected')
          if (cursor) seen.add(cursor)
        } while (cursor)

        setTrips(all)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load trips')
      } finally {
        setLoading(false)
      }
    }

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
      .then(async (response) => (response.ok ? parseSchoolHolidays(await response.json()) : []))
      .then((value) => {
        if (active) setHolidays(value)
      })
      .catch(() => {
        if (active) setHolidays([])
      })

    return () => {
      active = false
    }
  }, [year])

  const yearTrips = trips.filter(
    (trip) =>
      trip.startDate &&
      trip.endDate >= trip.startDate &&
      Number(trip.startDate.slice(0, 4)) <= year &&
      Number(trip.endDate.slice(0, 4)) >= year,
  )

  if (view === 'calendar') {
    return (
      <main className="min-h-screen bg-surface text-ink">
        <HomeHeader view="calendar" onCreate={() => setCreatingDate('')} />

        <section className="mx-auto flex max-w-[1320px] flex-col gap-4 px-4 pb-5 pt-7 sm:flex-row sm:items-end sm:justify-between sm:px-7">
          <h2 className="font-serif text-[clamp(38px,5vw,60px)] font-semibold tracking-tight">
            Your travel calendar
          </h2>
          <div className="flex items-center gap-3">
            <button
              aria-label="Previous year"
              onClick={() => setYear((value) => value - 1)}
              className="h-8 w-8 rounded-chip border border-edge-300 bg-white"
            >
              ←
            </button>
            <strong className="min-w-14 text-center">{year}</strong>
            <button
              aria-label="Next year"
              onClick={() => setYear((value) => value + 1)}
              className="h-8 w-8 rounded-chip border border-edge-300 bg-white"
            >
              →
            </button>
          </div>
        </section>

        <div className="mx-auto max-w-[1320px] px-4 pb-20 sm:px-7">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-semibold text-ink-600">
            <span className="h-2 w-6 border border-[#d2dcbb] bg-[#edf1e1]" />
            Bavaria school holidays
          </p>

          {error && (
            <p
              role="alert"
              className="mb-4 flex justify-between rounded-card bg-[#fff0ee] p-3 text-sm text-city-vermilion"
            >
              {error}
              <button onClick={() => location.reload()} className="underline">
                Retry
              </button>
            </p>
          )}

          <div className="grid gap-3 min-[481px]:grid-cols-2 lg:grid-cols-3">
            {MONTHS.map((_, month) => (
              <Month
                key={month}
                year={year}
                month={month}
                trips={yearTrips}
                holidays={holidays}
              />
            ))}
          </div>

          {loading && (
            <p role="status" className="mt-5 text-sm text-ink-500">
              Loading trips…
            </p>
          )}
        </div>

        {creatingDate !== null && <NewTripModal startDate={creatingDate || undefined} onClose={() => setCreatingDate(null)} />}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-surface text-ink">
      <HomeHeader view="timeline" onCreate={() => setCreatingDate('')} />

      <div className="mx-auto max-w-[900px] px-4 pt-7 sm:px-7">
        <h2 className="font-serif text-[clamp(38px,5vw,60px)] font-semibold tracking-tight">
          Your travel timeline
        </h2>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto mt-5 flex max-w-[900px] justify-between rounded-card bg-[#fff0ee] p-3 text-sm text-city-vermilion"
        >
          {error}
          <button onClick={() => location.reload()} className="underline">
            Retry
          </button>
        </p>
      )}

      <TimelineHome trips={trips} holidays={holidays} onAddTrip={setCreatingDate} />

      {creatingDate !== null && <NewTripModal startDate={creatingDate || undefined} onClose={() => setCreatingDate(null)} />}
    </main>
  )
}

import { useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import { Modal } from '../../components/Modal'
import {
  TRIP_COLORS,
  formatCountdown,
  futureDatedTrips,
  gapHeight,
  timelineMonthMarkers,
  tripDurationDays,
  tripHeight,
  type SchoolHoliday,
  type TripSummary,
} from './yearCalendar'

const workerBase = () => (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')
const tripLabel = (trip: TripSummary) => trip.title.trim() || trip.id
const tripColor = (trip: TripSummary) => trip.color || TRIP_COLORS[0]

export function NewTripModal({ onClose, startDate }: { onClose: () => void; startDate?: string }) {
  const [slug, setSlug] = useState('')
  const [date, setDate] = useState(startDate ?? '')
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
        body: JSON.stringify({
          room: slug,
          startDate: date,
          color: TRIP_COLORS[Math.floor(Math.random() * TRIP_COLORS.length)],
        }),
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
      <form onSubmit={createTrip} className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-city-vermilion">New journey</p>
          <h2 className="font-serif text-3xl font-semibold">Name the trip link</h2>
        </div>
        <label className="block text-sm font-semibold">
          Trip slug
          <input
            autoFocus
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            placeholder="japan-spring-2027"
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            className="mt-2 w-full rounded-card border border-edge px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Start date <span className="font-normal text-ink-500">(optional)</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-2 w-full rounded-card border border-edge px-3 py-2 font-normal"
          />
        </label>
        {error && <p role="alert" className="text-sm font-semibold text-city-vermilion">{error}</p>}
        <button disabled={saving} className="w-full rounded-card bg-city-vermilion px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {saving ? 'Creating…' : 'Create trip'}
        </button>
      </form>
    </Modal>
  )
}

interface TimelineHomeProps {
  trips: TripSummary[]
  holidays: SchoolHoliday[]
  onAddTrip: (date: string) => void
}

export function TimelineHome({ trips, holidays, onAddTrip }: TimelineHomeProps) {
  const root = useRef<HTMLElement>(null)
  const [hover, setHover] = useState<{ top: number; date: string } | null>(null)
  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = useMemo(() => futureDatedTrips(trips), [trips])
  const end = upcoming.reduce(
    (latest, trip) => (trip.endDate > latest ? trip.endDate : latest),
    format(addDays(parseISO(today), 180), 'yyyy-MM-dd'),
  )
  const markers = useMemo(() => timelineMonthMarkers(today, end, upcoming, holidays), [today, end, upcoming, holidays])

  if (!upcoming.length) {
    return (
      <section className="mx-auto max-w-[900px] px-4 pb-24 pt-8 sm:px-7">
        <div className="max-w-xl border-t border-edge-300 py-12">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-city-vermilion">No journeys yet</p>
          <h3 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Plan your first journey</h3>
          <p className="mt-3 text-sm leading-6 text-ink-600">Give the trip a name and date; its place in the timeline follows.</p>
          <button
            type="button"
            onClick={() => onAddTrip('')}
            className="mt-6 rounded-card bg-city-vermilion px-4 py-2.5 text-sm font-bold text-white hover:bg-[#a83226]"
          >
            Start a trip
          </button>
        </div>
      </section>
    )
  }

  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!matchMedia('(hover: hover)').matches || !root.current) return
    if (event.target instanceof Element && event.target.closest('[data-timeline-trip]')) return setHover(null)
    const rect = root.current.getBoundingClientRect()
    const top = event.clientY - rect.top
    const nearRail = Math.abs(event.clientX - (rect.left + rect.width / 2)) < 22
    if (!nearRail || top <= 24 || top >= rect.height - 48) return setHover(null)
    const totalDays = Math.max(1, differenceInDays(parseISO(end), parseISO(today)))
    setHover({ top, date: format(addDays(parseISO(today), Math.round((top / rect.height) * totalDays)), 'yyyy-MM-dd') })
  }

  let cursor = today
  const timeline = upcoming.flatMap((trip) => {
    const gap = { start: cursor, end: trip.startDate }
    cursor = format(addDays(parseISO(trip.endDate), 1), 'yyyy-MM-dd')
    return [gap, { trip }]
  })
  timeline.push({ start: cursor, end: format(addDays(parseISO(end), 1), 'yyyy-MM-dd') })

  const holidaysFor = (start: string, endDate: string) =>
    holidays.filter((holiday) => holiday.startDate < endDate && holiday.endDate >= start)

  return (
    <section
      ref={root}
      onPointerMove={pointerMove}
      onPointerLeave={() => setHover(null)}
      className="relative mx-auto max-w-[900px] px-4 pb-24 pt-8 before:absolute before:bottom-12 before:left-1/2 before:top-3 before:w-[2px] before:-translate-x-1/2 before:bg-edge-300 after:absolute after:bottom-10 after:left-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:rotate-45 after:border-b-2 after:border-r-2 after:border-edge-300"
    >
      <div className="relative z-10 mb-7 h-9">
        <span className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] border-surface bg-city-vermilion shadow-[0_0_0_1px_#c0392b]" />
        <time className="absolute right-[calc(50%+18px)] top-0 whitespace-nowrap text-right text-[9px] font-bold uppercase tracking-[.12em] text-ink-600">
          Today · {format(parseISO(today), 'd MMMM yyyy')}
        </time>
      </div>
      {timeline.map((item, index) => {
        if ('trip' in item) {
          const trip = item.trip
          return (
            <section key={trip.id} data-timeline-trip className="relative z-10" style={{ height: tripHeight(tripDurationDays(trip)) }}>
              {holidaysFor(trip.startDate, format(addDays(parseISO(trip.endDate), 1), 'yyyy-MM-dd')).map((holiday) => (
                <time key={holiday.startDate} className="absolute right-1/2 top-0 h-full w-1/2 border-y border-[#d2dcbb] bg-[#edf1e1]/70 pr-4 pt-2 text-right text-[9px] font-bold uppercase tracking-[.1em] text-city-pine">
                  {format(parseISO(holiday.startDate), 'd MMM.')} – {format(parseISO(holiday.endDate), 'd MMM.')}
                </time>
              ))}
              <span className="relative mx-auto block h-full w-5 rounded-[10px] border-4 border-surface shadow-[0_0_0_1px_currentColor]" style={{ color: tripColor(trip), backgroundColor: tripColor(trip) }} />
              <span className="absolute right-[calc(50%+30px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-right text-[9px] font-bold uppercase text-ink-600">
                {formatCountdown(Math.max(0, differenceInDays(parseISO(trip.startDate), parseISO(today))))}
              </span>
              <a href={`/${encodeURIComponent(trip.id)}`} className="absolute left-[calc(50%+30px)] top-1/2 flex w-[calc(50%-42px)] -translate-y-1/2 flex-col gap-1 no-underline">
                <strong className="font-serif text-lg font-semibold sm:text-[22px]">{tripLabel(trip)}</strong>
                <span className="text-[10px] font-bold text-ink-600">
                  {format(parseISO(trip.startDate), 'd MMM')} – {format(parseISO(trip.endDate), 'd MMM')} · {tripDurationDays(trip)} days
                </span>
              </a>
            </section>
          )
        }

        const days = Math.max(0, differenceInDays(parseISO(item.end), parseISO(item.start)))
        const gapMarkers = markers.filter((marker) => marker.date >= item.start && marker.date < item.end)
        return (
          <div key={`${item.start}-${index}`} className="relative" style={{ height: gapHeight(days) }}>
            {gapMarkers.map((marker) => (
              <time key={marker.date} dateTime={marker.date} className={`absolute right-[calc(50%+16px)] text-right text-[9px] font-bold uppercase tracking-[.1em] ${marker.embedded ? 'text-city-pine' : 'text-ink-500'}`} style={{ top: `${Math.max(8, Math.min(88, (differenceInDays(parseISO(marker.date), parseISO(item.start)) / Math.max(1, days)) * 100))}%` }}>
                {format(parseISO(marker.date), 'MMMM yyyy')}
              </time>
            ))}
            {holidaysFor(item.start, item.end).map((holiday) => (
              <time key={holiday.startDate} className="absolute right-1/2 top-1/2 w-1/2 border-y border-[#d2dcbb] bg-[#edf1e1]/70 py-1 pr-4 text-right text-[9px] font-bold uppercase tracking-[.1em] text-city-pine">
                {format(parseISO(holiday.startDate), 'd MMM.')} – {format(parseISO(holiday.endDate), 'd MMM.')}
              </time>
            ))}
          </div>
        )
      })}
      <p className="relative z-10 mx-auto mt-10 w-max bg-surface px-3 py-2 text-[9px] font-bold uppercase tracking-[.1em] text-ink-500">Continue planning</p>
      {hover && (
        <button
          type="button"
          aria-label="Add a trip at this point"
          onClick={() => onAddTrip(hover.date)}
          className="fixed z-20 grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-city-vermilion bg-surface text-sm text-city-vermilion"
          style={{ left: root.current ? root.current.getBoundingClientRect().left + root.current.getBoundingClientRect().width / 2 : 0, top: root.current ? root.current.getBoundingClientRect().top + hover.top : 0 }}
        >
          +
        </button>
      )}
    </section>
  )
}

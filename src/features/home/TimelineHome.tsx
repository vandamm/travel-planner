import { useLayoutEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import { Modal } from '../../components/Modal'
import {
  TRIP_COLORS,
  formatCountdown,
  futureDatedTrips,
  timelineDaysForHeight,
  timelineHeight,
  timelineLabelTops,
  timelineMonthMarkers,
  tripDurationDays,
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
  const canvas = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ top: number; date: string } | null>(null)
  const [minimumHeight, setMinimumHeight] = useState(0)
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayDate = parseISO(today)
  const upcoming = useMemo(() => futureDatedTrips(trips), [trips])

  useLayoutEffect(() => {
    const measure = () => {
      if (!canvas.current) return
      setMinimumHeight(Math.max(112, window.innerHeight - canvas.current.getBoundingClientRect().top - 56))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const baseDays = Math.max(
    1,
    timelineDaysForHeight(minimumHeight),
    ...upcoming.map((trip) => differenceInDays(addDays(parseISO(trip.endDate), 1), todayDate)),
  )
  const tripPositions = upcoming.map((trip) => {
    const start = trip.startDate < today ? todayDate : parseISO(trip.startDate)
    const top = timelineHeight(differenceInDays(start, todayDate))
    const height = timelineHeight(differenceInDays(addDays(parseISO(trip.endDate), 1), start))
    return { trip, top, height }
  })
  const labelTops = timelineLabelTops(tripPositions.map(({ top, height }) => Math.max(0, top + height / 2 - 21)))
  const tripViews = tripPositions.map((position, index) => ({ ...position, labelTop: labelTops[index] }))
  const labelBottom = tripViews.length ? tripViews[tripViews.length - 1].labelTop + 98 : 0
  const canvasDays = Math.max(baseDays, timelineDaysForHeight(labelBottom))
  const end = format(addDays(todayDate, canvasDays - 1), 'yyyy-MM-dd')
  const markers = useMemo(() => timelineMonthMarkers(today, end, upcoming, holidays), [today, end, upcoming, holidays])

  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!matchMedia('(hover: hover)').matches || !root.current || !canvas.current) return
    if (event.target instanceof Element && event.target.closest('[data-timeline-trip]')) return setHover(null)
    const rect = canvas.current.getBoundingClientRect()
    const top = event.clientY - rect.top
    const nearRail = Math.abs(event.clientX - (rect.left + rect.width / 2)) < 22
    if (!nearRail || top < 0 || top >= rect.height) return setHover(null)
    setHover({
      top: event.clientY,
      date: format(addDays(todayDate, Math.min(canvasDays - 1, Math.max(0, Math.round(top / timelineHeight(1))))), 'yyyy-MM-dd'),
    })
  }

  const holidayViews = holidays.flatMap((holiday) => {
    const start = Math.max(0, differenceInDays(parseISO(holiday.startDate), todayDate))
    const endDay = Math.min(canvasDays, differenceInDays(addDays(parseISO(holiday.endDate), 1), todayDate))
    return endDay > start ? [{ holiday, top: timelineHeight(start), height: timelineHeight(endDay - start) }] : []
  })

  return (
    <section
      ref={root}
      onPointerMove={pointerMove}
      onPointerLeave={() => setHover(null)}
      className="relative mx-auto max-w-[900px] px-4 pb-14 pt-8"
    >
      <div ref={canvas} data-timeline-canvas className="relative" style={{ height: timelineHeight(canvasDays) }}>
        <span className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-edge-300" />
        <span className="absolute left-1/2 top-0 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] border-surface bg-city-vermilion shadow-[0_0_0_1px_#c0392b]" />
        <time className="absolute right-[calc(50%+18px)] top-0 z-10 whitespace-nowrap text-right text-[9px] font-bold uppercase tracking-[.12em] text-ink-600">
          Today · {format(todayDate, 'd MMMM yyyy')}
        </time>
        {holidayViews.map(({ holiday, top, height }) => (
          <time key={holiday.startDate} className="absolute right-1/2 w-1/2 border-y border-[#d2dcbb] bg-[#edf1e1]/70 pr-4 pt-2 text-right text-[9px] font-bold uppercase tracking-[.1em] text-city-pine" style={{ top, height }}>
            {format(parseISO(holiday.startDate), 'd MMM.')} – {format(parseISO(holiday.endDate), 'd MMM.')}
          </time>
        ))}
        {markers.map((marker) => (
          <time key={marker.date} dateTime={marker.date} className={`absolute right-[calc(50%+16px)] z-10 text-right text-[9px] font-bold uppercase tracking-[.1em] ${marker.embedded ? 'text-city-pine' : 'text-ink-500'}`} style={{ top: timelineHeight(differenceInDays(parseISO(marker.date), todayDate)) }}>
            {format(parseISO(marker.date), 'MMMM yyyy')}
          </time>
        ))}
        {tripViews.map(({ trip, top, height, labelTop }) => (
          <section key={trip.id} data-timeline-trip>
            <span className="absolute left-1/2 z-10 block w-5 -translate-x-1/2 rounded-[10px] border-4 border-surface shadow-[0_0_0_1px_currentColor]" style={{ top, height, color: tripColor(trip), backgroundColor: tripColor(trip) }} />
            <span className="absolute right-[calc(50%+30px)] z-10 h-[42px] -translate-y-1/2 whitespace-nowrap text-right text-[9px] font-bold uppercase text-ink-600" style={{ top: labelTop + 21 }}>
              {formatCountdown(Math.max(0, differenceInDays(parseISO(trip.startDate), todayDate)))}
            </span>
            <a href={`/${encodeURIComponent(trip.id)}`} className="absolute left-[calc(50%+30px)] z-10 flex h-[42px] w-[calc(50%-42px)] flex-col justify-center gap-1 no-underline" style={{ top: labelTop }}>
              <strong className="font-serif text-lg font-semibold sm:text-[22px]">{tripLabel(trip)}</strong>
              <span className="text-[10px] font-bold text-ink-600">
                {format(parseISO(trip.startDate), 'd MMM')} – {format(parseISO(trip.endDate), 'd MMM')} · {tripDurationDays(trip)} days
              </span>
            </a>
          </section>
        ))}
        <p className="absolute bottom-6 left-1/2 z-10 w-max -translate-x-1/2 bg-surface px-3 py-2 text-[9px] font-bold uppercase tracking-[.1em] text-ink-500">Continue planning</p>
        <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-edge-300" />
      </div>
      {hover && (
        <button
          type="button"
          aria-label="Add a trip at this point"
          onClick={() => onAddTrip(hover.date)}
          className="fixed z-20 grid h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-city-vermilion bg-surface text-sm text-city-vermilion"
          style={{ left: root.current ? root.current.getBoundingClientRect().left + root.current.getBoundingClientRect().width / 2 : 0, top: hover.top }}
        >
          +
        </button>
      )}
    </section>
  )
}

import { useLayoutEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { addDays, differenceInDays, format, parseISO } from 'date-fns'
import { Modal } from '../../components/Modal'
import {
  TRIP_COLORS,
  formatCountdown,
  futureDatedTrips,
  timelineDaysForHeight,
  timelineHeight,
  timelineMonthMarkers,
  tripDurationDays,
  type SchoolHoliday,
  type TripSummary,
} from './yearCalendar'

const workerBase = () => (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')
const tripLabel = (trip: TripSummary) => trip.title.trim() || trip.id
const tripColor = (trip: TripSummary) => trip.color || TRIP_COLORS[0]

function dateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (startDate === endDate) return format(start, 'd MMM')
  if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) return `${format(start, 'd')}–${format(end, 'd MMM')}`
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
}

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
  const canvasDays = baseDays
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
        <time dateTime={today} className="absolute right-[calc(50%+18px)] top-0 z-10 whitespace-nowrap text-right text-[9px] font-bold uppercase tracking-[.12em] text-ink-600">
          {format(todayDate, 'd MMMM yyyy')}
        </time>
        <span className="absolute left-1/2 top-0 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] border-surface bg-city-vermilion shadow-[0_0_0_1px_#c0392b]" />
        <time dateTime={today} className="absolute left-[calc(50%+18px)] top-0 z-10 whitespace-nowrap text-[9px] font-bold uppercase tracking-[.12em] text-ink-600">
          Today
        </time>
        {holidayViews.map(({ holiday, top, height }) => (
          <span
            key={`${holiday.startDate}-${holiday.endDate}`}
            data-timeline-holiday
            className="absolute right-[calc(50%+15px)] z-[3] w-[78px] border-y border-r-2 border-[#9aa77c]/70 bg-[#d2dcbb]/55 sm:right-[calc(50%+18px)] sm:w-[124px]"
            style={{ top, height }}
          >
            <time dateTime={`${holiday.startDate}/${holiday.endDate}`} className="absolute inset-0 grid place-items-center px-1 text-right text-[8px] font-bold uppercase leading-[1.25] tracking-[.07em] text-city-pine sm:px-2 sm:text-[11px] sm:tracking-[.08em]">
              {dateRange(holiday.startDate, holiday.endDate)}
            </time>
          </span>
        ))}
        {markers.map((marker) => {
          const markerDate = parseISO(marker.date)
          const isJanuary = format(markerDate, 'M') === '1'
          const top = timelineHeight(differenceInDays(markerDate, todayDate))
          return (
            <div key={marker.date} className="absolute right-[calc(50%+15px)] z-[4] flex items-end gap-1.5 sm:right-[calc(50%+18px)] sm:gap-2" style={{ top }}>
              {isJanuary ? (
                <time data-timeline-year dateTime={marker.date} className="-translate-y-2 font-serif text-[30px] font-semibold leading-none tracking-[-.04em] text-ink sm:text-[38px]">
                  {format(markerDate, 'yyyy')}
                </time>
              ) : (
                <time data-timeline-month dateTime={marker.date} className="-translate-y-2 text-[9px] font-semibold uppercase tracking-[.1em] text-ink-500 sm:text-[12px]">
                  {format(markerDate, 'MMMM')}
                </time>
              )}
              <span aria-hidden className={`mb-[3px] ${isJanuary ? 'h-[2px] w-5 bg-edge-300 sm:w-8' : 'h-px w-3 bg-edge-300 sm:w-16'}`} />
            </div>
          )
        })}
        {tripPositions.map(({ trip, top, height }) => {
          const duration = tripDurationDays(trip)
          const copyTop = duration >= 3 ? top + height / 2 : top
          return (
          <section key={trip.id} data-timeline-trip>
            <span className="absolute left-1/2 z-10 block min-h-4 w-[14px] -translate-x-1/2 rounded-[2px]" style={{ top, height, backgroundColor: tripColor(trip) }}>
              <span data-trip-start-tick aria-hidden className="absolute left-0 top-0 h-[2px] w-6" style={{ backgroundColor: tripColor(trip) }} />
              <span data-trip-end-tick aria-hidden className="absolute bottom-0 left-0 h-px w-6" style={{ backgroundColor: tripColor(trip) }} />
            </span>
            <span className="absolute left-[calc(50%+44px)] z-10 hidden -translate-y-full whitespace-nowrap text-[9px] font-bold uppercase tracking-[.1em] text-ink-600 sm:block" style={{ top }}>
              {formatCountdown(Math.max(0, differenceInDays(parseISO(trip.startDate), todayDate)))}
            </span>
            <a href={`/${encodeURIComponent(trip.id)}`} className={`absolute left-[calc(50%+30px)] z-10 grid w-[calc(50%-42px)] gap-1 no-underline sm:left-[calc(50%+44px)] sm:w-[calc(50%-56px)] ${duration >= 3 ? '-translate-y-1/2' : ''}`} style={{ top: copyTop }}>
              <strong className="font-serif text-lg font-semibold sm:text-[22px]">{tripLabel(trip)}</strong>
              <span className="text-[10px] font-bold uppercase tracking-[.03em] text-ink-600">{dateRange(trip.startDate, trip.endDate)}</span>
              {duration >= 3 && <span className="text-[10px] font-bold uppercase tracking-[.08em] text-ink-500">{duration} days</span>}
            </a>
          </section>
          )
        })}
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

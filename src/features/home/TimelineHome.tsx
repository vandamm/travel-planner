import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { addDays, addMonths, differenceInDays, format, parseISO } from 'date-fns'
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

const tripLabel = (trip: TripSummary) => trip.title.trim() || trip.id
const tripColor = (trip: TripSummary) => trip.color || TRIP_COLORS[0]

function dateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (startDate === endDate) return format(start, 'd MMM')
  if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) return `${format(start, 'd')}–${format(end, 'd MMM')}`
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
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
  const [holidayHover, setHolidayHover] = useState<{ key: string; top: number } | null>(null)
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
    differenceInDays(addMonths(todayDate, 6), todayDate) + 1,
    timelineDaysForHeight(minimumHeight),
    ...upcoming.map((trip) =>
      differenceInDays(addDays(addMonths(parseISO(trip.endDate), 1), 1), todayDate),
    ),
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

  const moveHolidayLabel = (event: MouseEvent<HTMLElement>, key: string) => {
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const padding = Math.min(10, rect.height / 2)
    const pointerTop = event.clientY - rect.top
    setHolidayHover({
      key,
      top: Math.max(padding, Math.min(rect.height - padding, pointerTop)),
    })
  }

  return (
    <section
      ref={root}
      onPointerMove={pointerMove}
      onPointerLeave={() => setHover(null)}
      className="relative mx-auto max-w-[900px] px-4 pb-14 pt-8"
    >
      <div ref={canvas} data-timeline-canvas className="relative" style={{ height: timelineHeight(canvasDays) }}>
        <span className="absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-edge-300" />
        <time dateTime={today} className="absolute right-[calc(50%+18px)] top-[-1px] z-10 whitespace-nowrap text-right text-[11px] font-bold uppercase tracking-[.12em] text-ink-600">
          {format(todayDate, 'd MMMM yyyy')}
        </time>
        <span className="absolute left-1/2 top-0 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-[3px] border-surface bg-city-vermilion shadow-[0_0_0_1px_#c0392b]" />
        <time dateTime={today} className="absolute left-[calc(50%+18px)] top-[-1px] z-10 whitespace-nowrap text-[11px] font-bold uppercase tracking-[.12em] text-ink-600">
          Today
        </time>
        {holidayViews.map(({ holiday, top, height }) => (
          <span
            key={`${holiday.startDate}-${holiday.endDate}`}
            data-timeline-holiday
            aria-label={dateRange(holiday.startDate, holiday.endDate)}
            tabIndex={0}
            onMouseMove={(event) =>
              moveHolidayLabel(event, `${holiday.startDate}-${holiday.endDate}`)
            }
            className="group absolute right-1/2 z-[3] w-[44px] border-r-2 border-r-[rgba(95,111,68,.55)] bg-[rgba(210,220,187,.4)] sm:w-[62px]"
            style={{ top, height }}
          >
            <time
              dateTime={`${holiday.startDate}/${holiday.endDate}`}
              className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-right text-[11px] font-bold uppercase leading-[1.25] tracking-[.07em] text-city-pine/75 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:text-[13px] sm:leading-[1.4] sm:tracking-[.08em]"
              style={
                holidayHover?.key === `${holiday.startDate}-${holiday.endDate}`
                  ? { top: holidayHover.top }
                  : undefined
              }
            >
              {dateRange(holiday.startDate, holiday.endDate)}
            </time>
          </span>
        ))}
        {markers.map((marker) => {
          const markerDate = parseISO(marker.date)
          const isJanuary = format(markerDate, 'M') === '1'
          const top = timelineHeight(differenceInDays(markerDate, todayDate))
          return (
            <div key={marker.date} className="absolute right-[calc(50%+52px)] z-[4] w-[84px] sm:right-[calc(50%+70px)] sm:w-[112px]" style={{ top }}>
              {isJanuary ? (
                <time data-timeline-year dateTime={marker.date} className="relative block translate-y-1 font-serif text-[38px] font-semibold leading-none tracking-[-.04em] text-ink">
                  {format(markerDate, 'yyyy')}
                  <span aria-hidden className="absolute left-0 top-[-4px] h-[2px] w-[calc(100%+52px)] bg-edge-300 sm:w-[calc(100%+70px)]" />
                </time>
              ) : (
                <time data-timeline-month dateTime={marker.date} className="relative block translate-y-1 text-[12.5px] font-semibold uppercase tracking-[.08em] text-ink-500">
                  {format(markerDate, 'MMMM')}
                  <span aria-hidden className="absolute left-0 top-[-4px] h-px w-[calc(100%+52px)] bg-edge-300 sm:w-[calc(100%+70px)]" />
                </time>
              )}
            </div>
          )
        })}
        {tripPositions.map(({ trip, top, height }) => {
          const duration = tripDurationDays(trip)
          const centerCopy = height >= 72
          const copyTop = centerCopy ? top + height / 2 : top
          return (
          <section key={trip.id} data-timeline-trip>
            <span className="absolute left-1/2 z-10 block min-h-4 w-[14px] rounded-[2px]" style={{ top, height, backgroundColor: tripColor(trip) }}>
              <span data-trip-start-tick aria-hidden className="absolute left-0 top-0 h-[2px] w-[16px]" style={{ backgroundColor: tripColor(trip) }} />
              <span data-trip-end-tick aria-hidden className="absolute bottom-0 left-0 h-px w-[16px]" style={{ backgroundColor: tripColor(trip) }} />
            </span>
            <span className="absolute left-[calc(50%+44px)] z-10 hidden -translate-y-[18px] whitespace-nowrap text-[11px] font-bold uppercase tracking-[.12em] text-ink-600 sm:block" style={{ top }}>
              {formatCountdown(Math.max(0, differenceInDays(parseISO(trip.startDate), todayDate)))}
            </span>
            <a href={`/${encodeURIComponent(trip.id)}`} className={`absolute left-[calc(50%+30px)] z-10 grid w-[calc(50%-42px)] gap-0.5 no-underline sm:left-[calc(50%+44px)] sm:w-[calc(50%-56px)] ${centerCopy ? '-translate-y-1/2' : ''}`} style={{ top: copyTop }}>
              <strong className="font-serif text-[19px] font-semibold tracking-[-.025em] sm:text-[25px]">{tripLabel(trip)}</strong>
              <span className="text-[11px] font-bold uppercase tracking-[.03em] text-ink-600">{dateRange(trip.startDate, trip.endDate)}</span>
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

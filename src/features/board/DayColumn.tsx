// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out in the
// viewer's chosen direction. Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view in Task 11 reuses the same card/scale logic).

import { format, parseISO } from 'date-fns'
import type { Card, City, Day } from '../../data/schema'
import { TIME_SCALE, orderCardsForDirection, type TimeDirection } from './timeDirection'

export interface DayColumnProps {
  day: Day
  /** Resolved city for the day, if any (drives the header color). */
  city?: City
  cards: Card[]
  direction: TimeDirection
}

/** A neutral band color for days with no resolved city (travel days). */
const NO_CITY_COLOR = '#cbd5e1' // slate-300

export function DayColumn({ day, city, cards, direction }: DayColumnProps) {
  const ordered = orderCardsForDirection(cards, direction)
  const scale = direction === 'up' ? [...TIME_SCALE].reverse() : [...TIME_SCALE]
  const weekday = format(parseISO(day.key), 'EEE')
  const dateLabel = format(parseISO(day.key), 'd MMM')

  return (
    <section
      data-testid="day-column"
      data-day={day.key}
      aria-label={`${weekday} ${dateLabel}${city ? ` — ${city.name}` : ''}`}
      className="flex w-56 shrink-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <header className="overflow-hidden rounded-t-lg">
        <div
          data-testid="city-band"
          style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
          className="h-1.5 w-full"
        />
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {weekday} · {dateLabel}
          </span>
          <span
            data-testid="city-name"
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"
          >
            <span
              aria-hidden
              style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
              className="inline-block h-2.5 w-2.5 rounded-full"
            />
            {city ? city.name : <span className="text-slate-400">No city</span>}
          </span>
        </div>
      </header>

      <div className="relative flex-1 px-3 py-2">
        <ol data-testid="scale" className="pointer-events-none absolute inset-0 flex flex-col">
          {scale.map((label) => (
            <li
              key={label}
              data-testid="scale-label"
              className="flex flex-1 items-start justify-end px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300"
            >
              {label}
            </li>
          ))}
        </ol>

        <ol className="relative flex flex-col gap-2">
          {ordered.map((c) => (
            <li
              key={c.id}
              data-testid="card"
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-800 shadow-sm"
            >
              <span data-testid="card-title" className="font-medium">
                {c.title}
              </span>
              {c.startTime && (
                <span data-testid="card-time" className="ml-2 text-xs text-slate-500">
                  {c.startTime}
                  {c.endTime ? `–${c.endTime}` : ''}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

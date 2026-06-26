// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out in the
// viewer's chosen direction. Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view in Task 11 reuses the same card/scale logic).

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { format, isWeekend, parseISO } from 'date-fns'
import type { Card as CardType, City, Day } from '../../data/schema'
import { SortableCard } from '../cards/Card'
import { useIsDragOverDay } from './dndContext'
import { dayDroppableId } from './dndHandlers'
import { TIME_SCALE, orderCardsForDirection, type TimeDirection } from './timeDirection'

export interface DayColumnProps {
  day: Day
  /** Resolved city for the day, if any (drives the header color). */
  city?: City
  cards: CardType[]
  direction: TimeDirection
  /** Start of the day's timeline window, 'HH:mm' (sizes the body). */
  dayStart?: string
  /** End of the day's timeline window, 'HH:mm'. */
  dayEnd?: string
  /** Open the editor to add a card to this day. */
  onAddCard?: (dayKey: string) => void
  /** Open the editor on an existing card. */
  onEditCard?: (card: CardType) => void
}

/** A neutral band color for days with no resolved city (travel days). */
const NO_CITY_COLOR = '#cbd5e1' // slate-300

/** Pixels per hour of the time window — the timeline's vertical scale. */
const PX_PER_HOUR = 44
/** Fallback span (hours) for an untimed card or a timed card with no end. */
const DEFAULT_CARD_HOURS = 1

/** Minutes since midnight for an 'HH:mm' clock string; 0 when unparseable. */
function clockMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0
}

/** Body height (px) for the day window; never shorter than one default block. */
function windowHeightPx(dayStart: string, dayEnd: string): number {
  const hours = (clockMinutes(dayEnd) - clockMinutes(dayStart)) / 60
  return Math.max(hours, DEFAULT_CARD_HOURS) * PX_PER_HOUR
}

/**
 * A card's height (px), scaled by its duration so empty time stays visible:
 * end−start, with a timed card lacking an end (and any untimed card) given the
 * default block. Bad/overnight ranges floor to the default block.
 */
function cardHeightPx(card: CardType): number {
  if (!card.startTime) return DEFAULT_CARD_HOURS * PX_PER_HOUR
  const start = clockMinutes(card.startTime)
  const end = card.endTime ? clockMinutes(card.endTime) : start + 60
  return Math.max((end - start) / 60, DEFAULT_CARD_HOURS) * PX_PER_HOUR
}

export function DayColumn({
  day,
  city,
  cards,
  direction,
  dayStart = '06:00',
  dayEnd = '21:00',
  onAddCard,
  onEditCard,
}: DayColumnProps) {
  const ordered = orderCardsForDirection(cards, direction)
  const scale = direction === 'up' ? [...TIME_SCALE].reverse() : [...TIME_SCALE]
  const weekday = format(parseISO(day.key), 'EEE')
  const dateLabel = format(parseISO(day.key), 'dd.MM') // day-first (dd.mm) for the EU audience
  const weekend = isWeekend(parseISO(day.key))

  // The column body is a drop target so cards can be dropped onto an empty day
  // (or its blank space), not only onto another card.
  const { setNodeRef } = useDroppable({ id: dayDroppableId(day.key) })
  // Highlight this column while a card is dragged over it — the "lands here" hint.
  const dragOver = useIsDragOverDay(day.key)

  return (
    <section
      data-testid="day-column"
      data-day={day.key}
      data-drag-over={dragOver ? '' : undefined}
      aria-label={`${weekday} ${dateLabel}${city ? ` — ${city.name}` : ''}`}
      className={`flex w-56 shrink-0 flex-col rounded-lg border shadow-sm ${weekend ? 'bg-rose-50' : 'bg-white'} ${dragOver ? 'border-sky-400 ring-2 ring-sky-300' : 'border-slate-200'}`}
    >
      <header className="overflow-hidden rounded-t-lg">
        <div
          data-testid="city-band"
          style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
          className="h-1.5 w-full"
        />
        <div className="flex flex-col gap-0.5 px-3 py-2">
          <span
            data-testid="day-label"
            className="text-xs font-medium uppercase tracking-wide text-slate-400"
          >
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

      <div
        ref={setNodeRef}
        data-testid="day-body"
        style={{ minHeight: windowHeightPx(dayStart, dayEnd) }}
        className="relative flex-1 px-3 py-2"
      >
        {/* Continuous time scale in a left gutter — kept clear of the cards
            (which sit in the padded column to its right) so labels never hide
            behind a card. */}
        <ol
          data-testid="scale"
          aria-hidden
          className="pointer-events-none absolute inset-y-2 left-0 flex w-16 flex-col"
        >
          {scale.map((label) => (
            <li
              key={label}
              data-testid="scale-label"
              className="flex flex-1 items-start whitespace-nowrap px-2 text-[10px] font-medium uppercase tracking-wide text-slate-300"
            >
              {label}
            </li>
          ))}
        </ol>

        <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ol data-testid="card-list" className="relative flex flex-col gap-2 pl-16">
            {ordered.map((c) => (
              <li key={c.id} style={{ minHeight: cardHeightPx(c) }}>
                <SortableCard card={c} onEdit={onEditCard} />
              </li>
            ))}
          </ol>
        </SortableContext>
      </div>

      <footer className="px-3 pb-3 pt-1">
        <button
          type="button"
          aria-label={`Add card to ${weekday} ${dateLabel}`}
          onClick={() => onAddCard?.(day.key)}
          className="w-full rounded border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
        >
          + Add card
        </button>
      </footer>
    </section>
  )
}

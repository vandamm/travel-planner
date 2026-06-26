// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out in the
// viewer's chosen direction. Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view in Task 11 reuses the same card/scale logic).

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { format, isWeekend, parseISO } from 'date-fns'
import { formatDay } from '../../data/dateFormat'
import type { Card as CardType, City, Day } from '../../data/schema'
import { SortableCard } from '../cards/Card'
import { cardHeightPx, windowHeightPx } from '../cards/cardHeight'
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
  /** All cities, to populate the per-day override picker (omit/empty → no picker). */
  cities?: City[]
  /** The day's *manual* override city id, if any (drives the picker value + flag). */
  overrideCityId?: string
  /** Set or clear this day's manual city override (`null` = Auto / no override). */
  onSetCity?: (dayKey: string, cityId: string | null) => void
  /** Open the editor to add a card to this day. */
  onAddCard?: (dayKey: string) => void
  /** Open the editor on an existing card. */
  onEditCard?: (card: CardType) => void
}

/** A neutral band color for days with no resolved city (travel days). */
const NO_CITY_COLOR = '#cbd5e1' // slate-300

export function DayColumn({
  day,
  city,
  cards,
  direction,
  dayStart = '06:00',
  dayEnd = '21:00',
  cities = [],
  overrideCityId,
  onSetCity,
  onAddCard,
  onEditCard,
}: DayColumnProps) {
  const ordered = orderCardsForDirection(cards, direction)
  const scale = direction === 'up' ? [...TIME_SCALE].reverse() : [...TIME_SCALE]
  const weekday = format(parseISO(day.key), 'EEE')
  const dateLabel = formatDay(day.key) // day-first dd.MM for the EU audience
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
          <div className="flex items-center justify-between gap-1.5">
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
              {overrideCityId && (
                <span
                  data-testid="override-indicator"
                  title="Manual city override"
                  aria-label="Manual city override"
                  className="text-slate-400"
                >
                  📌
                </span>
              )}
            </span>
            {cities.length > 0 && (
              <select
                data-testid="city-override"
                aria-label={`City for ${weekday} ${dateLabel}`}
                value={overrideCityId ?? ''}
                onChange={(e) => onSetCity?.(day.key, e.target.value === '' ? null : e.target.value)}
                className="max-w-[6rem] rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-600"
              >
                <option value="">Auto</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
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
              <li key={c.id} style={{ minHeight: cardHeightPx(c, dayStart, dayEnd) }}>
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

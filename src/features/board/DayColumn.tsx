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
import { NO_CITY_COLOR } from '../cities/colors'
import { SortableCard } from '../cards/Card'
import {
  PX_PER_HOUR,
  cardHeightPx,
  clockMinutes,
  noonFraction,
  resolvedDurationHours,
  windowHeightPx,
} from '../cards/cardHeight'
import { useIsDragOverDay } from './dragOverDayContext'
import { dayDroppableId } from './dndHandlers'
import { TIME_SCALE, orderCardsForDirection, type TimeDirection } from './timeDirection'
import { COLUMN_WIDTH_REM } from './useViewport'

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

function cardGapPx(
  card: CardType,
  direction: TimeDirection,
  dayStart: string,
  dayEnd: string,
  cursor: { current: number },
): number {
  const height = cardHeightPx(card, dayStart, dayEnd)
  if (!card.startTime) {
    cursor.current += height
    return 0
  }
  const start = clockMinutes(card.startTime)
  const top =
    direction === 'up'
      ? clockMinutes(dayEnd) - (start + resolvedDurationHours(card, dayStart, dayEnd) * 60)
      : start - clockMinutes(dayStart)
  const gap = Math.max((top / 60) * PX_PER_HOUR - cursor.current, 0)
  cursor.current += gap + height
  return gap
}

function overlappingCardIds(cards: CardType[], dayStart: string, dayEnd: string): Set<string> {
  const timed = cards.filter((card) => card.startTime)
  const conflicts = new Set<string>()
  for (let i = 0; i < timed.length; i += 1) {
    const a = timed[i]
    const aStart = clockMinutes(a.startTime!)
    const aEnd = aStart + resolvedDurationHours(a, dayStart, dayEnd) * 60
    for (let j = i + 1; j < timed.length; j += 1) {
      const b = timed[j]
      const bStart = clockMinutes(b.startTime!)
      const bEnd = bStart + resolvedDurationHours(b, dayStart, dayEnd) * 60
      if (aStart < bEnd && bStart < aEnd) {
        conflicts.add(a.id)
        conflicts.add(b.id)
      }
    }
  }
  return conflicts
}

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
  const conflicts = overlappingCardIds(cards, dayStart, dayEnd)
  const scale = direction === 'up' ? [...TIME_SCALE].reverse() : [...TIME_SCALE]
  const cardCursor = { current: 0 }
  const weekday = format(parseISO(day.key), 'EEE')
  const dateLabel = formatDay(day.key) // day-first dd.MM for the EU audience
  const weekend = isWeekend(parseISO(day.key))

  // NOON hairline: a positional hint at noon's fraction of the day window,
  // offset by the body's py-2 padding so it lands in the same coordinate space
  // as the time scale. 'up' anchors it from the bottom (morning at the bottom).
  const noonPx = noonFraction(dayStart, dayEnd) * windowHeightPx(dayStart, dayEnd)
  const noonStyle =
    direction === 'up'
      ? { bottom: `calc(0.5rem + ${noonPx}px)` }
      : { top: `calc(0.5rem + ${noonPx}px)` }

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
      style={{ width: COLUMN_WIDTH_REM }}
      className={`flex shrink-0 flex-col rounded-frame border bg-white shadow-sm ${dragOver ? 'border-sky-400 ring-2 ring-sky-300' : 'border-edge'}`}
    >
      <header className="rounded-t-frame">
        <div className="flex flex-col gap-0.5 px-3 pb-2 pt-2.5">
          <span
            data-testid="day-label"
            className={`text-[9.5px] font-extrabold uppercase tracking-[0.18em] ${weekend ? 'text-city-vermilion' : 'text-ink-400'}`}
          >
            {weekday} · {dateLabel}
          </span>
          <div className="flex items-center justify-between gap-1.5">
            <span
              data-testid="city-name"
              className="flex items-center gap-1 font-serif text-lg font-bold leading-tight text-ink"
            >
              {city ? city.name : <span className="text-ink-300">No city</span>}
              {overrideCityId && (
                <span
                  data-testid="override-indicator"
                  title="Manual city override"
                  aria-label="Manual city override"
                  className="text-ink-300"
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
                onChange={(e) =>
                  onSetCity?.(day.key, e.target.value === '' ? null : e.target.value)
                }
                className="max-w-[6rem] rounded-chip border border-edge bg-white px-1 py-0.5 text-xs text-ink-600"
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
        <div
          data-testid="city-band"
          style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
          className="h-[3px] w-full"
        />
      </header>

      <div
        ref={setNodeRef}
        data-testid="day-body"
        style={{ minHeight: windowHeightPx(dayStart, dayEnd) }}
        className="relative flex-1 px-3 py-2"
      >
        {/* NOON hairline — a positional divider at noon's fraction of the day
            window, respecting time-direction. Purely a visual hint. */}
        <div
          data-testid="noon-divider"
          aria-hidden
          style={noonStyle}
          className="pointer-events-none absolute left-3 right-3 flex items-center gap-2"
        >
          <span className="h-px flex-1 bg-edge-100" />
          <span className="font-sans text-[8px] font-bold uppercase tracking-[0.16em] text-ink-200">
            NOON
          </span>
          <span className="h-px flex-1 bg-edge-100" />
        </div>

        {/* Continuous time scale at the left edge. Cards intentionally get the
            full body width and may overlap this decorative scale. */}
        <ol
          data-testid="scale"
          aria-hidden
          className="pointer-events-none absolute inset-y-2 left-0 flex w-6 flex-col"
        >
          {scale.map((label) => (
            <li
              key={label}
              data-testid="scale-label"
              className="flex flex-1 -translate-x-1 rotate-180 items-start px-0 text-[24px] font-semibold uppercase tracking-wide text-ink-300 [writing-mode:vertical-rl]"
            >
              {label}
            </li>
          ))}
        </ol>

        <SortableContext items={ordered.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ol data-testid="card-list" className="relative flex flex-col gap-2 pl-0">
            {ordered.map((c) => (
              <li
                key={c.id}
                style={{
                  minHeight: cardHeightPx(c, dayStart, dayEnd),
                  marginTop: cardGapPx(c, direction, dayStart, dayEnd, cardCursor),
                }}
              >
                <SortableCard card={c} conflict={conflicts.has(c.id)} onEdit={onEditCard} dayStart={dayStart} dayEnd={dayEnd} />
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
          className="w-full rounded border border-dashed border-edge-300 px-2 py-1 text-xs font-medium text-ink-500 hover:border-ink-300 hover:text-ink-600"
        >
          + Add card
        </button>
      </footer>
    </section>
  )
}

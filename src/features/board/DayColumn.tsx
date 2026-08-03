// A single day column on the board: a color-coded, city-labeled header above a
// continuous morning→evening time scale, with the day's cards laid out in the
// viewer's chosen direction. Purely presentational — it receives the resolved
// city and the day's cards as props so it is trivial to test and reuse (the
// mobile single-day view in Task 11 reuses the same card/scale logic).

import { useDroppable } from '@dnd-kit/core'
import { format, isWeekend, parseISO } from 'date-fns'
import { formatDay } from '../../data/dateFormat'
import type { Card as CardType, City, Day, DayCityOverride } from '../../data/schema'
import { NO_CITY_COLOR } from '../cities/colors'
import { CityPicker } from '../cities/CityPicker'
import { Card, SortableCard } from '../cards/Card'
import {
  PX_PER_HOUR,
  TIMELINE_VERTICAL_PADDING_PX,
  cardHeightPx,
  clockMinutes,
  resolvedDurationHours,
  windowHeightPx,
} from '../cards/cardHeight'
import { useDragPreview, useIsDragOverDay } from './dragOverDayContext'
import { dayDroppableId } from './dndHandlers'
import type { TimeDirection } from './timeDirection'
import { formatFreeDuration, freeTimelineSlots, layoutTimelineCards } from './timelineSlots'
import { COLUMN_GAP_PX, COLUMN_WIDTH_REM } from './useViewport'

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
  overrideCityId?: DayCityOverride
  /** Set a city, choose explicit No city (`null`), or clear to Auto (`undefined`). */
  onSetCity?: (dayKey: string, cityId: DayCityOverride | undefined) => void
  /** Open the two-day activity swap workflow from this day. */
  onSwapDay?: (dayKey: string) => void
  /** Open the editor to add a card to this day. */
  onAddCard?: (dayKey: string, startTime?: string) => void
  /** Open the editor on an existing card. */
  onEditCard?: (card: CardType) => void
  /** The mobile view supplies its own compact day header. */
  showHeader?: boolean
  /** Numeric hour rail shown in the desktop gutter or at mobile screen-left. */
  hourRail?: 'left' | 'right'
}

function HourRail({
  side,
  dayStart,
  dayEnd,
  direction,
}: {
  side: 'left' | 'right'
  dayStart: string
  dayEnd: string
  direction: TimeDirection
}) {
  const start = clockMinutes(dayStart)
  const end = clockMinutes(dayEnd)
  const firstHour = Math.ceil(start / 60)
  const hours = Array.from(
    { length: Math.max(0, Math.ceil(end / 60) - firstHour) },
    (_, index) => firstHour + index,
  ).filter((hour) => hour % 2 === 0 && hour * 60 < end)

  return (
    <ol
      data-testid="hour-rail"
      aria-hidden
      style={side === 'right' ? { right: -COLUMN_GAP_PX, width: COLUMN_GAP_PX } : undefined}
      className={`pointer-events-none absolute top-0 z-20 h-full ${side === 'right' ? '' : '-left-7 w-[14px]'}`}
    >
      {hours.map((hour) => {
        const minute = hour * 60
        const offset = direction === 'up' ? end - minute : minute - start
        return (
          <li
            key={hour}
            data-testid="hour-mark"
            style={{ top: (offset / 60) * PX_PER_HOUR }}
            className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-px font-sans text-[10px] font-semibold leading-none text-hour-text"
          >
            <span className="h-px flex-1 bg-hour-rule" />
            <span>{hour}</span>
            <span className="h-px flex-1 bg-hour-rule" />
          </li>
        )
      })}
    </ol>
  )
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
  onSwapDay,
  onAddCard,
  onEditCard,
  showHeader = true,
  hourRail,
}: DayColumnProps) {
  const placements = layoutTimelineCards(cards, dayStart, dayEnd, direction)
  const freeSlots = freeTimelineSlots(cards, dayStart, dayEnd, direction)
  const conflicts = overlappingCardIds(cards, dayStart, dayEnd)
  const weekday = format(parseISO(day.key), 'EEE').toUpperCase()
  const dateLabel = formatDay(day.key)
  const weekend = isWeekend(parseISO(day.key))

  const timelineHeight = windowHeightPx(dayStart, dayEnd)

  // The column body is a drop target so cards can be dropped onto an empty day
  // (or its blank space), not only onto another card.
  const { setNodeRef } = useDroppable({ id: dayDroppableId(day.key) })
  // Highlight this column while a card is dragged over it — the "lands here" hint.
  const dragOver = useIsDragOverDay(day.key)
  const dragPreview = useDragPreview()
  const previewTopPx =
    dragPreview?.dayKey === day.key && dragPreview.startTime
      ? ((direction === 'up'
          ? clockMinutes(dayEnd) -
            (clockMinutes(dragPreview.startTime) + dragPreview.durationHours * 60)
          : clockMinutes(dragPreview.startTime) - clockMinutes(dayStart)) /
          60) *
        PX_PER_HOUR
      : 0

  return (
    <section
      data-testid="day-column"
      data-day={day.key}
      data-drag-over={dragOver ? '' : undefined}
      aria-label={`${weekday} ${dateLabel}${city ? ` — ${city.name}` : ''}`}
      style={{ flex: `1 0 ${COLUMN_WIDTH_REM}`, minWidth: COLUMN_WIDTH_REM }}
      className={`flex shrink-0 flex-col bg-white ${dragOver ? 'ring-2 ring-sky-300' : ''}`}
    >
      {showHeader && (
        <header>
          <div className="flex flex-col gap-0.5 px-3 pb-2 pt-2.5">
            <div className="flex items-center justify-between gap-2">
              <span
                data-testid="day-label"
                className={`text-[9.5px] font-extrabold uppercase tracking-[0.18em] ${weekend ? 'text-city-vermilion' : 'text-ink-400'}`}
              >
                {weekday} · {dateLabel}
              </span>
              {onSwapDay && (
                <button
                  type="button"
                  aria-label="Swap day"
                  title="Swap day"
                  onClick={() => onSwapDay(day.key)}
                  className="grid h-6 w-6 place-items-center text-base text-ink-200 hover:text-ink-600"
                >
                  <span aria-hidden>⇄</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span
                data-testid="city-name"
                className="font-serif text-[19px] font-bold leading-tight text-ink"
              >
                {city ? city.name : <span className="text-ink-300">No city</span>}
              </span>
              {cities.length > 0 && (
                <CityPicker
                  label="Choose city"
                  value={overrideCityId}
                  resolvedCityId={city?.id}
                  cities={cities}
                  includeNoCity
                  bareEdit
                  onChange={(cityId) => onSetCity?.(day.key, cityId)}
                />
              )}
            </div>
          </div>
          <div
            data-testid="city-band"
            style={{ backgroundColor: city?.color ?? NO_CITY_COLOR }}
            className="h-1 w-full rounded-[2px]"
          />
        </header>
      )}

      <div
        data-testid="day-body"
        style={{ height: timelineHeight + TIMELINE_VERTICAL_PADDING_PX * 2 }}
        className="relative"
      >
        <div
          ref={setNodeRef}
          data-testid="timeline-track"
          style={{ top: TIMELINE_VERTICAL_PADDING_PX, height: timelineHeight }}
          className={`absolute right-0 ${hourRail === 'left' ? 'left-7' : 'left-0'}`}
        >
          {hourRail && (
            <HourRail
              side={hourRail}
              dayStart={dayStart}
              dayEnd={dayEnd}
              direction={direction}
            />
          )}
          {freeSlots.map((slot) => {
            const start = clockMinutes(slot.startTime)
            const end = clockMinutes(slot.endTime)
            const offset =
              direction === 'up' ? clockMinutes(dayEnd) - end : start - clockMinutes(dayStart)
            const height = ((end - start) / 60) * PX_PER_HOUR
            return (
              <button
                key={`${slot.startTime}-${slot.endTime}`}
                type="button"
                data-testid="timeline-slot"
                aria-label={`Add activity from ${slot.startTime} to ${slot.endTime}`}
                onClick={() => onAddCard?.(day.key, slot.startTime)}
                style={{ top: (offset / 60) * PX_PER_HOUR, height }}
                className="group absolute inset-x-0 z-0 grid cursor-pointer place-items-center overflow-hidden rounded-card border border-dashed border-edge-300 bg-white/80 px-2 text-ink-400 hover:border-solid hover:border-free-border hover:bg-free-hover focus-visible:z-20 focus-visible:border-solid focus-visible:border-free-border focus-visible:bg-free-hover"
              >
                <span className="col-start-1 row-start-1 whitespace-nowrap font-serif text-[12.5px] italic leading-none transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0">
                  {formatFreeDuration(slot.startTime, slot.endTime)}
                </span>
                <span className="col-start-1 row-start-1 whitespace-nowrap font-sans text-[10px] font-bold uppercase leading-none tracking-[0.08em] text-city-vermilion opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  ＋ add activity
                </span>
              </button>
            )
          })}

          <ol
            data-testid="card-list"
            className="pointer-events-none relative z-10 flex flex-col pl-0"
          >
            {placements.map((placement, index) => {
              const previous = placements[index - 1]
              const previousEnd = previous
                ? previous.offsetMinutes + previous.durationMinutes
                : 0
              const gap = ((placement.offsetMinutes - previousEnd) / 60) * PX_PER_HOUR
              const c = placement.card
              return (
                <SortableCard
                  key={c.id}
                  card={c}
                  conflict={conflicts.has(c.id)}
                  onEdit={onEditCard}
                  dayStart={dayStart}
                  dayEnd={dayEnd}
                  direction={direction}
                  layoutStyle={{ height: cardHeightPx(c, dayStart, dayEnd), marginTop: gap }}
                />
              )
            })}
          </ol>

          {dragPreview?.dayKey === day.key && (
            <div
              data-testid="drag-preview-card"
              style={{
                top: previewTopPx,
                height: dragPreview.durationHours * PX_PER_HOUR,
              }}
              className="pointer-events-none absolute inset-x-0 z-20"
            >
              <Card
                card={dragPreview.card}
                dayStart={dayStart}
                dayEnd={dayEnd}
                timingPreview={dragPreview}
              />
            </div>
          )}
        </div>
      </div>

    </section>
  )
}

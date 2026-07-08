// §10 date picker: a calendar pop-over that replaces the native
// `<input type="date">`. Two modes decided by which callback is passed —
// single-date (trip start, `value`/`onSelect`) and first→last range (a stay's
// nights, `range`/`onRangeChange`). Values in and out stay ISO 'yyyy-MM-dd';
// only the display is European. Rendered through the shared anchored `Popover`
// (a full-screen sheet on mobile), so this file only owns the month grid.

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Popover } from '../../components/Popover'
import { formatDay, formatDayLong } from '../../data/dateFormat'
import {
  WEEKDAY_LABELS,
  inRange,
  isEndpoint,
  monthGrid,
  nextRange,
  type DateRange,
} from './calendar'

interface DatePickerProps {
  /** Accessible name for the trigger + calendar dialog. */
  label: string
  /** Classes for the trigger button (styles it as a field). */
  triggerClassName?: string
  /** Shown in the trigger before anything is picked. */
  placeholder?: string
  /** Single-date mode: current ISO value + commit callback. */
  value?: string
  onSelect?: (iso: string) => void
  /** Range mode: current first→last range + change callback. */
  range?: DateRange
  onRangeChange?: (range: DateRange) => void
}

export function DatePicker({
  label,
  triggerClassName = '',
  placeholder = 'Pick a date',
  value,
  onSelect,
  range,
  onRangeChange,
}: DatePickerProps) {
  const isRange = onRangeChange !== undefined
  const hasValue = isRange ? Boolean(range?.start) : Boolean(value)

  const triggerText = isRange
    ? range?.start
      ? `${formatDay(range.start)} → ${range.end ? formatDay(range.end) : '…'}`
      : placeholder
    : value
      ? formatDayLong(value)
      : placeholder

  return (
    <Popover
      label={label}
      triggerAriaLabel={label}
      triggerClassName={triggerClassName}
      trigger={<span className={hasValue ? '' : 'text-ink-400'}>{triggerText}</span>}
    >
      {(close) => (
        <Calendar
          seed={range?.start ?? value}
          selected={value}
          range={range}
          onPick={(key) => {
            if (isRange) {
              const next = nextRange(range ?? {}, key)
              onRangeChange(next)
              if (next.end) close()
            } else {
              onSelect?.(key)
              close()
            }
          }}
        />
      )}
    </Popover>
  )
}

function Calendar({
  seed,
  selected,
  range,
  onPick,
}: {
  seed?: string
  selected?: string
  range?: DateRange
  onPick: (key: string) => void
}) {
  const seedDate = seed ? parseISO(seed) : new Date()
  const [view, setView] = useState({ year: seedDate.getFullYear(), month: seedDate.getMonth() })
  const firstOfView = new Date(view.year, view.month, 1)
  const weeks = monthGrid(view.year, view.month)

  function step(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const navButton = 'rounded-chip px-2 py-1 text-base text-ink-600 hover:bg-surface-chip'

  return (
    <div data-month={format(firstOfView, 'yyyy-MM')} className="mx-auto w-60 lg:mx-0">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => step(-1)} className={navButton}>
          ‹
        </button>
        <span className="font-serif text-sm font-semibold text-ink">{format(firstOfView, 'MMMM yyyy')}</span>
        <button type="button" aria-label="Next month" onClick={() => step(1)} className={navButton}>
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {WEEKDAY_LABELS.map((w, i) => (
          <span key={i} className="pb-1 text-[10px] font-bold uppercase text-ink-400">
            {w}
          </span>
        ))}
        {weeks.flat().map((d) =>
          d.inMonth ? (
            (() => {
              const endpoint = range ? isEndpoint(range, d.key) : d.key === selected
              const between = range ? inRange(range, d.key) && !endpoint : false
              const cls = endpoint
                ? 'bg-city-vermilion font-semibold text-white'
                : between
                  ? 'bg-transit-bg text-ink'
                  : 'text-ink hover:bg-surface-chip'
              return (
                <button
                  key={d.key}
                  type="button"
                  data-key={d.key}
                  aria-label={format(parseISO(d.key), 'd MMMM yyyy')}
                  aria-pressed={endpoint || undefined}
                  onClick={() => onPick(d.key)}
                  className={`rounded-chip py-1 text-xs ${cls}`}
                >
                  {d.dayOfMonth}
                </button>
              )
            })()
          ) : (
            <span key={d.key} aria-hidden className="py-1 text-xs text-ink-200">
              {d.dayOfMonth}
            </span>
          ),
        )}
      </div>
    </div>
  )
}

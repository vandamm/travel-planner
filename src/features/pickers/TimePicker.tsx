// §11 time picker: an hour/minute wheel pop-over that replaces the native
// `<input type="time">`. Two scrollable columns (hours · minutes) with a
// centred selection highlight; a "Set HH:mm" footer commits and a "Clear"
// footer (activities only, when `onClear` is passed) untimes the card. Values in
// and out stay 24h 'HH:mm'. Rendered through the shared anchored `Popover` (a
// full-screen sheet on mobile), so this file only owns the two columns.

import { useEffect, useRef, useState } from 'react'
import { Popover } from '../../components/Popover'
import { HOURS, MINUTES, formatTime, parseTime } from './timeWheel'

interface TimePickerProps {
  /** Accessible name for the trigger + wheel dialog. */
  label: string
  /** Classes for the trigger button (styles it as a field). */
  triggerClassName?: string
  /** Shown in the trigger before a time is set. */
  placeholder?: string
  /** Current 'HH:mm' value (empty/undefined = unset). */
  value?: string
  /** Commit a chosen 'HH:mm'. */
  onChange: (value: string) => void
  /** When given, adds a "Clear" button that untimes (the consumer clears the field). */
  onClear?: () => void
}

/** Seed the wheel here when the field is empty — a sensible morning default. */
const DEFAULT: { hour: number; minute: number } = { hour: 9, minute: 0 }

export function TimePicker({
  label,
  triggerClassName = '',
  placeholder = 'Set time',
  value,
  onChange,
  onClear,
}: TimePickerProps) {
  const hasValue = Boolean(value)
  return (
    <Popover
      label={label}
      triggerAriaLabel={label}
      triggerClassName={triggerClassName}
      trigger={<span className={hasValue ? '' : 'text-ink-400'}>{hasValue ? value : placeholder}</span>}
    >
      {(close) => (
        <Wheel
          value={value}
          onSet={(v) => {
            onChange(v)
            close()
          }}
          onClear={
            onClear &&
            (() => {
              onClear()
              close()
            })
          }
        />
      )}
    </Popover>
  )
}

function Wheel({
  value,
  onSet,
  onClear,
}: {
  value?: string
  onSet: (v: string) => void
  onClear?: () => void
}) {
  const seed = parseTime(value) ?? DEFAULT
  const [hour, setHour] = useState(seed.hour)
  const [minute, setMinute] = useState(seed.minute)
  const current = formatTime({ hour, minute })

  return (
    <div className="mx-auto w-44 lg:mx-0">
      <div className="flex items-stretch justify-center gap-1">
        <Column label="Hour" values={HOURS} selected={hour} onSelect={setHour} />
        <span className="self-center font-serif text-lg text-ink-400">:</span>
        <Column label="Minute" values={MINUTES} selected={minute} onSelect={setMinute} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSet(current)}
          className="flex-1 rounded-card bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink-frame"
        >
          Set {current}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-card px-3 py-2 text-sm font-medium text-ink-600 hover:bg-surface-chip"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function Column({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string
  values: string[]
  selected: number
  onSelect: (n: number) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)
  // Centre the selected cell in the scroll band (no-op in jsdom — scrollIntoView
  // is undefined there, so the optional call short-circuits).
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ block: 'center' })
  }, [selected])

  return (
    <div role="listbox" aria-label={label} className="h-36 w-16 overflow-y-auto rounded-card border border-edge">
      {values.map((v, i) => {
        const active = i === selected
        return (
          <button
            key={v}
            ref={active ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={active}
            aria-label={`${label} ${v}`}
            onClick={() => onSelect(i)}
            className={`block w-full py-1.5 text-center font-serif text-sm ${
              active ? 'bg-city-vermilion font-semibold text-white' : 'text-ink hover:bg-surface-chip'
            }`}
          >
            {v}
          </button>
        )
      })}
    </div>
  )
}

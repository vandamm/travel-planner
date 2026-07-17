import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Modal } from '../../components/Modal'
import { formatDay } from '../../data/dateFormat'
import type { City, Day } from '../../data/schema'

export interface DaySwapModalProps {
  sourceDay: Day
  days: Day[]
  cityByDay: Map<string, City | undefined>
  onConfirm: (targetDayKey: string) => void
  onClose: () => void
}

function dayLabel(day: Day): string {
  return `${format(parseISO(day.key), 'EEE')} · ${formatDay(day.key)}`
}

function cityLabel(city: City | undefined): string {
  return city?.name ?? 'No city'
}

export function DaySwapModal({
  sourceDay,
  days,
  cityByDay,
  onConfirm,
  onClose,
}: DaySwapModalProps) {
  const targets = days.filter((day) => day.key !== sourceDay.key)
  const [targetDayKey, setTargetDayKey] = useState(targets[0]?.key ?? '')
  const targetDay = targets.find((day) => day.key === targetDayKey)

  return (
    <Modal
      label="Swap activity day"
      title="Swap day"
      onClose={onClose}
      className="flex w-full flex-col gap-4 sm:max-w-md"
    >
      <h2 className="font-serif text-xl font-semibold text-ink">Swap day</h2>
      <p className="text-sm leading-relaxed text-ink-500">
        Activities and displayed cities exchange dates. Stays do not move.
      </p>

      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink-600">
        Swap with
        <select
          aria-label="Swap with"
          value={targetDayKey}
          onChange={(event) => setTargetDayKey(event.target.value)}
          className="rounded-card border border-edge bg-white px-3 py-2 font-normal text-ink"
        >
          {targets.map((day) => (
            <option key={day.key} value={day.key}>
              {dayLabel(day)} — {cityLabel(cityByDay.get(day.key))}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <div data-testid="swap-source" className="rounded-card border border-edge bg-surface p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-400">
            From
          </span>
          <strong className="mt-1 block font-serif text-ink">{dayLabel(sourceDay)}</strong>
          <span className="text-sm text-ink-500">{cityLabel(cityByDay.get(sourceDay.key))}</span>
        </div>
        <span aria-hidden className="self-center text-ink-300">
          ⇄
        </span>
        <div data-testid="swap-target" className="rounded-card border border-edge bg-surface p-3">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-400">
            With
          </span>
          {targetDay && (
            <>
              <strong className="mt-1 block font-serif text-ink">{dayLabel(targetDay)}</strong>
              <span className="text-sm text-ink-500">
                {cityLabel(cityByDay.get(targetDay.key))}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-card border border-edge px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-surface"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!targetDay}
          onClick={() => targetDay && onConfirm(targetDay.key)}
          className="rounded-card bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-frame disabled:opacity-40"
        >
          Swap days
        </button>
      </div>
    </Modal>
  )
}

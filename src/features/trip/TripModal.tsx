// Trip-level settings (title, start date + days, day-timeline window) as a
// scrim pop-over, opened from the header's `[✎ Trip]` button. Edits write
// straight through the shared `setTrip` mutator — live, like every other edit —
// so there is no Save/Cancel: a single ink `Done` (plus backdrop / Escape via
// the shared `Modal`) closes it. Start date + day window use the custom
// calendar / time-wheel pickers; the day count stays a native number input.

import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { DatePicker } from '../pickers/DatePicker'
import { TimePicker } from '../pickers/TimePicker'
import { getTrip, setTrip } from '../../data/doc'
import { MAX_TRIP_DAYS } from '../../data/days'
import { applyTrip } from '../../data/applyTrip'
import { exportTripJSON } from '../../data/exportTrip'
import { parseTripText } from '../../data/tripSchema'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'

export interface TripModalProps {
  onClose: () => void
}

export function TripModal({ onClose }: TripModalProps) {
  const { doc } = useRoom()
  useDocVersion(doc)
  const trip = getTrip(doc)

  // "Trip JSON (for AI)" panel state — copy the current board, paste an updated one.
  const [pasteText, setPasteText] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    void navigator.clipboard?.writeText(exportTripJSON(doc))
    setCopied(true)
  }

  function handleApply() {
    const result = parseTripText(pasteText)
    if (!result.ok) {
      setApplyError(result.error)
      return
    }
    // Full replace — a native confirm is enough of a guard for a personal planner.
    // ponytail: window.confirm, a bespoke confirm modal is deferred polish.
    if (!window.confirm('Replace the whole trip with this JSON? This overwrites every city, stay, and card.')) return
    applyTrip(doc, result.data)
    setApplyError(null)
    setPasteText('')
  }

  const sectionLabel = 'text-[10px] font-bold uppercase tracking-[0.06em] text-ink-400'
  const fieldInput = 'rounded-card border border-edge px-3 py-2 text-base text-ink'

  return (
    <Modal label="Trip details" onClose={onClose} className="flex w-full flex-col gap-4 lg:max-w-md">
      <div className="flex items-center gap-3 border-b border-edge pb-3">
        {/* Vermilion seal — mirrors the header mark, per the mock. */}
        <div
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] bg-city-vermilion font-serif text-lg font-semibold italic leading-none text-white"
        >
          I
        </div>
        <h2 className="font-serif text-xl font-semibold text-ink">Trip details</h2>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Trip title</span>
        <input
          type="text"
          autoFocus
          value={trip.title}
          onChange={(e) => setTrip(doc, { title: e.target.value })}
          placeholder="e.g. Italy 2027"
          className={`${fieldInput} font-serif`}
        />
      </label>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <span className={sectionLabel}>Start date</span>
          <DatePicker
            label="Start date"
            value={trip.startDate}
            onSelect={(iso) => setTrip(doc, { startDate: iso })}
            placeholder="Pick a start date"
            triggerClassName={`${fieldInput} font-serif text-left`}
          />
        </div>

        <label className="flex w-24 flex-col gap-1.5">
          <span className={sectionLabel}>Number of days</span>
          <input
            type="number"
            min={1}
            max={MAX_TRIP_DAYS}
            value={trip.numDays || ''}
            onChange={(e) => setTrip(doc, { numDays: Number(e.target.value) })}
            className={`${fieldInput} font-serif`}
          />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>
          Day window <span className="font-medium normal-case tracking-normal text-ink-300">— how tall a day feels</span>
        </span>
        <div className="flex items-center gap-2">
          <TimePicker
            label="Day start"
            value={trip.dayStart}
            onChange={(v) => setTrip(doc, { dayStart: v })}
            triggerClassName={`${fieldInput} flex-1 text-center font-serif`}
          />
          <span className="text-xs font-semibold text-ink-400">to</span>
          <TimePicker
            label="Day end"
            value={trip.dayEnd}
            onChange={(v) => setTrip(doc, { dayEnd: v })}
            triggerClassName={`${fieldInput} flex-1 text-center font-serif`}
          />
        </div>
      </div>

      {/* Low-prominence: copy the board as JSON for an AI, or paste an AI's
          updated JSON back in (full replace). */}
      <details className="rounded-card border border-edge text-ink-600">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-ink-400">
          Trip JSON (for AI)
        </summary>
        <div className="flex flex-col gap-3 border-t border-edge p-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className={sectionLabel}>Current trip</span>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-card border border-edge px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              readOnly
              aria-label="Current trip JSON"
              value={exportTripJSON(doc)}
              className="h-28 w-full resize-y rounded-card border border-edge bg-surface p-2 font-mono text-[11px] text-ink-600"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={sectionLabel}>Paste updated JSON</span>
            <textarea
              aria-label="Paste updated trip JSON"
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value)
                setApplyError(null)
              }}
              placeholder="Paste the AI's updated trip JSON here…"
              className="h-28 w-full resize-y rounded-card border border-edge p-2 font-mono text-[11px] text-ink"
            />
            {applyError && (
              <p role="alert" className="text-xs text-city-vermilion">
                {applyError}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleApply}
                disabled={pasteText.trim() === ''}
                className="rounded-card bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-frame disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </details>

      <div className="mt-1 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-card bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink-frame"
        >
          Done
        </button>
      </div>
    </Modal>
  )
}

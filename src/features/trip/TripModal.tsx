// Trip-level settings (title, inclusive date range, day-timeline window) as a
// scrim pop-over, opened from the header's `[✎ Trip]` button. Edits write
// straight through the shared `setTrip` mutator — live, like every other edit —
// so there is no Save/Cancel: a single ink `Done` (plus backdrop / Escape via
// the shared `Modal`) closes it. Start date + day window use the custom
// calendar / time-wheel pickers.

import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { DatePicker } from '../pickers/DatePicker'
import { TimePicker } from '../pickers/TimePicker'
import { getTrip, setTrip } from '../../data/doc'
import { applyTrip } from '../../data/applyTrip'
import { exportTripJSON } from '../../data/exportTrip'
import { parseTripText } from '../../data/tripSchema'
import { useRoom } from '../../data/RoomContext'
import { useDocVersion } from '../../data/useDoc'

export interface TripModalProps {
  onClose: () => void
}

interface VersionMeta {
  id: string
  timestamp: number
}

export function TripModal({ onClose }: TripModalProps) {
  const { doc, roomId, workerUrl } = useRoom()
  useDocVersion(doc)
  const trip = getTrip(doc)

  // `exportTrip` re-validates the live doc and throws on an inconsistent state
  // (e.g. concurrent day-window edits that merge into dayEnd <= dayStart). Guard so
  // an unserializable board shows a message rather than throwing here in render
  // — this runs on every doc change (useDocVersion) — and white-screening.
  let currentJson: string | null
  try {
    currentJson = exportTripJSON(doc)
  } catch {
    currentJson = null
  }

  // "Trip JSON (for AI)" panel state — copy the current board, paste an updated one.
  const [pasteText, setPasteText] = useState('')
  const [applyError, setApplyError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [dateError, setDateError] = useState<string | null>(null)

  // "Recent versions" — pre-write snapshots the Worker records on each AI write.
  const [versions, setVersions] = useState<VersionMeta[]>([])
  const [versionsError, setVersionsError] = useState<string | null>(null)

  function handleCopy() {
    if (currentJson === null) return
    void navigator.clipboard?.writeText(currentJson)
    setCopied(true)
  }

  function setStartDate(startDate: string) {
    if (trip.endDate && startDate > trip.endDate) {
      setDateError('Start date must be on or before end date.')
      return
    }
    setDateError(null)
    setTrip(doc, { startDate })
  }

  function setEndDate(endDate: string) {
    if (trip.startDate && endDate < trip.startDate) {
      setDateError('End date must be on or after start date.')
      return
    }
    setDateError(null)
    setTrip(doc, { endDate })
  }

  // Full replace — a native confirm is enough of a guard for a personal planner.
  // ponytail: window.confirm, a bespoke confirm modal is deferred polish.
  // Shared by paste-apply and version-restore so both run the same validate +
  // confirm + full-replace path.
  function applyJsonText(text: string): void {
    const result = parseTripText(text)
    if (!result.ok) {
      setApplyError(result.error)
      return
    }
    if (
      !window.confirm(
        'Replace the whole trip with this JSON? This overwrites every city, stay, and card.',
      )
    )
      return
    applyTrip(doc, result.data)
    setApplyError(null)
    setPasteText('')
  }

  function handleApply() {
    applyJsonText(pasteText)
  }

  async function loadVersions() {
    if (!roomId) return
    setVersionsError(null)
    try {
      const base = `${workerUrl.replace(/\/$/, '')}/api/versions/${encodeURIComponent(roomId)}`
      const res = await fetch(base)
      if (!res.ok) throw new Error(String(res.status))
      const body = (await res.json()) as { versions?: VersionMeta[] }
      setVersions(body.versions ?? [])
    } catch {
      setVersionsError('Could not load version history.')
    }
  }

  async function restoreVersion(id: string) {
    if (!roomId) return
    setVersionsError(null)
    try {
      const base = `${workerUrl.replace(/\/$/, '')}/api/versions/${encodeURIComponent(roomId)}`
      const res = await fetch(`${base}/${encodeURIComponent(id)}`)
      if (!res.ok) throw new Error(String(res.status))
      applyJsonText(await res.text())
    } catch {
      setVersionsError('Could not load that version.')
    }
  }

  const sectionLabel = 'text-[10px] font-bold uppercase tracking-[0.06em] text-ink-400'
  const fieldInput = 'rounded-card border border-edge px-3 py-2 text-base text-ink'

  return (
    <Modal
      label="Trip details"
      title="Trip details"
      onClose={onClose}
      mobileAction={<button type="button" onClick={onClose} className="button-label text-ink">Done</button>}
      className="flex w-full flex-col gap-4 min-[400px]:max-w-md"
    >
      <div className="hidden items-center gap-3 border-b border-edge pb-3 min-[400px]:flex">
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
            onSelect={setStartDate}
            placeholder="Pick a start date"
            triggerClassName={`${fieldInput} font-serif text-left`}
          />
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <span className={sectionLabel}>End date</span>
          <DatePicker
            label="End date"
            value={trip.endDate}
            onSelect={setEndDate}
            placeholder="Pick an end date"
            triggerClassName={`${fieldInput} font-serif text-left`}
          />
        </div>
      </div>
      {dateError && <p role="alert" className="text-xs text-city-vermilion">{dateError}</p>}

      <label className="flex flex-col gap-1.5">
        <span className={sectionLabel}>Trip colour</span>
        <input
          type="color"
          aria-label="Trip colour"
          value={trip.color ?? '#c0392b'}
          onChange={(e) => setTrip(doc, { color: e.target.value })}
          className="h-9 w-14 cursor-pointer rounded-card border border-edge bg-transparent p-0"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>
          Day window{' '}
          <span className="font-medium normal-case tracking-normal text-ink-300">
            — how tall a day feels
          </span>
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
                disabled={currentJson === null}
                className="rounded-card border border-edge px-2 py-1 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-40"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <textarea
              readOnly
              aria-label="Current trip JSON"
              value={
                currentJson ??
                "This board can't be serialized right now because it is in an inconsistent state. Fix the trip settings, such as the day window, or replace it with valid trip JSON to export."
              }
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

          {/* Restore a pre-write snapshot — one-click revert of a bad AI edit.
              Only meaningful in a synced room (that's where snapshots exist). */}
          {roomId && (
            <details
              className="rounded-card border border-edge"
              onToggle={(e) => {
                if (e.currentTarget.open) void loadVersions()
              }}
            >
              <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-semibold text-ink-400">
                Recent versions
              </summary>
              <div className="flex flex-col gap-1.5 border-t border-edge p-2">
                {versionsError && (
                  <p role="alert" className="text-xs text-city-vermilion">
                    {versionsError}
                  </p>
                )}
                {!versionsError && versions.length === 0 && (
                  <p className="text-xs text-ink-300">No saved versions yet.</p>
                )}
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-600">
                      {new Date(v.timestamp).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => void restoreVersion(v.id)}
                      className="rounded-card border border-edge px-2 py-1 text-xs font-semibold text-ink hover:bg-surface"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </details>

      <div className="mt-1 flex justify-end max-[399px]:hidden">
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

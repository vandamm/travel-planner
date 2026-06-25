// Create / edit / delete an accommodation (a stay spanning one or more nights).
// A modal form over the board, mirroring `CardEditor`. All writes route through
// the shared accommodation mutators (`doc.ts`), so they persist locally and sync
// like everything else and feed the hybrid day-city resolution. The stay's city
// is optional; clearing it removes the field (the covered days fall back to a
// travel-day with no color unless an override pins one).

import { useState, type FormEvent } from 'react'
import {
  addAccommodation,
  listCities,
  removeAccommodation,
  updateAccommodation,
} from '../../data/doc'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'
import type { Accommodation } from '../../data/schema'

export interface AccommodationEditorProps {
  /** The stay being edited; omit for create mode. */
  accommodation?: Accommodation
  /** Default first night for a new stay (create mode). */
  defaultStartNight?: string
  /** Default last night for a new stay (create mode). */
  defaultEndNight?: string
  onClose: () => void
}

export function AccommodationEditor({
  accommodation,
  defaultStartNight,
  defaultEndNight,
  onClose,
}: AccommodationEditorProps) {
  const { doc } = useRoom()
  useDocVersion(doc)
  const isEdit = accommodation !== undefined
  const cities = listCities(doc)

  const [label, setLabel] = useState(accommodation?.label ?? '')
  const [cityId, setCityId] = useState(accommodation?.cityId ?? '')
  const [startNight, setStartNight] = useState(accommodation?.startNight ?? defaultStartNight ?? '')
  const [endNight, setEndNight] = useState(accommodation?.endNight ?? defaultEndNight ?? '')

  const rangeInvalid = Boolean(startNight && endNight && endNight < startNight)
  const invalid = !label.trim() || !startNight || !endNight || rangeInvalid

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    const fields = {
      label: label.trim(),
      // An empty selection clears the city; `undefined` deletes the doc field.
      cityId: cityId || undefined,
      startNight,
      endNight,
    }
    if (isEdit) updateAccommodation(doc, accommodation.id, fields)
    else addAccommodation(doc, fields)
    onClose()
  }

  function onDelete() {
    if (accommodation) removeAccommodation(doc, accommodation.id)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Accommodation editor"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-white p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-slate-800">
          {isEdit ? 'Edit stay' : 'Add stay'}
        </h2>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            Accommodation label
            <input
              type="text"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Hotel Roma"
              className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
            City
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
            >
              <option value="">No city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-600">
              First night
              <input
                type="date"
                value={startNight}
                onChange={(e) => setStartNight(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-600">
              Last night
              <input
                type="date"
                value={endNight}
                onChange={(e) => setEndNight(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
              />
            </label>
          </div>

          {rangeInvalid && (
            <p role="alert" className="text-xs font-medium text-red-600">
              The last night cannot be before the first night.
            </p>
          )}

          <div className="mt-1 flex items-center justify-between gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={onDelete}
                className="rounded px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete stay
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={invalid}
                className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save stay
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

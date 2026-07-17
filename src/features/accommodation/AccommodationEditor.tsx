// Create / edit / delete an accommodation (a stay spanning one or more nights).
// A modal form over the board, mirroring `CardEditor`. All writes route through
// the shared accommodation mutators (`doc.ts`), so they persist locally and sync
// like everything else and feed the hybrid day-city resolution. The stay's city
// is optional; clearing it removes the field (the covered days fall back to a
// travel-day with no color unless an override pins one).

import { useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { DatePicker } from '../pickers/DatePicker'
import {
  addAccommodation,
  listCities,
  removeAccommodation,
  updateAccommodation,
} from '../../data/doc'
import { useRoom } from '../../data/RoomContext'
import { useDocVersion } from '../../data/useDoc'
import type { Accommodation } from '../../data/schema'
import { CityPicker } from '../cities/CityPicker'

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

  // The range picker guarantees start <= end (it swaps on a before-anchor pick),
  // so the only remaining invalid state is a missing label or an incomplete range.
  const invalid = !label.trim() || !startNight || !endNight

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

  const sectionLabel = 'text-[10px] font-bold uppercase tracking-[0.06em] text-ink-400'
  const fieldInput = 'rounded-card border border-edge px-3 py-2 text-base text-ink'

  return (
    <Modal
      label="Accommodation editor"
      title={isEdit ? 'Edit stay' : 'Add stay'}
      onClose={onClose}
      mobileAction={<button type="submit" form="accommodation-editor-form" disabled={invalid} className="button-label text-ink disabled:opacity-40">Save</button>}
      className="flex w-full flex-col gap-4 min-[400px]:max-w-md"
    >
      <h2 className="font-serif text-xl font-semibold text-ink">
        {isEdit ? 'Edit stay' : 'Add stay'}
      </h2>

      <form id="accommodation-editor-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Accommodation label</span>
          <input
            type="text"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Hotel Roma"
            className={`${fieldInput} font-serif`}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className={sectionLabel}>City</span>
          <CityPicker
            label="City"
            value={cityId || undefined}
            cities={cities}
            onChange={(id) => setCityId(id ?? '')}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={sectionLabel}>Nights (first → last)</span>
          <DatePicker
            label="Stay nights"
            range={{ start: startNight || undefined, end: endNight || undefined }}
            onRangeChange={(r) => {
              setStartNight(r.start ?? '')
              setEndNight(r.end ?? '')
            }}
            placeholder="Pick the nights"
            triggerClassName={`${fieldInput} font-serif text-left`}
          />
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 max-[399px]:flex-col">
          {isEdit ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-card border border-transit-border px-4 py-2 text-sm font-semibold text-city-vermilion hover:bg-transit-bg max-[399px]:mx-auto"
            >
              Delete stay
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2 max-[399px]:hidden">
            <button
              type="button"
              onClick={onClose}
              className="rounded-card px-3 py-2 text-sm font-medium text-ink-600 hover:bg-surface-chip"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={invalid}
              className="rounded-card bg-ink px-5 py-2 text-sm font-semibold text-white hover:bg-ink-frame disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save stay
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

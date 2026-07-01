// Create / edit / delete an accommodation (a stay spanning one or more nights).
// A modal form over the board, mirroring `CardEditor`. All writes route through
// the shared accommodation mutators (`doc.ts`), so they persist locally and sync
// like everything else and feed the hybrid day-city resolution. The stay's city
// is optional; clearing it removes the field (the covered days fall back to a
// travel-day with no color unless an override pins one).

import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
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
  const endRef = useRef<HTMLInputElement>(null)

  const rangeInvalid = Boolean(startNight && endNight && endNight < startNight)
  const invalid = !label.trim() || !startNight || !endNight || rangeInvalid

  // Picking the first night chains to the last-night picker: give the checkout a
  // sensible default (≥ the first night), focus the field so it's testable, then
  // open the native picker when the browser supports it (no-op/fallback if not).
  function onStartChange(value: string) {
    setStartNight(value)
    if (value && (!endNight || endNight < value)) setEndNight(value)
    const end = endRef.current
    if (!end) return
    end.focus()
    if (typeof end.showPicker === 'function') {
      try {
        end.showPicker()
      } catch {
        // showPicker needs transient user activation; focus() already applied.
      }
    }
  }

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
      onClose={onClose}
      className="flex w-full flex-col gap-4 lg:max-w-md"
    >
      <h2 className="font-serif text-xl font-semibold text-ink">
        {isEdit ? 'Edit stay' : 'Add stay'}
      </h2>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

        <label className="flex flex-col gap-1.5">
          <span className={sectionLabel}>City</span>
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className={fieldInput}
          >
            <option value="">No city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={sectionLabel}>First night</span>
            <input
              type="date"
              // lang="de" hints the native picker toward dd.mm.yyyy; the value
              // stays ISO. ponytail: picker format is browser-dependent.
              lang="de"
              value={startNight}
              onChange={(e) => onStartChange(e.target.value)}
              className={`${fieldInput} text-center font-serif`}
            />
          </label>
          <span className="pb-2.5 text-ink-400">→</span>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className={sectionLabel}>Last night</span>
            <input
              ref={endRef}
              type="date"
              lang="de"
              value={endNight}
              onChange={(e) => setEndNight(e.target.value)}
              className={`${fieldInput} text-center font-serif`}
            />
          </label>
        </div>

        {rangeInvalid && (
          <p role="alert" className="text-xs font-medium text-city-vermilion">
            The last night cannot be before the first night.
          </p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          {isEdit ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-card border border-transit-border px-4 py-2 text-sm font-semibold text-city-vermilion hover:bg-transit-bg"
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

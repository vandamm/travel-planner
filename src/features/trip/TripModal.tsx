// Trip-level settings (title, start date + days, day-timeline window) as a
// scrim pop-over, opened from the header's `[✎ Trip]` button. Edits write
// straight through the shared `setTrip` mutator — live, like every other edit —
// so there is no Save/Cancel: a single ink `Done` (plus backdrop / Escape via
// the shared `Modal`) closes it. Native date/number/time inputs stay.

import { Modal } from '../../components/Modal'
import { getTrip, setTrip } from '../../data/doc'
import { MAX_TRIP_DAYS } from '../../data/days'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'

export interface TripModalProps {
  onClose: () => void
}

export function TripModal({ onClose }: TripModalProps) {
  const { doc } = useRoom()
  useDocVersion(doc)
  const trip = getTrip(doc)

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
        <label className="flex flex-1 flex-col gap-1.5">
          <span className={sectionLabel}>Start date</span>
          <input
            type="date"
            // lang="de" hints the native picker toward dd.mm.yyyy; the value stays
            // ISO so data is unambiguous. ponytail: picker format is browser-dependent.
            lang="de"
            value={trip.startDate}
            onChange={(e) => setTrip(doc, { startDate: e.target.value })}
            className={`${fieldInput} font-serif`}
          />
        </label>

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
          <input
            type="time"
            aria-label="Day start"
            // lang="de" hints the native picker toward 24h; the value stays HH:mm.
            lang="de"
            value={trip.dayStart}
            onChange={(e) => setTrip(doc, { dayStart: e.target.value })}
            className={`${fieldInput} flex-1 text-center font-serif`}
          />
          <span className="text-xs font-semibold text-ink-400">to</span>
          <input
            type="time"
            aria-label="Day end"
            lang="de"
            value={trip.dayEnd}
            onChange={(e) => setTrip(doc, { dayEnd: e.target.value })}
            className={`${fieldInput} flex-1 text-center font-serif`}
          />
        </div>
      </div>

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

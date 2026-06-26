// Trip-level settings: title, start date, and number of days. Edits write
// straight through the shared `setTrip` mutator, so they persist locally and
// sync like everything else.

import { getTrip, setTrip } from '../../data/doc'
import { MAX_TRIP_DAYS } from '../../data/days'
import { useRoom } from '../../data/RoomProvider'
import { useDocVersion } from '../../data/useDoc'

export function TripSettings() {
  const { doc } = useRoom()
  useDocVersion(doc)
  const trip = getTrip(doc)

  return (
    <section
      aria-labelledby="trip-settings-heading"
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="trip-settings-heading" className="text-lg font-semibold text-slate-800">
        Trip
      </h2>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-600">
        Trip title
        <input
          type="text"
          value={trip.title}
          onChange={(e) => setTrip(doc, { title: e.target.value })}
          placeholder="e.g. Italy 2027"
          className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-slate-600">
          Start date
          <input
            type="date"
            // lang="de" hints the native picker toward dd.mm.yyyy; the value stays
            // ISO so data is unambiguous. ponytail: picker format is browser-dependent.
            lang="de"
            value={trip.startDate}
            onChange={(e) => setTrip(doc, { startDate: e.target.value })}
            className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
          />
        </label>

        <label className="flex w-28 flex-col gap-1 text-sm font-medium text-slate-600">
          Number of days
          <input
            type="number"
            min={1}
            max={MAX_TRIP_DAYS}
            value={trip.numDays || ''}
            onChange={(e) => setTrip(doc, { numDays: Number(e.target.value) })}
            className="rounded border border-slate-300 px-2 py-1 text-base text-slate-900"
          />
        </label>
      </div>
    </section>
  )
}

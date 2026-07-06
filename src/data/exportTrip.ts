// Serialize a live `Y.Doc` to a validated, deterministic trip document.
//
// The Worker's agent `GET /api/trip/:room` and the client's "download" both use
// this, so what an agent reads and what a human exports are identical. Output is
// sorted into a stable order (Y.Map iteration order is not guaranteed) so an
// export → import round-trip is byte-stable, and is run through the zod schema
// on the way out — an export is therefore always a re-importable document.

import type * as Y from 'yjs'
import {
  getTrip,
  listAccommodations,
  listCards,
  listCities,
  listDayOverrides,
} from './doc'
import { tripDocumentSchema, type TripDocument } from './tripSchema'

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)

export function exportTrip(doc: Y.Doc): TripDocument {
  const cities = listCities(doc).slice().sort(byId)
  const cityIds = new Set(cities.map((c) => c.id))
  const accommodations = listAccommodations(doc)
    .map((acc) => {
      if (acc.cityId === undefined || cityIds.has(acc.cityId)) return acc
      return {
        id: acc.id,
        label: acc.label,
        startNight: acc.startNight,
        endNight: acc.endNight,
      }
    })
    .slice()
    .sort((a, b) => a.startNight.localeCompare(b.startNight) || byId(a, b))
  const cards = listCards(doc)
    .slice()
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.order - b.order || byId(a, b))
  const dayOverrides = Object.fromEntries(
    Object.entries(listDayOverrides(doc)).filter(([, cityId]) => cityIds.has(cityId)),
  )

  return tripDocumentSchema.parse({
    trip: getTrip(doc),
    cities,
    accommodations,
    cards,
    dayOverrides,
  })
}

/** Pretty-printed JSON of {@link exportTrip}, ready to write to a file. */
export function exportTripJSON(doc: Y.Doc): string {
  return JSON.stringify(exportTrip(doc), null, 2)
}

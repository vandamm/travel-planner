// Apply a validated trip document to a `Y.Doc` as a full replace.
//
// Environment-agnostic and shared by the client's import UI and the Worker's
// agent `POST /api/trip/:room`, so both write the doc through the same path and
// can never diverge. The whole replace runs in one transaction: it validates
// first (a bad payload throws and never touches the doc), clears the doc, then
// re-adds every entity through the sanctioned `doc.ts` mutators.

import type * as Y from 'yjs'
import {
  addAccommodation,
  addCard,
  addCity,
  clearTrip,
  setDayCityOverride,
  setTrip,
} from './doc'
import { tripDocumentSchema, type TripDocument } from './tripSchema'

/**
 * Transaction origin for a full-replace apply. Tagged so the `Y.UndoManager`
 * can exclude it — an agent write / JSON paste / version restore replaces the
 * whole doc and shouldn't be chunked into the keystroke undo stack.
 */
export const APPLY_TRIP_ORIGIN = 'apply-trip'

/**
 * Validate `input` against the schema and overwrite the doc with it. Throws a
 * `ZodError` on invalid input before mutating anything. Returns the validated
 * document for callers that want the canonical (default-filled) form.
 */
export function applyTrip(doc: Y.Doc, input: unknown): TripDocument {
  const data = tripDocumentSchema.parse(input)

  doc.transact(() => {
    clearTrip(doc)
    setTrip(doc, data.trip)
    for (const city of data.cities) addCity(doc, city)
    for (const acc of data.accommodations) addAccommodation(doc, acc)
    for (const card of data.cards) addCard(doc, card)
    for (const [dayKey, cityId] of Object.entries(data.dayOverrides)) {
      setDayCityOverride(doc, dayKey, cityId)
    }
  }, APPLY_TRIP_ORIGIN)

  return data
}

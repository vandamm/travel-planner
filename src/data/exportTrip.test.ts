import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { applyTrip } from './applyTrip'
import {
  addAccommodation,
  addCard,
  addCity,
  setDayCityOverride,
  setTrip,
} from './doc'
import { exportTrip, exportTripJSON } from './exportTrip'
import { tripDocumentSchema } from './tripSchema'

function seed(doc: Y.Doc) {
  setTrip(doc, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 })
  addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
  addAccommodation(doc, {
    id: 'stay-1',
    label: 'Hotel Roma',
    cityId: 'rome',
    startNight: '2027-05-01',
    endNight: '2027-05-02',
  })
  addCard(doc, { id: 'card-2', dayKey: '2027-05-01', title: 'Train', order: 1, startTime: '18:30' })
  addCard(doc, { id: 'card-1', dayKey: '2027-05-01', title: 'Colosseum', order: 0 })
  setDayCityOverride(doc, '2027-05-03', 'rome')
}

describe('exportTrip', () => {
  it('serializes a doc to a schema-valid trip document', () => {
    const doc = new Y.Doc()
    seed(doc)
    const out = exportTrip(doc)
    expect(() => tripDocumentSchema.parse(out)).not.toThrow()
    expect(out.trip).toEqual({ title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 })
    expect(out.cities).toEqual([{ id: 'rome', name: 'Rome', color: '#ef4444' }])
  })

  it('emits cards in a deterministic order (by day then order)', () => {
    const doc = new Y.Doc()
    seed(doc)
    expect(exportTrip(doc).cards.map((c) => c.id)).toEqual(['card-1', 'card-2'])
  })

  it('exports a fresh, never-set-up doc as a valid empty document', () => {
    const out = exportTrip(new Y.Doc())
    expect(out).toEqual({
      trip: { title: '', startDate: '', numDays: 0 },
      cities: [],
      accommodations: [],
      cards: [],
      dayOverrides: {},
    })
  })

  it('exportTripJSON produces pretty, parseable JSON', () => {
    const doc = new Y.Doc()
    seed(doc)
    const text = exportTripJSON(doc)
    expect(text).toContain('\n')
    expect(JSON.parse(text)).toEqual(exportTrip(doc))
  })
})

describe('export → import round-trip', () => {
  it('preserves every entity through export then apply into a fresh doc', () => {
    const source = new Y.Doc()
    seed(source)
    const exported = exportTrip(source)

    const target = new Y.Doc()
    applyTrip(target, exported)

    expect(exportTrip(target)).toEqual(exported)
  })
})

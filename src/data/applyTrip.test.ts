import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { APPLY_TRIP_ORIGIN, applyTrip } from './applyTrip'
import {
  addCard,
  addCity,
  getTrip,
  listAccommodations,
  listCards,
  listCities,
  listDayOverrides,
} from './doc'

const TRIP = {
  trip: { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03', dayStart: '06:00', dayEnd: '21:00' },
  cities: [{ id: 'rome', name: 'Rome', color: '#ef4444' }],
  accommodations: [
    { id: 'stay-1', label: 'Hotel Roma', cityId: 'rome', startNight: '2027-05-01', endNight: '2027-05-02' },
  ],
  cards: [
    { id: 'card-1', dayKey: '2027-05-01', title: 'Colosseum', order: 0 },
    { id: 'card-2', dayKey: '2027-05-01', title: 'Train', order: 1, startTime: '18:30' },
  ],
  dayOverrides: { '2027-05-03': 'rome' },
}

describe('applyTrip', () => {
  it('mutates an empty doc to exactly the supplied trip', () => {
    const doc = new Y.Doc()
    applyTrip(doc, TRIP)

    expect(getTrip(doc)).toEqual(TRIP.trip)
    expect(listCities(doc)).toEqual(TRIP.cities)
    expect(listAccommodations(doc)).toEqual(TRIP.accommodations)
    expect(listCards(doc)).toEqual(TRIP.cards)
    expect(listDayOverrides(doc)).toEqual(TRIP.dayOverrides)
  })

  it('preserves explicit card order and timed fields', () => {
    const doc = new Y.Doc()
    applyTrip(doc, TRIP)
    const card2 = listCards(doc).find((c) => c.id === 'card-2')
    expect(card2).toMatchObject({ order: 1, startTime: '18:30' })
  })

  it('fully replaces any pre-existing data (not a merge)', () => {
    const doc = new Y.Doc()
    addCity(doc, { id: 'stale', name: 'Stale', color: '#000000' })
    addCard(doc, { id: 'stale-card', dayKey: '2020-01-01', title: 'Old' })

    applyTrip(doc, TRIP)

    expect(listCities(doc).map((c) => c.id)).toEqual(['rome'])
    expect(listCards(doc).map((c) => c.id)).toEqual(['card-1', 'card-2'])
  })

  it('round-trips a card category through the mutators', () => {
    const doc = new Y.Doc()
    applyTrip(doc, {
      ...TRIP,
      cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'Museum', order: 0, category: 'indoor' }],
    })
    expect(listCards(doc)[0]).toMatchObject({ category: 'indoor' })
  })

  it('throws on invalid input rather than corrupting the doc', () => {
    const doc = new Y.Doc()
    expect(() => applyTrip(doc, { trip: { title: 'X', startDate: 'bad', endDate: '2027-05-01' } })).toThrow()
  })

  it('leaves an existing doc untouched when the input is invalid', () => {
    const doc = new Y.Doc()
    applyTrip(doc, TRIP)
    expect(() => applyTrip(doc, { trip: { title: 'X', startDate: 'bad', endDate: '2027-05-01' } })).toThrow()
    // Validation fails before the transaction, so the prior trip survives intact.
    expect(getTrip(doc)).toEqual(TRIP.trip)
    expect(listCities(doc)).toEqual(TRIP.cities)
    expect(listCards(doc)).toEqual(TRIP.cards)
  })

  it('runs its transaction under APPLY_TRIP_ORIGIN (so UndoManager can exclude it)', () => {
    const doc = new Y.Doc()
    let seenOrigin: unknown = 'unset'
    doc.on('afterTransaction', (tr: Y.Transaction) => {
      seenOrigin = tr.origin
    })
    applyTrip(doc, TRIP)
    expect(seenOrigin).toBe(APPLY_TRIP_ORIGIN)
  })
})

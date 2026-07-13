import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { applyTrip } from './applyTrip'
import {
  addAccommodation,
  addCard,
  addCity,
  removeCity,
  setDayCityOverride,
  setTrip,
} from './doc'
import { exportTrip, exportTripJSON } from './exportTrip'
import { tripDocumentSchema } from './tripSchema'

function seed(doc: Y.Doc) {
  setTrip(doc, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })
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

function sync(from: Y.Doc, to: Y.Doc) {
  Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)))
}

function docWithMergedCityRemoval(setDanglingRef: (doc: Y.Doc) => void) {
  const removeDoc = new Y.Doc()
  const addRefDoc = new Y.Doc()
  setTrip(removeDoc, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })
  addCity(removeDoc, { id: 'rome', name: 'Rome', color: '#ef4444' })
  sync(removeDoc, addRefDoc)

  removeCity(removeDoc, 'rome')
  setDanglingRef(addRefDoc)
  sync(removeDoc, addRefDoc)
  sync(addRefDoc, removeDoc)

  return removeDoc
}

describe('exportTrip', () => {
  it('serializes a doc to a schema-valid trip document', () => {
    const doc = new Y.Doc()
    seed(doc)
    const out = exportTrip(doc)
    expect(() => tripDocumentSchema.parse(out)).not.toThrow()
    expect(out.trip).toEqual({
      title: 'Italy 2027',
      startDate: '2027-05-01',
      endDate: '2027-05-03',
      dayStart: '06:00',
      dayEnd: '21:00',
    })
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
      trip: { title: '', startDate: '', endDate: '', dayStart: '06:00', dayEnd: '21:00' },
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

  it('drops a dangling accommodation cityId after a concurrent remove-city merge', () => {
    const doc = docWithMergedCityRemoval((d) => {
      addAccommodation(d, {
        id: 'stay-1',
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-02',
      })
    })

    expect(exportTrip(doc).accommodations).toEqual([
      {
        id: 'stay-1',
        label: 'Hotel Roma',
        startNight: '2027-05-01',
        endNight: '2027-05-02',
      },
    ])
  })

  it('drops a dangling day override after a concurrent remove-city merge', () => {
    const doc = docWithMergedCityRemoval((d) => setDayCityOverride(d, '2027-05-02', 'rome'))

    expect(exportTrip(doc).dayOverrides).toEqual({})
  })

  it('leaves valid city references untouched', () => {
    const doc = new Y.Doc()
    seed(doc)

    expect(exportTrip(doc)).toMatchObject({
      accommodations: [
        {
          id: 'stay-1',
          label: 'Hotel Roma',
          cityId: 'rome',
          startNight: '2027-05-01',
          endNight: '2027-05-02',
        },
      ],
      dayOverrides: { '2027-05-03': 'rome' },
    })
  })

  it('prunes only dangling city references when valid refs are mixed in the same export', () => {
    const removeDoc = new Y.Doc()
    const addRefDoc = new Y.Doc()
    setTrip(removeDoc, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })
    addCity(removeDoc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    addCity(removeDoc, { id: 'paris', name: 'Paris', color: '#2563eb' })
    sync(removeDoc, addRefDoc)

    removeCity(removeDoc, 'rome')
    addAccommodation(addRefDoc, {
      id: 'stay-paris',
      label: 'Hotel Paris',
      cityId: 'paris',
      startNight: '2027-05-01',
      endNight: '2027-05-01',
    })
    addAccommodation(addRefDoc, {
      id: 'stay-rome',
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-02',
      endNight: '2027-05-02',
    })
    setDayCityOverride(addRefDoc, '2027-05-01', 'paris')
    setDayCityOverride(addRefDoc, '2027-05-02', 'rome')
    sync(removeDoc, addRefDoc)
    sync(addRefDoc, removeDoc)

    expect(exportTrip(removeDoc)).toMatchObject({
      cities: [{ id: 'paris', name: 'Paris', color: '#2563eb' }],
      accommodations: [
        {
          id: 'stay-paris',
          label: 'Hotel Paris',
          cityId: 'paris',
          startNight: '2027-05-01',
          endNight: '2027-05-01',
        },
        {
          id: 'stay-rome',
          label: 'Hotel Roma',
          startNight: '2027-05-02',
          endNight: '2027-05-02',
        },
      ],
      dayOverrides: { '2027-05-01': 'paris' },
    })
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

  it('round-trips a custom day window and a transport card', () => {
    const source = new Y.Doc()
    setTrip(source, { title: 'T', startDate: '2027-05-01', endDate: '2027-05-01', dayStart: '08:00', dayEnd: '23:00' })
    addCard(source, { id: 'flight', dayKey: '2027-05-01', title: 'Flight', order: 0, transport: true })
    const exported = exportTrip(source)
    expect(exported.trip).toMatchObject({ dayStart: '08:00', dayEnd: '23:00' })
    expect(exported.cards[0].transport).toBe(true)

    const target = new Y.Doc()
    applyTrip(target, exported)
    expect(exportTrip(target)).toEqual(exported)
  })

  it('round-trips a card category', () => {
    const source = new Y.Doc()
    setTrip(source, { title: 'T', startDate: '2027-05-01', endDate: '2027-05-01' })
    addCard(source, { id: 'museum', dayKey: '2027-05-01', title: 'Museum', order: 0, category: 'indoor' })
    const exported = exportTrip(source)
    expect(exported.cards[0].category).toBe('indoor')

    const target = new Y.Doc()
    applyTrip(target, exported)
    expect(exportTrip(target)).toEqual(exported)
  })

  it('round-trips a card duration', () => {
    const source = new Y.Doc()
    setTrip(source, { title: 'T', startDate: '2027-05-01', endDate: '2027-05-01' })
    addCard(source, { id: 'tall', dayKey: '2027-05-01', title: 'All day', order: 0, duration: 'day' })
    const exported = exportTrip(source)
    expect(exported.cards[0].duration).toBe('day')

    const target = new Y.Doc()
    applyTrip(target, exported)
    expect(exportTrip(target)).toEqual(exported)
  })

  it('round-trips a pruned export', () => {
    const source = docWithMergedCityRemoval((d) => {
      addAccommodation(d, {
        id: 'stay-1',
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-02',
      })
      setDayCityOverride(d, '2027-05-02', 'rome')
    })
    const exported = exportTrip(source)

    const target = new Y.Doc()
    applyTrip(target, exported)
    expect(exportTrip(target)).toEqual(exported)
  })
})

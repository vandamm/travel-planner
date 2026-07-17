import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  addAccommodation,
  addCard,
  addCity,
  getAccommodation,
  getCard,
  getDayOverride,
  getTrip,
  listAccommodations,
  listCards,
  listCardsForDay,
  listCities,
  listDayOverrides,
  moveCard,
  removeAccommodation,
  removeCard,
  removeCity,
  reorderCards,
  setDayCityOverride,
  setTrip,
  swapActivityDays,
  updateAccommodation,
  updateCard,
  updateCity,
} from './doc'
import { resolveDayCity } from './cityResolution'

function freshDoc() {
  return new Y.Doc()
}

describe('trip settings', () => {
  it('returns empty defaults for a brand-new doc', () => {
    expect(getTrip(freshDoc())).toEqual({
      title: '',
      startDate: '',
      endDate: '',
      dayStart: '06:00',
      dayEnd: '21:00',
    })
  })

  it('sets and reads back trip fields, merging partial updates', () => {
    const doc = freshDoc()
    setTrip(doc, { title: 'Italy', startDate: '2027-05-01', endDate: '2027-05-14' })
    expect(getTrip(doc)).toEqual({
      title: 'Italy',
      startDate: '2027-05-01',
      endDate: '2027-05-14',
      dayStart: '06:00',
      dayEnd: '21:00',
    })

    setTrip(doc, { endDate: '2027-05-21' })
    expect(getTrip(doc)).toMatchObject({ title: 'Italy', startDate: '2027-05-01', endDate: '2027-05-21' })
  })

  it('sets and reads back a custom day window', () => {
    const doc = freshDoc()
    setTrip(doc, { dayStart: '08:00', dayEnd: '23:00' })
    expect(getTrip(doc)).toMatchObject({ dayStart: '08:00', dayEnd: '23:00' })
  })

  it('rejects a reversed date range so the doc remains exportable', () => {
    const doc = freshDoc()
    setTrip(doc, { startDate: '2027-05-01', endDate: '2027-05-03' })

    setTrip(doc, { endDate: '2027-04-30' })
    expect(getTrip(doc)).toMatchObject({ startDate: '2027-05-01', endDate: '2027-05-03' })

    setTrip(doc, { startDate: '2027-05-04' })
    expect(getTrip(doc)).toMatchObject({ startDate: '2027-05-01', endDate: '2027-05-03' })
  })

  it('rejects an inverted day window so the doc never holds one exportTrip would throw on', () => {
    const doc = freshDoc()
    setTrip(doc, { dayStart: '08:00', dayEnd: '20:00' })

    // A single-field edit that would invert (or empty) the window is dropped;
    // the valid window stays so a later export can't fail the schema refine.
    setTrip(doc, { dayEnd: '07:00' })
    expect(getTrip(doc)).toMatchObject({ dayStart: '08:00', dayEnd: '20:00' })
    setTrip(doc, { dayStart: '21:00' })
    expect(getTrip(doc)).toMatchObject({ dayStart: '08:00', dayEnd: '20:00' })
    setTrip(doc, { dayStart: '20:00' }) // equal to dayEnd = empty window
    expect(getTrip(doc)).toMatchObject({ dayStart: '08:00', dayEnd: '20:00' })

    // A valid move of the whole window in one patch still applies.
    setTrip(doc, { dayStart: '09:00', dayEnd: '10:00' })
    expect(getTrip(doc)).toMatchObject({ dayStart: '09:00', dayEnd: '10:00' })
  })
})

describe('cities', () => {
  it('adds a city with a generated id and lists it', () => {
    const doc = freshDoc()
    const city = addCity(doc, { name: 'Rome', color: '#ef4444' })
    expect(city.id).toBeTruthy()
    expect(listCities(doc)).toEqual([{ id: city.id, name: 'Rome', color: '#ef4444' }])
  })

  it('honours a caller-provided id and updates fields in place', () => {
    const doc = freshDoc()
    addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    updateCity(doc, 'rome', { color: '#3b82f6' })
    expect(listCities(doc)).toEqual([{ id: 'rome', name: 'Rome', color: '#3b82f6' }])
  })

  it('removes a city and ignores updates to a missing city', () => {
    const doc = freshDoc()
    addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    removeCity(doc, 'rome')
    expect(listCities(doc)).toHaveLength(0)
    expect(() => updateCity(doc, 'rome', { name: 'Roma' })).not.toThrow()
  })

  it('prunes dangling references when a city is removed', () => {
    const doc = freshDoc()
    addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    setDayCityOverride(doc, '2027-05-03', 'rome')
    const stay = addAccommodation(doc, {
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-01',
      endNight: '2027-05-04',
    })
    // A second day/stay pointing elsewhere must survive the cascade untouched.
    setDayCityOverride(doc, '2027-05-10', 'venice')

    removeCity(doc, 'rome')

    // The override and accommodation cityId that referenced the removed city are
    // gone, so no orphan reference persists or round-trips through export.
    expect(getDayOverride(doc, '2027-05-03')).toBeUndefined()
    expect(getAccommodation(doc, stay.id)?.cityId).toBeUndefined()
    // Unrelated references are left intact.
    expect(getDayOverride(doc, '2027-05-10')).toBe('venice')
  })
})

describe('cards', () => {
  it('appends cards within a day with increasing order', () => {
    const doc = freshDoc()
    const a = addCard(doc, { dayKey: '2027-05-01', title: 'Colosseum' })
    const b = addCard(doc, { dayKey: '2027-05-01', title: 'Forum' })
    expect(a.order).toBe(0)
    expect(b.order).toBe(1)
    expect(listCardsForDay(doc, '2027-05-01').map((c) => c.title)).toEqual([
      'Colosseum',
      'Forum',
    ])
  })

  it('preserves valid quarter-hour custom durations and normalizes invalid values', () => {
    const doc = freshDoc()
    const added = addCard(doc, { dayKey: '2027-05-01', title: 'A', duration: 'custom', durationHours: 0.25 })
    expect(added).toMatchObject({ duration: 'custom', durationHours: 0.25 })

    const invalid = addCard(doc, { dayKey: '2027-05-01', title: 'Invalid', duration: 'custom', durationHours: 0.3 })
    expect(invalid).toMatchObject({ duration: 'custom', durationHours: 1 })

    const tooShort = addCard(doc, { dayKey: '2027-05-01', title: 'Too short', duration: 'custom', durationHours: 0.2 })
    expect(tooShort).toMatchObject({ duration: 'custom', durationHours: 1 })

    updateCard(doc, added.id, { duration: 'custom', durationHours: 0.75 })
    expect(getCard(doc, added.id)).toMatchObject({ duration: 'custom', durationHours: 0.75 })

    updateCard(doc, added.id, { duration: 'custom', durationHours: 0.3 })
    expect(getCard(doc, added.id)).toMatchObject({ duration: 'custom', durationHours: 1 })

    const defaulted = addCard(doc, { dayKey: '2027-05-01', title: 'Default', duration: 'custom', durationHours: undefined })
    expect(defaulted).toMatchObject({ duration: 'custom', durationHours: 1 })

    const day = addCard(doc, { dayKey: '2027-05-01', title: 'B', duration: 'day' })
    updateCard(doc, day.id, { duration: 'custom', durationHours: undefined })
    expect(getCard(doc, day.id)).toMatchObject({ duration: 'custom', durationHours: 1 })
  })

  it('does not normalize a legacy custom duration during an unrelated update', () => {
    const doc = freshDoc()
    const legacy = addCard(doc, { dayKey: '2027-05-01', title: 'Legacy', duration: 'custom' })
    doc.getMap('cards').get(legacy.id)?.set('durationHours', 1.1)

    updateCard(doc, legacy.id, { title: 'Renamed legacy card' })

    expect(getCard(doc, legacy.id)).toMatchObject({
      title: 'Renamed legacy card',
      duration: 'custom',
      durationHours: 1.1,
    })
  })

  it('keeps cards on different days independent', () => {
    const doc = freshDoc()
    addCard(doc, { dayKey: '2027-05-01', title: 'Day1-A' })
    const d2 = addCard(doc, { dayKey: '2027-05-02', title: 'Day2-A' })
    expect(d2.order).toBe(0)
    expect(listCardsForDay(doc, '2027-05-02').map((c) => c.title)).toEqual(['Day2-A'])
  })

  it('updates a card and can clear an optional field', () => {
    const doc = freshDoc()
    const card = addCard(doc, { dayKey: '2027-05-01', title: 'Train', startTime: '09:00' })
    updateCard(doc, card.id, { title: 'Fast train', note: 'platform 4' })
    updateCard(doc, card.id, { startTime: undefined })
    const stored = listCards(doc).find((c) => c.id === card.id)
    expect(stored).toMatchObject({ title: 'Fast train', note: 'platform 4' })
    expect(stored?.startTime).toBeUndefined()
  })

  it('moves a card to another day and appends it at the end', () => {
    const doc = freshDoc()
    addCard(doc, { dayKey: '2027-05-02', title: 'existing' })
    const card = addCard(doc, { dayKey: '2027-05-01', title: 'moving' })
    moveCard(doc, card.id, '2027-05-02')
    const moved = listCards(doc).find((c) => c.id === card.id)
    expect(moved?.dayKey).toBe('2027-05-02')
    expect(moved?.order).toBe(1)
    expect(listCardsForDay(doc, '2027-05-01')).toHaveLength(0)
  })

  it('reorders untimed cards by an explicit id sequence', () => {
    const doc = freshDoc()
    const a = addCard(doc, { dayKey: '2027-05-01', title: 'A' })
    const b = addCard(doc, { dayKey: '2027-05-01', title: 'B' })
    const c = addCard(doc, { dayKey: '2027-05-01', title: 'C' })
    reorderCards(doc, '2027-05-01', [c.id, a.id, b.id])
    expect(listCardsForDay(doc, '2027-05-01').map((card) => card.title)).toEqual(['C', 'A', 'B'])
  })

  it('removes a card', () => {
    const doc = freshDoc()
    const card = addCard(doc, { dayKey: '2027-05-01', title: 'gone' })
    removeCard(doc, card.id)
    expect(listCards(doc)).toHaveLength(0)
  })

  it('stores the transport flag and can clear it', () => {
    const doc = freshDoc()
    const card = addCard(doc, { dayKey: '2027-05-01', title: 'Train', transport: true })
    expect(getCard(doc, card.id)?.transport).toBe(true)
    updateCard(doc, card.id, { transport: undefined })
    expect(getCard(doc, card.id)?.transport).toBeUndefined()
  })

  it('stores the category and can clear it', () => {
    const doc = freshDoc()
    const card = addCard(doc, { dayKey: '2027-05-01', title: 'Museum', category: 'indoor' })
    expect(getCard(doc, card.id)?.category).toBe('indoor')
    updateCard(doc, card.id, { category: 'outdoor' })
    expect(getCard(doc, card.id)?.category).toBe('outdoor')
    updateCard(doc, card.id, { category: undefined })
    expect(getCard(doc, card.id)?.category).toBeUndefined()
  })

  it('reads a single card by id', () => {
    const doc = freshDoc()
    const card = addCard(doc, { dayKey: '2027-05-01', title: 'lookup' })
    expect(getCard(doc, card.id)?.title).toBe('lookup')
    expect(getCard(doc, 'missing')).toBeUndefined()
  })

  it('ignores mutations targeting a missing card', () => {
    const doc = freshDoc()
    expect(() => updateCard(doc, 'nope', { title: 'x' })).not.toThrow()
    expect(() => moveCard(doc, 'nope', '2027-05-02')).not.toThrow()
    expect(listCards(doc)).toHaveLength(0)
  })
})

describe('day city overrides', () => {
  it('distinguishes a pinned city, explicit no-city, and Auto', () => {
    const doc = freshDoc()
    setDayCityOverride(doc, '2027-05-03', 'venice')
    expect(getDayOverride(doc, '2027-05-03')).toBe('venice')
    expect(listDayOverrides(doc)).toEqual({ '2027-05-03': 'venice' })

    setDayCityOverride(doc, '2027-05-03', null)
    expect(getDayOverride(doc, '2027-05-03')).toBeNull()
    expect(listDayOverrides(doc)).toEqual({ '2027-05-03': null })

    setDayCityOverride(doc, '2027-05-03', undefined)
    expect(getDayOverride(doc, '2027-05-03')).toBeUndefined()
    expect(listDayOverrides(doc)).toEqual({})
  })
})

describe('activity day swaps', () => {
  it('atomically exchanges cards and displayed cities without changing card details or stays', () => {
    const doc = freshDoc()
    addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    addCity(doc, { id: 'florence', name: 'Florence', color: '#3b82f6' })
    addAccommodation(doc, {
      id: 'rome-stay',
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-01',
      endNight: '2027-05-01',
    })
    addAccommodation(doc, {
      id: 'florence-stay',
      label: 'Hotel Firenze',
      cityId: 'florence',
      startNight: '2027-05-02',
      endNight: '2027-05-02',
    })
    addCard(doc, {
      id: 'museum',
      dayKey: '2027-05-01',
      title: 'Museum',
      startTime: '09:15',
      duration: 'custom',
      durationHours: 1.5,
      order: 7,
    })
    addCard(doc, {
      id: 'dinner',
      dayKey: '2027-05-01',
      title: 'Dinner',
      startTime: '19:00',
      duration: 'half',
      order: 2,
    })
    addCard(doc, {
      id: 'garden',
      dayKey: '2027-05-02',
      title: 'Garden',
      duration: 'day',
      order: 4,
    })

    const beforeCards = new Map(listCards(doc).map((card) => [card.id, card]))
    const accommodationsBefore = JSON.stringify(listAccommodations(doc))
    const beforeOverrides = listDayOverrides(doc)
    const beforeFirstCity = resolveDayCity(
      '2027-05-01',
      listAccommodations(doc),
      beforeOverrides,
    )
    const beforeSecondCity = resolveDayCity(
      '2027-05-02',
      listAccommodations(doc),
      beforeOverrides,
    )
    let updates = 0
    doc.on('update', () => {
      updates += 1
    })

    swapActivityDays(doc, '2027-05-01', '2027-05-02')

    expect(updates).toBe(1)
    for (const card of listCards(doc)) {
      const before = beforeCards.get(card.id)!
      expect(card.dayKey).toBe(
        before.dayKey === '2027-05-01' ? '2027-05-02' : '2027-05-01',
      )
      const { dayKey: _beforeDay, ...beforeDetails } = before
      const { dayKey: _afterDay, ...afterDetails } = card
      expect(afterDetails).toEqual(beforeDetails)
    }
    const afterOverrides = listDayOverrides(doc)
    expect(resolveDayCity('2027-05-01', listAccommodations(doc), afterOverrides)).toBe(
      beforeSecondCity,
    )
    expect(resolveDayCity('2027-05-02', listAccommodations(doc), afterOverrides)).toBe(
      beforeFirstCity,
    )
    expect(JSON.stringify(listAccommodations(doc))).toBe(accommodationsBefore)
  })

  it('keeps a cityless day cityless after it moves onto a covered date', () => {
    const doc = freshDoc()
    addCity(doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    addAccommodation(doc, {
      id: 'rome-stay',
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-02',
      endNight: '2027-05-02',
    })

    swapActivityDays(doc, '2027-05-01', '2027-05-02')

    expect(listDayOverrides(doc)).toEqual({
      '2027-05-01': 'rome',
      '2027-05-02': null,
    })
    expect(
      resolveDayCity('2027-05-02', listAccommodations(doc), listDayOverrides(doc)),
    ).toBeUndefined()
  })
})

describe('accommodations', () => {
  it('adds an accommodation spanning nights and lists it', () => {
    const doc = freshDoc()
    const acc = addAccommodation(doc, {
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-01',
      endNight: '2027-05-04',
    })
    expect(acc.id).toBeTruthy()
    expect(listAccommodations(doc)).toEqual([
      {
        id: acc.id,
        label: 'Hotel Roma',
        cityId: 'rome',
        startNight: '2027-05-01',
        endNight: '2027-05-04',
      },
    ])
  })

  it('reads, updates, and removes an accommodation', () => {
    const doc = freshDoc()
    const acc = addAccommodation(doc, {
      label: 'B&B',
      startNight: '2027-05-05',
      endNight: '2027-05-06',
    })
    expect(getAccommodation(doc, acc.id)?.label).toBe('B&B')

    updateAccommodation(doc, acc.id, { label: 'B&B Verona', cityId: 'verona' })
    expect(getAccommodation(doc, acc.id)).toMatchObject({ label: 'B&B Verona', cityId: 'verona' })

    removeAccommodation(doc, acc.id)
    expect(listAccommodations(doc)).toHaveLength(0)
    expect(getAccommodation(doc, acc.id)).toBeUndefined()
  })
})

describe('two-doc CRDT sync', () => {
  function sync(from: Y.Doc, to: Y.Doc) {
    Y.applyUpdate(to, Y.encodeStateAsUpdate(from, Y.encodeStateVector(to)))
  }

  it('merges a card added on one doc into the other', () => {
    const a = freshDoc()
    const b = freshDoc()
    addCard(a, { dayKey: '2027-05-01', title: 'Synced card' })
    sync(a, b)
    expect(listCards(b).map((c) => c.title)).toEqual(['Synced card'])
  })

  it('merges concurrent field edits on the same city without losing either', () => {
    const a = freshDoc()
    const b = freshDoc()
    addCity(a, { id: 'rome', name: 'Rome', color: '#ef4444' })
    sync(a, b)

    // Concurrent edits to different fields of the same nested entity.
    updateCity(a, 'rome', { name: 'Roma' })
    updateCity(b, 'rome', { color: '#3b82f6' })

    // Exchange updates both directions; both should converge with both edits.
    sync(a, b)
    sync(b, a)

    const fromA = listCities(a)[0]
    const fromB = listCities(b)[0]
    expect(fromA).toEqual(fromB)
    expect(fromA).toEqual({ id: 'rome', name: 'Roma', color: '#3b82f6' })
  })
})

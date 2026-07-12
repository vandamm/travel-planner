import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { applyTrip } from '../../data/applyTrip'
import { addCard, getCard, listCards, updateCard } from '../../data/doc'
import { createTripUndoManager } from './undoManager'

const TRIP = {
  trip: { title: 'Italy', startDate: '2027-05-01', endDate: '2027-05-03', dayStart: '06:00', dayEnd: '21:00' },
  cities: [],
  accommodations: [],
  cards: [{ id: 'applied', dayKey: '2027-05-01', title: 'Museum', order: 0 }],
  dayOverrides: {},
}

describe('createTripUndoManager', () => {
  it('undoes and redoes a local card creation', () => {
    const doc = new Y.Doc()
    const um = createTripUndoManager(doc)

    addCard(doc, { id: 'c1', dayKey: '2027-05-01', title: 'Colosseum' })
    expect(listCards(doc)).toHaveLength(1)
    expect(um.canUndo()).toBe(true)

    um.undo()
    expect(listCards(doc)).toHaveLength(0)
    expect(um.canUndo()).toBe(false)
    expect(um.canRedo()).toBe(true)

    um.redo()
    expect(listCards(doc).map((c) => c.id)).toEqual(['c1'])
  })

  it('undoes a field update, restoring the prior value', () => {
    const doc = new Y.Doc()
    addCard(doc, { id: 'c1', dayKey: '2027-05-01', title: 'Old' })
    // Created after the seed, so only the update is on the stack.
    const um = createTripUndoManager(doc)

    updateCard(doc, 'c1', { title: 'New' })
    expect(getCard(doc, 'c1')?.title).toBe('New')

    um.undo()
    expect(getCard(doc, 'c1')?.title).toBe('Old')
  })

  it('does not put a full-replace apply on the stack (APPLY_TRIP_ORIGIN)', () => {
    const doc = new Y.Doc()
    const um = createTripUndoManager(doc)

    applyTrip(doc, TRIP)

    expect(listCards(doc)).toHaveLength(1)
    // The replace ran under APPLY_TRIP_ORIGIN, outside trackedOrigins ({null}).
    expect(um.canUndo()).toBe(false)
  })

  it('undoes only the hand edit, leaving an untracked apply intact', () => {
    const doc = new Y.Doc()
    const um = createTripUndoManager(doc)
    applyTrip(doc, TRIP)
    addCard(doc, { id: 'hand', dayKey: '2027-05-01', title: 'Hand added' })

    um.undo()
    // The hand edit pops; the applied card stays.
    expect(getCard(doc, 'hand')).toBeUndefined()
    expect(listCards(doc).map((c) => c.id)).toEqual(['applied'])
    expect(um.canUndo()).toBe(false)
  })
})

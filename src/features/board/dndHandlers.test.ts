import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addCard, getCard, listCardsForDay } from '../../data/doc'
import {
  applyCardDragEnd,
  dayDroppableId,
  dayKeyFromDroppableId,
  isDayDroppableId,
} from './dndHandlers'

const DAY1 = '2027-05-01'
const DAY2 = '2027-05-02'

function freshDoc() {
  return new Y.Doc()
}

/** Seed a day with untimed cards in the given title order; returns id-by-title. */
function seedDay(doc: Y.Doc, dayKey: string, cardTitles: string[]) {
  const ids: Record<string, string> = {}
  for (const title of cardTitles) ids[title] = addCard(doc, { dayKey, title }).id
  return ids
}

function titles(doc: Y.Doc, dayKey: string) {
  return listCardsForDay(doc, dayKey).map((c) => c.title)
}

describe('day droppable ids', () => {
  it('round-trips a day key through a droppable id', () => {
    const id = dayDroppableId(DAY1)
    expect(isDayDroppableId(id)).toBe(true)
    expect(dayKeyFromDroppableId(id)).toBe(DAY1)
  })

  it('does not mistake a card id for a day droppable id', () => {
    expect(isDayDroppableId('some-card-uuid')).toBe(false)
  })
})

describe('applyCardDragEnd — reorder within a day', () => {
  it('moves a card to the slot of the card it is dropped on', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A', 'B', 'C'])
    applyCardDragEnd(doc, { activeId: id.C, overId: id.A })
    expect(titles(doc, DAY1)).toEqual(['C', 'A', 'B'])
  })

  it('appends to the end when dropped on the column body', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A', 'B', 'C'])
    applyCardDragEnd(doc, { activeId: id.A, overId: dayDroppableId(DAY1) })
    expect(titles(doc, DAY1)).toEqual(['B', 'C', 'A'])
  })

  it('reorders in the viewer direction (up reverses the visible order)', () => {
    const doc = freshDoc()
    // Canonical order A, B, C; with the 'up' direction the user sees C, B, A.
    const id = seedDay(doc, DAY1, ['A', 'B', 'C'])
    applyCardDragEnd(doc, { activeId: id.A, overId: id.C }, 'up')
    expect(titles(doc, DAY1)).toEqual(['B', 'C', 'A'])
  })
})

describe('applyCardDragEnd — move across days', () => {
  it('moves a card onto a card in another day, updating dayKey and order', () => {
    const doc = freshDoc()
    const d1 = seedDay(doc, DAY1, ['X'])
    const d2 = seedDay(doc, DAY2, ['Y', 'Z'])
    applyCardDragEnd(doc, { activeId: d1.X, overId: d2.Z })
    expect(titles(doc, DAY1)).toEqual([])
    expect(titles(doc, DAY2)).toEqual(['Y', 'X', 'Z'])
    expect(getCard(doc, d1.X)?.dayKey).toBe(DAY2)
    expect(getCard(doc, d1.X)?.order).toBe(1)
  })

  it('moves a card onto an empty column via its droppable id', () => {
    const doc = freshDoc()
    const d1 = seedDay(doc, DAY1, ['X'])
    applyCardDragEnd(doc, { activeId: d1.X, overId: dayDroppableId(DAY2) })
    expect(titles(doc, DAY1)).toEqual([])
    expect(titles(doc, DAY2)).toEqual(['X'])
    expect(getCard(doc, d1.X)?.dayKey).toBe(DAY2)
  })
})

describe('applyCardDragEnd — no-ops', () => {
  it('does nothing without an over target', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A', 'B'])
    applyCardDragEnd(doc, { activeId: id.A, overId: null })
    expect(titles(doc, DAY1)).toEqual(['A', 'B'])
  })

  it('does nothing when dropped on itself', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A', 'B'])
    applyCardDragEnd(doc, { activeId: id.A, overId: id.A })
    expect(titles(doc, DAY1)).toEqual(['A', 'B'])
  })

  it('ignores a drag whose active card no longer exists', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A'])
    expect(() => applyCardDragEnd(doc, { activeId: 'missing', overId: id.A })).not.toThrow()
    expect(titles(doc, DAY1)).toEqual(['A'])
  })

  it('writes nothing when a card is dropped back into its own position', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A', 'B', 'C'])
    let updates = 0
    doc.on('update', () => (updates += 1))
    applyCardDragEnd(doc, { activeId: id.A, overId: id.B })
    expect(updates).toBe(0)
    expect(titles(doc, DAY1)).toEqual(['A', 'B', 'C'])
  })
})

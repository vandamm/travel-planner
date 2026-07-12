import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import type { Card } from '../../data/schema'
import { addCard, getCard, listCardsForDay } from '../../data/doc'
import {
  applyCardDragEnd,
  dayDroppableId,
  dayKeyFromDroppableId,
  deriveDropTime,
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

describe('deriveDropTime', () => {
  // Canonical (morning→evening) neighbour lists; insertIndex is where the
  // dragged untimed card lands among them.
  const timed = (startTime: string, durationHours = 1): Card => ({ id: startTime, dayKey: DAY1, title: startTime, order: 0, startTime, duration: 'custom', durationHours })
  const untimed = (id: string): Card => ({ id, dayKey: DAY1, title: id, order: 0, duration: 'custom', durationHours: 1 })

  it('midpoints between the timed cards above and below the drop', () => {
    expect(deriveDropTime([timed('12:00'), timed('18:00')], 1, '06:00', '21:00')).toBe('15:30')
  })

  it('leaves a card untimed when the slot cannot fit its duration', () => {
    expect(deriveDropTime([timed('10:00'), timed('11:10')], 1, '06:00', '21:00')).toBeUndefined()
  })

  it('drops after the last timed card → a later time', () => {
    expect(deriveDropTime([timed('12:00')], 1, '06:00', '21:00')).toBe('13:00')
  })

  it('drops before the first timed card → an earlier time', () => {
    expect(deriveDropTime([timed('12:00')], 0, '06:00', '21:00')).toBe('11:00')
  })

  it('leaves a card untimed when no usable day-window slot exists', () => {
    expect(deriveDropTime([timed('20:30')], 1, '06:00', '21:00')).toBeUndefined()
    expect(deriveDropTime([timed('06:30')], 0, '06:00', '21:00')).toBeUndefined()
  })

  it('returns undefined among untimed-only neighbours (reorder only)', () => {
    expect(deriveDropTime([untimed('a'), untimed('b')], 1, '06:00', '21:00')).toBeUndefined()
  })

  it('finds the nearest timed neighbour past untimed ones', () => {
    // [timed 10:00, untimed, <drop>, untimed, timed 14:00] → midpoint 12:00
    const neighbours = [timed('10:00'), untimed('u1'), untimed('u2'), timed('14:00')]
    expect(deriveDropTime(neighbours, 2, '06:00', '21:00')).toBe('12:30')
  })

  it('uses the preceding card duration instead of a fixed one-hour gap', () => {
    expect(deriveDropTime([timed('10:00', 2)], 1, '06:00', '21:00')).toBe('12:00')
  })

  it('fits a four-hour card into the available slot without overlapping either neighbour', () => {
    expect(deriveDropTime([timed('10:00', 2), timed('16:00')], 1, '06:00', '21:00', 4)).toBe('12:00')
  })
})

describe('applyCardDragEnd — assign time to an untimed card', () => {
  function seedTimed(doc: Y.Doc, dayKey: string, startTime: string, title = startTime) {
    return addCard(doc, { dayKey, title, startTime }).id
  }

  it('assigns a midpoint time when dropped between two timed cards', () => {
    const doc = freshDoc()
    seedTimed(doc, DAY1, '10:00', 'A')
    const b = seedTimed(doc, DAY1, '16:00', 'B')
    const u = addCard(doc, { dayKey: DAY1, title: 'U' }).id
    // Drop the untimed card onto B; canonical neighbours are A(10:00), B(16:00).
    applyCardDragEnd(doc, { activeId: u, overId: b })
    expect(getCard(doc, u)?.startTime).toBe('13:30')
  })

  it('uses the dragged card duration when assigning a time between cards', () => {
    const doc = freshDoc()
    seedTimed(doc, DAY1, '10:00', 'A')
    const b = seedTimed(doc, DAY1, '16:00', 'B')
    const u = addCard(doc, { dayKey: DAY1, title: 'U', duration: 'custom', durationHours: 4 }).id
    applyCardDragEnd(doc, { activeId: u, overId: b })
    expect(getCard(doc, u)?.startTime).toBe('12:00')
  })

  it('assigns a later time when dropped at the bottom (down direction)', () => {
    const doc = freshDoc()
    seedTimed(doc, DAY1, '10:00', 'A')
    const u = addCard(doc, { dayKey: DAY1, title: 'U' }).id
    applyCardDragEnd(doc, { activeId: u, overId: dayDroppableId(DAY1) })
    expect(getCard(doc, u)?.startTime).toBe('11:00')
  })

  it('is direction-aware: dropping at the visual top in up-direction is later', () => {
    const doc = freshDoc()
    seedTimed(doc, DAY1, '10:00', 'A')
    const b = seedTimed(doc, DAY1, '16:00', 'B')
    const u = addCard(doc, { dayKey: DAY1, title: 'U' }).id
    // Up-direction puts the evening at the visual top, so B(16:00) is the topmost
    // card. Dropping onto it lands above B (latest) → a time after B, not before.
    applyCardDragEnd(doc, { activeId: u, overId: b }, 'up')
    expect(getCard(doc, u)?.startTime).toBe('17:00')
  })

  it('falls back to a plain reorder among untimed-only cards (no time assigned)', () => {
    const doc = freshDoc()
    const id = seedDay(doc, DAY1, ['A', 'B', 'C'])
    applyCardDragEnd(doc, { activeId: id.C, overId: id.A })
    expect(getCard(doc, id.C)?.startTime).toBeUndefined()
    expect(titles(doc, DAY1)).toEqual(['C', 'A', 'B'])
  })

  it('assigns a time across days too', () => {
    const doc = freshDoc()
    seedTimed(doc, DAY2, '10:00', 'A')
    const b = seedTimed(doc, DAY2, '16:00', 'B')
    const u = addCard(doc, { dayKey: DAY1, title: 'U' }).id
    applyCardDragEnd(doc, { activeId: u, overId: b })
    expect(getCard(doc, u)?.dayKey).toBe(DAY2)
    expect(getCard(doc, u)?.startTime).toBe('13:30')
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

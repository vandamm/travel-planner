import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addCard, getCard, setTrip } from '../../data/doc'
import {
  applyCardDrop,
  dayDroppableId,
  dropTimeForOffset,
  planCardDrop,
  timelineDropOffset,
} from './dndHandlers'

const DAY1 = '2027-05-01'
const DAY2 = '2027-05-02'

function addTimed(doc: Y.Doc, title: string, startTime: string, durationHours = 1, dayKey = DAY1) {
  return addCard(doc, {
    dayKey,
    title,
    startTime,
    duration: 'custom',
    durationHours,
  }).id
}

describe('dayDroppableId', () => {
  it('identifies the target day', () => {
    expect(dayDroppableId(DAY1)).toBe(`day:${DAY1}`)
  })
})

describe('dropTimeForOffset', () => {
  it('includes the timeline scroll position in the drop offset', () => {
    expect(timelineDropOffset(500, 200, 120)).toBe(420)
  })

  it('maps the dropped card top to the clock and snaps to 15 minutes', () => {
    expect(dropTimeForOffset(255, 1, '06:00', '21:00', 'down')).toBe('10:15')
  })

  it('maps offsets from evening toward morning in up direction', () => {
    expect(dropTimeForOffset(120, 1, '06:00', '21:00', 'up')).toBe('18:00')
  })

  it('keeps the whole card inside the configured day window', () => {
    expect(dropTimeForOffset(-100, 2, '06:00', '21:00', 'down')).toBe('06:00')
    expect(dropTimeForOffset(2_000, 2, '06:00', '21:00', 'down')).toBe('19:00')
  })

  it('keeps edge drops snapped for custom day boundaries', () => {
    expect(dropTimeForOffset(-100, 1, '06:07', '21:07', 'down')).toBe('06:15')
    expect(dropTimeForOffset(60, 1, '06:07', '21:07', 'down')).toBe('07:00')
    expect(dropTimeForOffset(2_000, 1, '06:07', '21:07', 'down')).toBe('20:00')
  })
})

describe('applyCardDrop — same-day time drag', () => {
  it('uses the same pure plan for the preview and committed drop', () => {
    const doc = new Y.Doc()
    const active = addTimed(doc, 'Breakfast', '08:00')
    const neighbor = addTimed(doc, 'Museum', '10:00', 2)
    const card = getCard(doc, active)!
    const input = {
      card,
      targetDayKey: DAY1,
      offsetPx: 255,
      dayStart: '06:00',
      dayEnd: '21:00',
      direction: 'down' as const,
    }

    const preview = planCardDrop(input)
    expect(preview).toEqual({
      dayKey: DAY1,
      startTime: '10:15',
      durationHours: 1,
    })

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 255 })
    expect(getCard(doc, active)).toMatchObject(preview)
    expect(getCard(doc, neighbor)?.startTime).toBe('10:00')
  })

  it('gives an untimed card the time represented by its drop position', () => {
    const doc = new Y.Doc()
    const id = addCard(doc, { dayKey: DAY1, title: 'Stroll' }).id

    applyCardDrop(doc, { activeId: id, targetDayKey: DAY1, offsetPx: 240 })

    expect(getCard(doc, id)?.startTime).toBe('10:00')
  })

  it('moves a timed card into an overlap without changing neighbors', () => {
    const doc = new Y.Doc()
    const active = addTimed(doc, 'Breakfast', '08:00')
    const museum = addTimed(doc, 'Museum', '10:00', 2)
    const lunch = addTimed(doc, 'Lunch', '12:00')

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 240 })

    expect(getCard(doc, active)?.startTime).toBe('10:00')
    expect(getCard(doc, museum)?.startTime).toBe('10:00')
    expect(getCard(doc, lunch)?.startTime).toBe('12:00')
  })

  it('commits only the dropped card in one update', () => {
    const doc = new Y.Doc()
    const active = addTimed(doc, 'Breakfast', '08:00')
    addTimed(doc, 'Museum', '10:00', 2)
    addTimed(doc, 'Lunch', '12:00')
    let updates = 0
    doc.on('update', () => (updates += 1))

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 240 })

    expect(updates).toBe(1)
  })

  it('moves across days into an overlap without changing source or target neighbors', () => {
    const doc = new Y.Doc()
    const sourceNeighbor = addTimed(doc, 'Breakfast', '08:00')
    const active = addTimed(doc, 'Museum', '09:00', 2)
    const targetNeighbor = addTimed(doc, 'Lunch', '10:00', 1, DAY2)

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY2, offsetPx: 240 })

    expect(getCard(doc, active)?.dayKey).toBe(DAY2)
    expect(getCard(doc, active)?.startTime).toBe('10:00')
    expect(getCard(doc, sourceNeighbor)?.startTime).toBe('08:00')
    expect(getCard(doc, targetNeighbor)?.startTime).toBe('10:00')
  })

  it('does not write when a card is dropped back on the same time', () => {
    const doc = new Y.Doc()
    const active = addTimed(doc, 'Breakfast', '08:00')
    let updates = 0
    doc.on('update', () => (updates += 1))

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 120 })

    expect(updates).toBe(0)
  })

  it('does not move cards that end before the dropped card', () => {
    const doc = new Y.Doc()
    const earlier = addTimed(doc, 'Breakfast', '08:00')
    const active = addTimed(doc, 'Museum', '12:00')

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 240 })

    expect(getCard(doc, earlier)?.startTime).toBe('08:00')
    expect(getCard(doc, active)?.startTime).toBe('10:00')
  })

  it('keeps an impossible later push chain unchanged at the day end', () => {
    const doc = new Y.Doc()
    const active = addTimed(doc, 'Drinks', '18:00')
    const dinner = addTimed(doc, 'Dinner', '20:00')

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 840 })

    expect(getCard(doc, active)?.startTime).toBe('20:00')
    expect(getCard(doc, dinner)?.startTime).toBe('20:00')
  })

  it('keeps existing cards in place when the collision chain cannot fit', () => {
    const doc = new Y.Doc()
    const active = addTimed(doc, 'Long tour', '06:00', 8)
    const dinner = addTimed(doc, 'Long dinner', '13:00', 8)

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 2_000 })

    expect(getCard(doc, active)?.startTime).toBe('13:00')
    expect(getCard(doc, dinner)?.startTime).toBe('13:00')
  })

  it('keeps an impossible collision chain unchanged on a custom-day boundary', () => {
    const doc = new Y.Doc()
    setTrip(doc, { dayStart: '06:07', dayEnd: '21:07' })
    const active = addTimed(doc, 'Breakfast', '06:15')
    addTimed(doc, 'Long tour', '08:00', 13)
    addTimed(doc, 'Dinner', '20:00')

    applyCardDrop(doc, { activeId: active, targetDayKey: DAY1, offsetPx: 840 })

    expect(getCard(doc, active)?.startTime).toBe('20:00')
  })
})

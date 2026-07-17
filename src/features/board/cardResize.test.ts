import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addCard, getCard, setTrip } from '../../data/doc'
import type { Card } from '../../data/schema'
import { applyCardResize, planCardResize, type CardResizeEdge } from './cardResize'
import type { TimeDirection } from './timeDirection'

const DAY = '2027-05-01'
const DAY_START = '06:00'
const DAY_END = '21:00'

function timed(overrides: Partial<Card> = {}): Card {
  return {
    id: 'active',
    dayKey: DAY,
    title: 'Museum',
    order: 0,
    startTime: '10:00',
    duration: 'custom',
    durationHours: 1,
    ...overrides,
  }
}

function plan(
  edge: CardResizeEdge,
  deltaPx: number,
  direction: TimeDirection = 'down',
  card = timed(),
  cards: Card[] = [card],
) {
  return planCardResize({
    card,
    cards,
    edge,
    deltaPx,
    direction,
    dayStart: DAY_START,
    dayEnd: DAY_END,
  })
}

describe('planCardResize', () => {
  it.each([
    ['start', -15, 'down', '09:45', 1.25, -15],
    ['end', 15, 'down', '10:00', 1.25, 0],
    ['end', -15, 'up', '10:00', 1.25, -15],
    ['start', 15, 'up', '09:45', 1.25, 0],
  ] satisfies [CardResizeEdge, number, TimeDirection, string, number, number][])(
    'resizes the %s edge from a pointer delta in %s direction',
    (edge, deltaPx, direction, startTime, durationHours, topOffsetPx) => {
      expect(plan(edge, deltaPx, direction)).toMatchObject({
        startTime,
        duration: 'custom',
        durationHours,
        heightPx: 75,
        topOffsetPx,
      })
    },
  )

  it('snaps the preview to 15-minute values', () => {
    expect(plan('end', 8)).toMatchObject({
      startTime: '10:00',
      durationHours: 1.25,
      heightPx: 75,
    })
  })

  it('converts preset durations to a custom duration', () => {
    const card = timed({ duration: 'half', durationHours: undefined })
    expect(plan('end', 15, 'down', card)).toMatchObject({
      duration: 'custom',
      durationHours: 7.75,
    })
  })

  it.each(['start', 'end'] satisfies CardResizeEdge[])(
    'keeps the %s edge resize at or above 15 minutes',
    (edge) => {
      const deltaPx = edge === 'start' ? 200 : -200
      expect(plan(edge, deltaPx)).toMatchObject({ durationHours: 0.25, heightPx: 15 })
    },
  )

  it('plans collision pushes when an edge extends into another card', () => {
    const active = timed()
    const later = timed({ id: 'later', title: 'Lunch', order: 1, startTime: '11:00' })
    expect(plan('end', 60, 'down', active, [active, later])).toMatchObject({
      durationHours: 2,
      pushed: [{ id: 'later', startTime: '12:00' }],
    })
  })
})

describe('applyCardResize', () => {
  it('commits the custom duration, active schedule, and collision pushes atomically', () => {
    const doc = new Y.Doc()
    setTrip(doc, { dayStart: DAY_START, dayEnd: DAY_END })
    addCard(doc, {
      id: 'active',
      dayKey: DAY,
      title: 'Museum',
      startTime: '10:00',
      duration: 'half',
    })
    addCard(doc, {
      id: 'later',
      dayKey: DAY,
      title: 'Lunch',
      startTime: '17:30',
      duration: 'custom',
      durationHours: 1,
    })
    let transactionCount = 0
    doc.on('afterTransaction', () => {
      transactionCount += 1
    })

    applyCardResize(doc, 'active', 'end', 60, 'down')

    expect(getCard(doc, 'active')).toMatchObject({
      startTime: '10:00',
      duration: 'custom',
      durationHours: 8.5,
    })
    expect(getCard(doc, 'later')).toMatchObject({ startTime: '18:30' })
    expect(transactionCount).toBe(1)
  })
})

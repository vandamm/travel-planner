import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { addCard, getCard, setTrip } from '../../data/doc'
import type { Card } from '../../data/schema'
import { PX_PER_HOUR } from '../cards/cardHeight'
import { applyCardResize, planCardResize, type CardResizeEdge } from './cardResize'

/** Pointer deltas and heights are expressed in scale units, not raw pixels, so
 *  changing PX_PER_HOUR does not mean rewriting every expectation. */
const QUARTER = PX_PER_HOUR / 4
const px = (hours: number) => hours * PX_PER_HOUR

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

function plan(edge: CardResizeEdge, deltaPx: number, card = timed()) {
  return planCardResize({
    card,
    edge,
    deltaPx,
    dayStart: DAY_START,
    dayEnd: DAY_END,
  })
}

describe('planCardResize', () => {
  it.each([
    ['start', -QUARTER, '09:45', 1.25, -QUARTER],
    ['end', QUARTER, '10:00', 1.25, 0],
  ] satisfies [CardResizeEdge, number, string, number, number][])(
    'resizes the %s edge from a pointer delta',
    (edge, deltaPx, startTime, durationHours, topOffsetPx) => {
      expect(plan(edge, deltaPx)).toMatchObject({
        startTime,
        duration: 'custom',
        durationHours,
        heightPx: px(1.25),
        topOffsetPx,
      })
    },
  )

  it('snaps the preview to 15-minute values', () => {
    // Just over half a quarter-hour of travel rounds up to a full quarter.
    expect(plan('end', QUARTER * 0.55)).toMatchObject({
      startTime: '10:00',
      durationHours: 1.25,
      heightPx: px(1.25),
    })
  })

  it('converts preset durations to a custom duration', () => {
    const card = timed({ duration: 'half', durationHours: undefined })
    expect(plan('end', QUARTER, card)).toMatchObject({
      duration: 'custom',
      durationHours: 7.75,
    })
  })

  it.each(['start', 'end'] satisfies CardResizeEdge[])(
    'keeps the %s edge resize at or above 15 minutes',
    (edge) => {
      const deltaPx = edge === 'start' ? px(4) : -px(4)
      expect(plan(edge, deltaPx)).toMatchObject({ durationHours: 0.25, heightPx: px(0.25) })
    },
  )

  it.each([
    ['start', -PX_PER_HOUR, '09:00', 2, -PX_PER_HOUR],
    ['end', PX_PER_HOUR, '10:00', 2, 0],
  ] satisfies [CardResizeEdge, number, string, number, number][])(
    'allows the %s edge to overlap without neighbor results',
    (edge, deltaPx, startTime, durationHours, topOffsetPx) => {
      const active = timed()
      expect(plan(edge, deltaPx, active)).toEqual({
        startTime,
        duration: 'custom',
        durationHours,
        heightPx: px(2),
        topOffsetPx,
      })
    },
  )
})

describe('applyCardResize', () => {
  it('commits the custom duration and active schedule without changing a neighbor', () => {
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

    applyCardResize(doc, 'active', 'end', PX_PER_HOUR)

    expect(getCard(doc, 'active')).toMatchObject({
      startTime: '10:00',
      duration: 'custom',
      durationHours: 8.5,
    })
    expect(getCard(doc, 'later')).toMatchObject({ startTime: '17:30' })
    expect(transactionCount).toBe(1)
  })
})

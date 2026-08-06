import { describe, expect, it } from 'vitest'
import {
  planTimelineSchedule,
  type ScheduleInterval,
  type TimelineEditKind,
} from './timelineSchedule'

const DAY_START = 6 * 60
const DAY_END = 21 * 60

function interval(id: string, start: number, duration = 60): ScheduleInterval {
  return { id, start, duration }
}

function plan(
  active: ScheduleInterval,
  requested: Omit<ScheduleInterval, 'id'>,
  edit: TimelineEditKind,
  dayStart = DAY_START,
  dayEnd = DAY_END,
) {
  return planTimelineSchedule({
    active,
    requested,
    edit,
    dayStart,
    dayEnd,
  })
}

describe('planTimelineSchedule', () => {
  it('allows a move to overlap without returning neighbor updates', () => {
    const result = plan(interval('active', 8 * 60), { start: 10 * 60, duration: 60 }, 'move')

    expect(result).toEqual({
      activeStart: 10 * 60,
      activeDuration: 60,
    })
  })

  it.each([
    ['earlier', 12 * 60],
    ['later', 8 * 60],
  ] satisfies [string, number][])('moves a card %s to the requested start', (_label, activeStart) => {
    const result = plan(interval('active', activeStart), { start: 10 * 60, duration: 60 }, 'move')

    expect(result).toEqual({ activeStart: 10 * 60, activeDuration: 60 })
  })

  it.each([
    ['resize-start', 9 * 60, 12 * 60],
    ['resize-end', 10 * 60, 13 * 60],
  ] satisfies [TimelineEditKind, number, number][])(
    'allows an extending %s edge to overlap',
    (edit, requestedStart, requestedEnd) => {
      const active = interval('active', 10 * 60, 120)
      const requested = { start: requestedStart, duration: requestedEnd - requestedStart }
      const result = plan(active, requested, edit)

      expect(result).toEqual({
        activeStart: requestedStart,
        activeDuration: requestedEnd - requestedStart,
      })
    },
  )

  it('normalizes an edge shrink without neighbor results', () => {
    const result = plan(
      interval('active', 10 * 60, 120),
      { start: 10.5 * 60, duration: 60 },
      'resize-start',
    )

    expect(result).toEqual({ activeStart: 10.5 * 60, activeDuration: 90 })
  })

  it('rounds requested edges to 15 minutes', () => {
    const result = plan(interval('active', 8 * 60), { start: 10 * 60 + 8, duration: 67 }, 'move')

    expect(result).toMatchObject({ activeStart: 10 * 60 + 15, activeDuration: 60 })
  })

  it('clamps moves to the configured day bounds', () => {
    expect(
      plan(interval('active', 8 * 60, 120), { start: 5 * 60, duration: 120 }, 'move'),
    ).toMatchObject({ activeStart: DAY_START, activeDuration: 120 })
    expect(
      plan(interval('active', 8 * 60, 120), { start: 21 * 60, duration: 120 }, 'move'),
    ).toMatchObject({ activeStart: DAY_END - 120, activeDuration: 120 })
  })

  it('clamps a resized edge without moving the opposite edge', () => {
    expect(
      plan(interval('active', 10 * 60, 120), { start: 5 * 60, duration: 7 * 60 }, 'resize-start'),
    ).toMatchObject({ activeStart: DAY_START, activeDuration: 6 * 60 })
    expect(
      plan(interval('active', 10 * 60, 120), { start: 10 * 60, duration: 12 * 60 }, 'resize-end'),
    ).toMatchObject({ activeStart: 10 * 60, activeDuration: 11 * 60 })
  })
})

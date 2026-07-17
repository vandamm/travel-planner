import { describe, expect, it } from 'vitest'
import {
  planTimelineSchedule,
  type ScheduleInterval,
  type TimelineEditKind,
} from './timelineSchedule'
import type { TimeDirection } from './timeDirection'

const DAY_START = 6 * 60
const DAY_END = 21 * 60

function interval(id: string, start: number, duration = 60): ScheduleInterval {
  return { id, start, duration }
}

function plan(
  active: ScheduleInterval,
  requested: Omit<ScheduleInterval, 'id'>,
  others: ScheduleInterval[],
  edit: TimelineEditKind,
  direction: TimeDirection = 'down',
  dayStart = DAY_START,
  dayEnd = DAY_END,
) {
  return planTimelineSchedule({
    active,
    requested,
    others,
    edit,
    direction,
    dayStart,
    dayEnd,
  })
}

describe('planTimelineSchedule', () => {
  it('pushes a later collision chain forward after a later move', () => {
    const result = plan(
      interval('active', 8 * 60),
      { start: 10 * 60, duration: 60 },
      [interval('museum', 10 * 60, 120), interval('lunch', 12 * 60)],
      'move-bottom',
    )

    expect(result).toEqual({
      activeStart: 10 * 60,
      activeDuration: 60,
      pushed: [
        { id: 'museum', start: 11 * 60 },
        { id: 'lunch', start: 13 * 60 },
      ],
    })
  })

  it.each([
    ['down', 12 * 60, 10 * 60],
    ['up', 8 * 60, 10 * 60],
  ] satisfies [TimeDirection, number, number][])(
    'pushes a visual-top move toward the top in %s direction',
    (direction, activeStart, requestedStart) => {
      const result = plan(
        interval('active', activeStart),
        { start: requestedStart, duration: 60 },
        [interval('first', 9 * 60, 90), interval('second', 8 * 60, 60)],
        'move-top',
        direction,
      )

      expect(result.pushed).toEqual(
        direction === 'down'
          ? [
              { id: 'first', start: 8.5 * 60 },
              { id: 'second', start: 7.5 * 60 },
            ]
          : [{ id: 'first', start: 11 * 60 }],
      )
    },
  )

  it.each([
    ['down', 8 * 60, 10 * 60],
    ['up', 12 * 60, 10 * 60],
  ] satisfies [TimeDirection, number, number][])(
    'pushes a visual-bottom move toward the bottom in %s direction',
    (direction, activeStart, requestedStart) => {
      const result = plan(
        interval('active', activeStart),
        { start: requestedStart, duration: 60 },
        [interval('first', 10.5 * 60, 90), interval('second', 12 * 60, 60)],
        'move-bottom',
        direction,
      )

      expect(result.pushed).toEqual(
        direction === 'down'
          ? [
              { id: 'first', start: 11 * 60 },
              { id: 'second', start: 12.5 * 60 },
            ]
          : [{ id: 'first', start: 8.5 * 60 }],
      )
    },
  )

  it.each([
    ['resize-top', 'down', 9 * 60, 12 * 60, [{ id: 'earlier', start: 8 * 60 }]],
    ['resize-top', 'up', 10 * 60, 13 * 60, [{ id: 'later', start: 13 * 60 }]],
    ['resize-bottom', 'down', 10 * 60, 13 * 60, [{ id: 'later', start: 13 * 60 }]],
    ['resize-bottom', 'up', 9 * 60, 12 * 60, [{ id: 'earlier', start: 8 * 60 }]],
  ] satisfies [TimelineEditKind, TimeDirection, number, number, { id: string; start: number }[]][])(
    'pushes an extending %s edge in %s direction',
    (edit, direction, requestedStart, requestedEnd, expected) => {
      const active = interval('active', 10 * 60, 120)
      const requested = { start: requestedStart, duration: requestedEnd - requestedStart }
      const result = plan(
        active,
        requested,
        [interval('earlier', 9 * 60), interval('later', 12 * 60)],
        edit,
        direction,
      )

      expect(result.pushed).toEqual(expected)
    },
  )

  it('does not push other cards when an edge shrinks', () => {
    const result = plan(
      interval('active', 10 * 60, 120),
      { start: 10.5 * 60, duration: 60 },
      [interval('earlier', 9 * 60), interval('later', 12 * 60)],
      'resize-top',
    )

    expect(result.pushed).toEqual([])
  })

  it('rounds requested edges to 15 minutes', () => {
    const result = plan(
      interval('active', 8 * 60),
      { start: 10 * 60 + 8, duration: 67 },
      [],
      'move-bottom',
    )

    expect(result).toMatchObject({ activeStart: 10 * 60 + 15, activeDuration: 60 })
  })

  it('clamps moves to the configured day bounds', () => {
    expect(
      plan(interval('active', 8 * 60, 120), { start: 5 * 60, duration: 120 }, [], 'move-top'),
    ).toMatchObject({ activeStart: DAY_START, activeDuration: 120 })
    expect(
      plan(interval('active', 8 * 60, 120), { start: 21 * 60, duration: 120 }, [], 'move-bottom'),
    ).toMatchObject({ activeStart: DAY_END - 120, activeDuration: 120 })
  })

  it('clamps a resized edge without moving the opposite edge', () => {
    expect(
      plan(interval('active', 10 * 60, 120), { start: 5 * 60, duration: 7 * 60 }, [], 'resize-top'),
    ).toMatchObject({ activeStart: DAY_START, activeDuration: 6 * 60 })
    expect(
      plan(
        interval('active', 10 * 60, 120),
        { start: 10 * 60, duration: 12 * 60 },
        [],
        'resize-bottom',
      ),
    ).toMatchObject({ activeStart: 10 * 60, activeDuration: 11 * 60 })
  })

  it('leaves other schedules unchanged when a collision chain cannot fit', () => {
    const others = [interval('dinner', 13 * 60, 8 * 60), interval('unrelated', 7 * 60)]
    const snapshot = structuredClone(others)

    const result = plan(
      interval('active', 6 * 60, 8 * 60),
      { start: 13 * 60, duration: 8 * 60 },
      others,
      'move-bottom',
    )

    expect(result).toEqual({
      activeStart: 13 * 60,
      activeDuration: 8 * 60,
      pushed: [],
    })
    expect(others).toEqual(snapshot)
  })
})

import type { TimeDirection } from './timeDirection'

export const TIMELINE_SNAP_MINUTES = 15

export interface ScheduleInterval {
  id: string
  start: number
  duration: number
}

export type TimelineEditKind = 'move-top' | 'move-bottom' | 'resize-top' | 'resize-bottom'

export interface TimelineScheduleInput {
  active: ScheduleInterval
  requested: Omit<ScheduleInterval, 'id'>
  others: ScheduleInterval[]
  dayStart: number
  dayEnd: number
  edit: TimelineEditKind
  direction: TimeDirection
}

export interface TimelineSchedulePlan {
  activeStart: number
  activeDuration: number
  pushed: { id: string; start: number }[]
}

function snap(minutes: number): number {
  return Math.round(minutes / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES
}

function normalizeRequested({
  active,
  requested,
  dayStart,
  dayEnd,
  edit,
  direction,
}: TimelineScheduleInput): Pick<TimelineSchedulePlan, 'activeStart' | 'activeDuration'> {
  const first = Math.ceil(dayStart / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES
  const last = Math.floor(dayEnd / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES
  const requestedStart = snap(requested.start)
  const requestedEnd = snap(requested.start + requested.duration)

  if (edit === 'move-top' || edit === 'move-bottom') {
    const activeDuration = Math.min(
      Math.max(requestedEnd - requestedStart, TIMELINE_SNAP_MINUTES),
      last - first,
    )
    const activeStart = Math.min(Math.max(requestedStart, first), last - activeDuration)
    return { activeStart, activeDuration }
  }

  const editsStart =
    (edit === 'resize-top' && direction === 'down') ||
    (edit === 'resize-bottom' && direction === 'up')
  if (editsStart) {
    const fixedEnd = Math.min(
      Math.max(snap(active.start + active.duration), first + TIMELINE_SNAP_MINUTES),
      last,
    )
    const activeStart = Math.min(Math.max(requestedStart, first), fixedEnd - TIMELINE_SNAP_MINUTES)
    return { activeStart, activeDuration: fixedEnd - activeStart }
  }

  const fixedStart = Math.min(Math.max(snap(active.start), first), last - TIMELINE_SNAP_MINUTES)
  const activeEnd = Math.max(Math.min(requestedEnd, last), fixedStart + TIMELINE_SNAP_MINUTES)
  return { activeStart: fixedStart, activeDuration: activeEnd - fixedStart }
}

function pushesLater(edit: TimelineEditKind, direction: TimeDirection): boolean {
  const towardBottom = edit === 'move-bottom' || edit === 'resize-bottom'
  return direction === 'down' ? towardBottom : !towardBottom
}

function packLater(
  activeStart: number,
  activeDuration: number,
  others: ScheduleInterval[],
  dayEnd: number,
): TimelineSchedulePlan['pushed'] | undefined {
  const pushed: TimelineSchedulePlan['pushed'] = []
  let cursor = activeStart + activeDuration
  let chainStarted = false
  const ordered = [...others].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))

  for (const card of ordered) {
    const end = card.start + card.duration
    if (!chainStarted && end <= activeStart) continue
    if (card.start >= cursor) break
    chainStarted = true
    pushed.push({ id: card.id, start: cursor })
    cursor += card.duration
  }

  return cursor <= dayEnd ? pushed : undefined
}

function packEarlier(
  activeStart: number,
  activeDuration: number,
  others: ScheduleInterval[],
  dayStart: number,
): TimelineSchedulePlan['pushed'] | undefined {
  const pushed: TimelineSchedulePlan['pushed'] = []
  let cursor = activeStart
  const ordered = [...others].sort((a, b) => {
    return b.start - a.start || a.id.localeCompare(b.id)
  })

  for (const card of ordered) {
    const end = card.start + card.duration
    if (card.start >= activeStart + activeDuration || end <= cursor) continue
    cursor -= card.duration
    pushed.push({ id: card.id, start: cursor })
  }

  return cursor >= dayStart ? pushed : undefined
}

/** Plan a move or resize without mutating the supplied intervals. */
export function planTimelineSchedule(input: TimelineScheduleInput): TimelineSchedulePlan {
  const { activeStart, activeDuration } = normalizeRequested(input)
  const base = { activeStart, activeDuration, pushed: [] }
  const isResize = input.edit === 'resize-top' || input.edit === 'resize-bottom'
  if (isResize && activeDuration <= input.active.duration) return base

  const pushed = pushesLater(input.edit, input.direction)
    ? packLater(activeStart, activeDuration, input.others, input.dayEnd)
    : packEarlier(activeStart, activeDuration, input.others, input.dayStart)

  return { activeStart, activeDuration, pushed: pushed ?? [] }
}

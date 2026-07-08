// Pure calendar helpers for the §10 date picker: a month grid (weeks start
// Monday for the app's European date UI) and a first→last range-selection
// reducer. Values are ISO 'yyyy-MM-dd', so a lexicographic string compare is
// already chronological — range math needs no Date parsing. date-fns handles the
// month / leap-year / year boundaries when laying out the grid. DOM-free and
// unit-tested; the DatePicker UI renders on top of it.

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { DAY_KEY_FORMAT } from '../../data/days'

export interface GridDay {
  /** ISO day key 'yyyy-MM-dd'. */
  key: string
  /** 1–31, for display. */
  dayOfMonth: number
  /** False for the leading/trailing filler days of the adjacent month. */
  inMonth: boolean
}

/** Weekday header labels, Monday-first. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

/**
 * The calendar grid for `month` (0–11) of `year`: an array of full weeks, each 7
 * days, padded with adjacent-month days so every week starts Monday.
 */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = new Date(year, month, 1)
  const gridStart = startOfWeek(startOfMonth(first), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(first), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const weeks: GridDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(
      days.slice(i, i + 7).map((d) => ({
        key: format(d, DAY_KEY_FORMAT),
        dayOfMonth: d.getDate(),
        inMonth: d.getMonth() === month,
      })),
    )
  }
  return weeks
}

export interface DateRange {
  start?: string
  end?: string
}

/**
 * Fold a clicked day into a range. No anchor yet (or a complete range already) →
 * begin a fresh selection; otherwise complete it, swapping when the pick lands
 * before the anchor so `start <= end` always holds (last-before-first swaps).
 */
export function nextRange(range: DateRange, picked: string): DateRange {
  if (!range.start || range.end) return { start: picked, end: undefined }
  return picked < range.start
    ? { start: picked, end: range.start }
    : { start: range.start, end: picked }
}

/** A day strictly within the (complete) range — endpoints included. */
export function inRange(range: DateRange, key: string): boolean {
  if (!range.start || !range.end) return false
  return key >= range.start && key <= range.end
}

/** A day that is a range endpoint (or the lone anchor mid-selection). */
export function isEndpoint(range: DateRange, key: string): boolean {
  return key === range.start || key === range.end
}

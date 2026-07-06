/**
 * Clamp a day index to the valid range `[0, dayCount - 1]`, so paging or
 * swiping can never run off either end. Returns 0 when there are no days.
 */
export function clampDayIndex(index: number, dayCount: number): number {
  if (dayCount <= 0) return 0
  return Math.min(Math.max(index, 0), dayCount - 1)
}

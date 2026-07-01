import { describe, expect, it } from 'vitest'
import { generateDays } from '../../data/days'
import { rangeLabel, showRightFade, todayIndex, visibleRange } from './multiWeekNav'

describe('showRightFade', () => {
  it('shows the fade when columns overflow and the left is in view', () => {
    expect(showRightFade({ scrollWidth: 3000, clientWidth: 1000, scrollLeft: 0 })).toBe(true)
  })

  it('hides the fade once scrolled to the right end', () => {
    expect(showRightFade({ scrollWidth: 3000, clientWidth: 1000, scrollLeft: 2000 })).toBe(false)
  })

  it('hides the fade within an epsilon of the right edge', () => {
    expect(showRightFade({ scrollWidth: 3000, clientWidth: 1000, scrollLeft: 1999 })).toBe(false)
  })

  it('does not show the fade when the columns fit', () => {
    expect(showRightFade({ scrollWidth: 1000, clientWidth: 1000, scrollLeft: 0 })).toBe(false)
  })
})

describe('todayIndex', () => {
  const days = generateDays('2027-05-01', 14)

  it('returns the index when today is inside the trip', () => {
    expect(todayIndex(days, '2027-05-04')).toBe(3)
  })

  it('returns -1 when today is before the trip', () => {
    expect(todayIndex(days, '2027-04-30')).toBe(-1)
  })

  it('returns -1 when today is after the trip', () => {
    expect(todayIndex(days, '2027-05-15')).toBe(-1)
  })
})

describe('visibleRange', () => {
  const stride = 236

  it('is null when there are no days', () => {
    expect(visibleRange(0, { clientWidth: 1000, scrollLeft: 0 })).toBeNull()
  })

  it('derives the first visible column from the scroll offset', () => {
    // 3 strides scrolled → first visible is column 3; ~4 columns fit 1000px.
    expect(visibleRange(14, { clientWidth: 1000, scrollLeft: 3 * stride })).toEqual({
      first: 3,
      last: 6,
    })
  })

  it('clamps the last index to the final day', () => {
    expect(visibleRange(14, { clientWidth: 1000, scrollLeft: 12 * stride })).toEqual({
      first: 12,
      last: 13,
    })
  })

  it('shows at least one column even for a sliver of width', () => {
    expect(visibleRange(14, { clientWidth: 10, scrollLeft: 0 })).toEqual({ first: 0, last: 0 })
  })
})

describe('rangeLabel', () => {
  const days = generateDays('2027-05-01', 14)

  it('is empty when there are no days', () => {
    expect(rangeLabel([], { clientWidth: 1000, scrollLeft: 0 })).toBe('')
  })

  it('renders a European dd.MM span for the visible columns', () => {
    expect(rangeLabel(days, { clientWidth: 1000, scrollLeft: 0 })).toBe('01.05 – 04.05')
  })

  it('renders a single date when only one column is visible', () => {
    expect(rangeLabel(days, { clientWidth: 100, scrollLeft: 0 })).toBe('01.05')
  })
})

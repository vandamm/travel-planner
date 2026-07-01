import { describe, expect, it } from 'vitest'
import { showScrollHint } from './scrollHint'

describe('showScrollHint', () => {
  it('shows the hint when content overflows and the top is in view', () => {
    expect(showScrollHint({ scrollHeight: 1000, clientHeight: 400, scrollTop: 0 })).toBe(true)
  })

  it('hides the hint once scrolled to the bottom', () => {
    expect(showScrollHint({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 })).toBe(false)
  })

  it('hides the hint within an epsilon of the bottom', () => {
    expect(showScrollHint({ scrollHeight: 1000, clientHeight: 400, scrollTop: 599 })).toBe(false)
  })

  it('does not show the hint when the content fits', () => {
    expect(showScrollHint({ scrollHeight: 400, clientHeight: 400, scrollTop: 0 })).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { CATEGORY_GLYPH, CATEGORY_STYLE, isShortCard, isTicketWashed, ticketMarkerState } from './cardPalette'

describe('CATEGORY_STYLE', () => {
  it('gives each of the four types an accent, a tint and a left edge', () => {
    expect(Object.keys(CATEGORY_STYLE)).toEqual(['indoor', 'food', 'outdoor', 'transit'])
    for (const [category, style] of Object.entries(CATEGORY_STYLE)) {
      expect(style.surface).toContain(`bg-category-${category}-bg`)
      expect(style.surface).toContain(`border-category-${category}-edge`)
      expect(style.surface).toContain(`border-l-category-${category}`)
      expect(style.glyph).toBe(`stroke-category-${category}`)
      expect(CATEGORY_GLYPH[category as keyof typeof CATEGORY_GLYPH].d).toBeTruthy()
    }
  })
})

describe('ticketMarkerState', () => {
  it('marks only a card that has a ticket to think about', () => {
    // "none" is the common case and carries no information, so it gets no
    // corner marker at all — otherwise every card wears one.
    expect(ticketMarkerState(undefined, 'indoor')).toBeUndefined()
    expect(ticketMarkerState('none', 'indoor')).toBeUndefined()
    expect(ticketMarkerState('required', 'food')).toBe('required')
    expect(ticketMarkerState('bought', undefined)).toBe('bought')
  })

  it('never marks a transport card, whatever it stores', () => {
    expect(ticketMarkerState(undefined, 'transit')).toBeUndefined()
    expect(ticketMarkerState('required', 'transit')).toBeUndefined()
    expect(ticketMarkerState('bought', 'transit')).toBeUndefined()
  })
})

describe('isTicketWashed', () => {
  it('washes only a required-but-unbought, non-transport card', () => {
    expect(isTicketWashed('required', 'indoor')).toBe(true)
    expect(isTicketWashed('required', 'transit')).toBe(false)
    expect(isTicketWashed('bought', 'indoor')).toBe(false)
    expect(isTicketWashed(undefined, 'indoor')).toBe(false)
  })
})

describe('isShortCard', () => {
  it('collapses cards under an hour, but never the one-hour default', () => {
    expect(isShortCard(45)).toBe(true)
    expect(isShortCard(50)).toBe(true)
    // 60px is the default one-hour card — it keeps its stacked rows.
    expect(isShortCard(60)).toBe(false)
    expect(isShortCard(120)).toBe(false)
    expect(isShortCard(undefined)).toBe(false)
  })
})

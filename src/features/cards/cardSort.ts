// The definitive within-a-day card ordering.
//
// A day column mixes two kinds of cards: *time-bound* ones (trains, flights,
// dinner reservations) that carry a real `startTime`, and *untimed* ones that
// the user arranges by hand. Manual `order` controls every card's slot, while
// timed cards are sorted chronologically within their occupied slots. This
// canonical (morning→evening) order is what the board shows in the default
// direction; the per-user direction toggle (see `timeDirection.ts`) merely
// reverses it.

import type { Card } from '../../data/schema'

/** A card is time-bound when it has a non-empty `startTime`. */
export function isTimed(card: Card): boolean {
  return typeof card.startTime === 'string' && card.startTime.length > 0
}

/**
 * Canonical morning→evening order for a day's cards. Untimed cards remain in
 * their manual slots; timed cards fill their own slots in ascending `startTime`
 * order. Returns a new array; the input is left untouched.
 */
export function sortCardsForColumn(cards: Card[]): Card[] {
  const ordered = [...cards].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const timed = ordered.filter(isTimed)
  timed.sort((a, b) => {
    const at = a.startTime as string
    const bt = b.startTime as string
    return at < bt ? -1 : at > bt ? 1 : a.order - b.order || a.id.localeCompare(b.id)
  })
  let timedIndex = 0
  return ordered.map((card) => (isTimed(card) ? timed[timedIndex++] : card))
}

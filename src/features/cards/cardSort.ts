// The definitive within-a-day card ordering.
//
// A day column mixes two kinds of cards: *time-bound* ones (trains, flights,
// dinner reservations) that carry a real `startTime`, and *untimed* ones that
// the user arranges by hand. Timed cards always come first, sorted by their
// start time; untimed cards follow in their manual `order`. This canonical
// (morning→evening) order is what the board shows in the default direction; the
// per-user direction toggle (see `timeDirection.ts`) merely reverses it.

import type { Card } from '../../data/schema'

/** A card is time-bound when it has a non-empty `startTime`. */
export function isTimed(card: Card): boolean {
  return typeof card.startTime === 'string' && card.startTime.length > 0
}

/**
 * Canonical morning→evening order for a day's cards: timed cards first (ascending
 * by `startTime`, ties broken by manual `order` for stability), then untimed
 * cards by `order`. Returns a new array; the input is left untouched.
 */
export function sortCardsForColumn(cards: Card[]): Card[] {
  const timed = cards.filter(isTimed)
  const untimed = cards.filter((c) => !isTimed(c))
  timed.sort((a, b) => {
    const at = a.startTime as string
    const bt = b.startTime as string
    return at < bt ? -1 : at > bt ? 1 : a.order - b.order
  })
  untimed.sort((a, b) => a.order - b.order)
  return [...timed, ...untimed]
}

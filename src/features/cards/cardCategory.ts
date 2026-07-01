import type { Card, CardCategory } from '../../data/schema'

/**
 * Effective category of a card: the explicit `category`, else the legacy
 * `transport: true` flag derived as `'transit'`, else undefined.
 *
 * ponytail: derive legacy `transport` at read time — no bulk CRDT migration.
 * The editor rewrites to `category` (and drops `transport`) on the next save.
 */
export function cardCategory(card: Pick<Card, 'category' | 'transport'>): CardCategory | undefined {
  return card.category ?? (card.transport ? 'transit' : undefined)
}

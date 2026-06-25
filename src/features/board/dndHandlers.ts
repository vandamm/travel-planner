// Translate finished card drags into doc mutations.
//
// Every drag — reordering within a day or moving a card to another day —
// reduces to the *same* operation: compute the target day's new ordered list of
// card ids (with the dragged card inserted at the drop position) and hand it to
// `reorderCards`, which (re)assigns each listed card's `dayKey` and `order` by
// index. A cross-day move is therefore just a reorder whose list happens to
// include a card that previously lived on another day. Keeping the logic here
// as pure functions (doc + ids in, mutation out) makes it unit-testable without
// dnd-kit, jsdom, or a live drag.

import type * as Y from 'yjs'
import { getCard, listCards, reorderCards } from '../../data/doc'
import { orderCardsForDirection, type TimeDirection } from './timeDirection'

/** Prefix marking a *column's* droppable id, distinguishing it from a card id. */
export const DAY_DROPPABLE_PREFIX = 'day:'

/** The droppable id dnd-kit uses for a day column's body. */
export function dayDroppableId(dayKey: string): string {
  return `${DAY_DROPPABLE_PREFIX}${dayKey}`
}

export function isDayDroppableId(id: string): boolean {
  return id.startsWith(DAY_DROPPABLE_PREFIX)
}

export function dayKeyFromDroppableId(id: string): string {
  return id.slice(DAY_DROPPABLE_PREFIX.length)
}

/** The relevant subset of a dnd-kit `DragEndEvent`: the active and over ids. */
export interface CardDragEnd {
  /** The dragged card's id. */
  activeId: string
  /** The card id or day-droppable id under the pointer at drop, or null. */
  overId: string | null
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Apply a finished card drag to the doc.
 *
 * `direction` is the viewer's time direction: the drop slot is computed in the
 * order the user actually sees (reversed when 'up'), then converted back to the
 * canonical morning→evening order for storage, so a drag does what it looks like
 * regardless of which way the column is flipped.
 *
 * No-ops when there is no drop target, when a card is dropped on itself, when
 * the active card no longer exists, or when the drop leaves the order unchanged.
 */
export function applyCardDragEnd(
  doc: Y.Doc,
  { activeId, overId }: CardDragEnd,
  direction: TimeDirection = 'down',
): void {
  if (!overId || overId === activeId) return
  const active = getCard(doc, activeId)
  if (!active) return

  // Resolve the target day and, when dropped onto a card, that card's id.
  let targetDayKey: string
  let overCardId: string | null = null
  if (isDayDroppableId(overId)) {
    targetDayKey = dayKeyFromDroppableId(overId)
  } else {
    const over = getCard(doc, overId)
    if (!over) return
    targetDayKey = over.dayKey
    overCardId = overId
  }

  // The target day's cards as the viewer sees them, minus the dragged card.
  const targetCards = listCards(doc).filter((c) => c.dayKey === targetDayKey && c.id !== activeId)
  const visible = orderCardsForDirection(targetCards, direction).map((c) => c.id)

  // Insert the dragged card at the drop slot: into the over card's place, or at
  // the end when dropped on the column body (or onto a since-removed card).
  const at = overCardId ? visible.indexOf(overCardId) : visible.length
  const index = at < 0 ? visible.length : at
  const newVisible = [...visible.slice(0, index), activeId, ...visible.slice(index)]

  // Convert the visible order back to canonical (morning→evening) for storage.
  const canonical = direction === 'up' ? [...newVisible].reverse() : newVisible

  // Skip a within-day drop that leaves the canonical order untouched.
  if (targetDayKey === active.dayKey) {
    const current = orderCardsForDirection(
      listCards(doc).filter((c) => c.dayKey === targetDayKey),
      'down',
    ).map((c) => c.id)
    if (arraysEqual(current, canonical)) return
  }

  reorderCards(doc, targetDayKey, canonical)
}

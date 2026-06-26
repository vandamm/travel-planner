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
import { getCard, getTrip, listCards, reorderCards, updateCard } from '../../data/doc'
import type { Card } from '../../data/schema'
import { clockMinutes, clockString } from '../cards/cardHeight'
import { isTimed } from '../cards/cardSort'
import { orderCardsForDirection, type TimeDirection } from './timeDirection'

/** Snap derived drop times to this granularity (minutes). */
const SNAP_MINUTES = 15
/** Offset (minutes) used when a drop has a timed neighbour on only one side. */
const NEIGHBOR_GAP_MINUTES = 60

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
 * Derive a start time for an untimed card dropped into a day, inferred from its
 * neighbours in canonical (morning→evening) order. `neighbours` are the day's
 * other cards in that order; `insertIndex` is where the dragged card landed
 * among them.
 *
 * The day column is a *stacked* timeline, not a clock ruler, so the time comes
 * from the nearest timed card on each side of the drop, not from pixels:
 * - timed neighbours both above and below → their midpoint;
 * - only an earlier (above) timed neighbour → that time + a gap (later);
 * - only a later (below) timed neighbour → that time − a gap (earlier).
 * The result is snapped to {@link SNAP_MINUTES} and clamped to the day window.
 * Returns `undefined` when there is no timed neighbour to anchor against — the
 * caller then falls back to a plain untimed reorder.
 */
export function deriveDropTime(
  neighbours: Card[],
  insertIndex: number,
  dayStart: string,
  dayEnd: string,
): string | undefined {
  let before: number | undefined
  for (let i = insertIndex - 1; i >= 0; i--) {
    if (isTimed(neighbours[i])) {
      before = clockMinutes(neighbours[i].startTime as string)
      break
    }
  }
  let after: number | undefined
  for (let i = insertIndex; i < neighbours.length; i++) {
    if (isTimed(neighbours[i])) {
      after = clockMinutes(neighbours[i].startTime as string)
      break
    }
  }

  let target: number
  if (before !== undefined && after !== undefined) target = (before + after) / 2
  else if (before !== undefined) target = before + NEIGHBOR_GAP_MINUTES
  else if (after !== undefined) target = after - NEIGHBOR_GAP_MINUTES
  else return undefined

  const snapped = Math.round(target / SNAP_MINUTES) * SNAP_MINUTES
  const clamped = Math.min(Math.max(snapped, clockMinutes(dayStart)), clockMinutes(dayEnd))
  return clockString(clamped)
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

  // An untimed card dropped among timed neighbours becomes timed: infer a start
  // time from where it landed (relative to those neighbours), independent of the
  // viewer's direction because the slot is read in canonical order. With no timed
  // neighbour to anchor against, fall through to the plain untimed reorder below.
  if (!isTimed(active)) {
    const byId = new Map(targetCards.map((c) => [c.id, c]))
    const neighbours = canonical
      .filter((id) => id !== activeId)
      .map((id) => byId.get(id))
      .filter((c): c is Card => c !== undefined)
    const insertIndex = canonical.indexOf(activeId)
    const { dayStart, dayEnd } = getTrip(doc)
    const time = deriveDropTime(neighbours, insertIndex, dayStart, dayEnd)
    if (time !== undefined) {
      updateCard(doc, activeId, { startTime: time, dayKey: targetDayKey })
      return
    }
  }

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

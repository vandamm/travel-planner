// Per-user time-direction view preference plus the helper that orders a day's
// cards for display.
//
// The direction (morning→evening top-to-bottom, or bottom-to-top) is a *local*
// view preference held in localStorage — it is deliberately NOT part of the
// synced Yjs doc, so each person sees their own direction without affecting the
// other. The ordering helper turns a day's cards into the order they should
// appear vertically given that direction.

import type { Card } from '../../data/schema'
import { sortCardsForColumn } from '../cards/cardSort'

/** 'down' = morning at the top (default); 'up' = morning at the bottom. */
export type TimeDirection = 'down' | 'up'

/** Default direction: morning→evening, top to bottom. */
export const DEFAULT_DIRECTION: TimeDirection = 'down'

/** localStorage key holding the per-user direction preference. */
export const TIME_DIRECTION_KEY = 'travel-planner:time-direction'

/** Vertical zone labels of the continuous time scale, morning→evening. */
export const TIME_SCALE = ['Morning', 'Evening'] as const

function isDirection(value: unknown): value is TimeDirection {
  return value === 'down' || value === 'up'
}

/** localStorage, treated as absent when unavailable (SSR, blocked cookies). */
function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined
  } catch {
    return undefined
  }
}

/** Read the saved direction, falling back to the default. */
export function loadTimeDirection(storage: Storage | undefined = safeStorage()): TimeDirection {
  const raw = storage?.getItem(TIME_DIRECTION_KEY)
  return isDirection(raw) ? raw : DEFAULT_DIRECTION
}

/** Persist the direction preference; a no-op when storage is unavailable. */
export function saveTimeDirection(
  direction: TimeDirection,
  storage: Storage | undefined = safeStorage(),
): void {
  storage?.setItem(TIME_DIRECTION_KEY, direction)
}

/** The opposite direction. */
export function toggleDirection(direction: TimeDirection): TimeDirection {
  return direction === 'down' ? 'up' : 'down'
}

/**
 * Canonical morning→evening order for a day's cards. The combined sort itself
 * lives in `cardSort.ts` (its definitive owner); this re-export keeps the board's
 * direction helpers importing from one place.
 */
export function canonicalCardOrder(cards: Card[]): Card[] {
  return sortCardsForColumn(cards)
}

/**
 * Order a day's cards for display in the given direction. 'down' yields the
 * canonical morning→evening order (top = morning); 'up' reverses it so morning
 * sits at the bottom. The reversal flips every card uniformly — timed and
 * untimed alike. Returns a new array; the input is untouched.
 */
export function orderCardsForDirection(cards: Card[], direction: TimeDirection): Card[] {
  const canonical = canonicalCardOrder(cards)
  return direction === 'up' ? canonical.reverse() : canonical
}

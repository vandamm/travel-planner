// Viewport breakpoint detection for the board. The board is laptop-first: at or
// above the laptop breakpoint it shows the multi-column day board; below it (a
// phone) it switches to the single-day swipe view. Which view to show is a
// per-device rendering concern, not synced state, so it lives here as a hook
// over `window.innerWidth` rather than in the doc.

import { useSyncExternalStore } from 'react'

export type Viewport = 'mobile' | 'desktop'

/**
 * Widths below this (px) get the mobile single-day view; at or above it, the
 * desktop multi-column board. 1024px is the conventional laptop breakpoint
 * (Tailwind's `lg`).
 */
export const LAPTOP_BREAKPOINT = 1024

/** Pure breakpoint decision, so it can be unit-tested without a DOM. */
export function selectViewport(width: number): Viewport {
  return width < LAPTOP_BREAKPOINT ? 'mobile' : 'desktop'
}

/** Day-column geometry (must match `DayColumn`'s `w-56`, the row's `gap-3`, and the pager's `px-4`).
 *  The single numeric source for the column width/gap — `multiWeekNav.ts` derives
 *  its scroll stride from these rather than restating the pixels. */
export const COLUMN_WIDTH_PX = 224 // w-56 = 14rem
export const COLUMN_GAP_PX = 12 // gap-3 = 0.75rem
const CONTAINER_PADDING_PX = 16 // px-4 = 1rem each side

/**
 * How many `w-56` day columns fit a viewport of `width` px — at least one, so
 * the narrow pager always shows a day. Pure, so it can be unit-tested.
 */
export function columnsThatFit(width: number): number {
  const available = width - 2 * CONTAINER_PADDING_PX
  const n = Math.floor((available + COLUMN_GAP_PX) / (COLUMN_WIDTH_PX + COLUMN_GAP_PX))
  return Math.max(1, n)
}

function getSnapshot(): Viewport {
  return selectViewport(typeof window !== 'undefined' ? window.innerWidth : LAPTOP_BREAKPOINT)
}

function getColumnsSnapshot(): number {
  return columnsThatFit(typeof window !== 'undefined' ? window.innerWidth : LAPTOP_BREAKPOINT)
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/**
 * Track the active viewport, re-rendering only when the window crosses the
 * breakpoint (the snapshot is the category, not the raw width, so
 * `useSyncExternalStore` skips re-renders for resizes within a category).
 * Falls back to 'desktop' during server rendering.
 */
export function useViewport(): Viewport {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'desktop')
}

/**
 * Track how many `w-56` day columns fit the window, re-rendering whenever the
 * count changes (resizes that don't change the count are skipped, since the
 * snapshot is the count). Falls back to one column during server rendering.
 */
export function useColumnsThatFit(): number {
  return useSyncExternalStore(subscribe, getColumnsSnapshot, () => 1)
}

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

function getSnapshot(): Viewport {
  return selectViewport(typeof window !== 'undefined' ? window.innerWidth : LAPTOP_BREAKPOINT)
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

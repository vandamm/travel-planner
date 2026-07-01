// Pure placement math for the anchored `Popover` (desktop path). Given the
// trigger's viewport rect, the panel's measured size, and the viewport, decide
// where to pin the panel (viewport-relative, for `position: fixed`) so it sits
// just below the trigger yet always stays fully in view. Kept DOM-free so it can
// be unit-tested without a browser.

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/**
 * Place the panel below the trigger, left-aligned, then clamp into the viewport
 * with a `margin` gutter. If it would overflow the bottom, flip above the
 * trigger; if it still doesn't fit either way, clamp to the nearest edge.
 */
export function popoverPosition(
  trigger: Rect,
  panel: Size,
  viewport: Size,
  margin = 8,
): { left: number; top: number } {
  // Horizontal: left-align to the trigger, then clamp within the viewport.
  const maxLeft = viewport.width - panel.width - margin
  const left = Math.max(margin, Math.min(trigger.left, maxLeft))

  // Vertical: prefer just below the trigger.
  const below = trigger.top + trigger.height + margin
  if (below + panel.height + margin <= viewport.height) {
    return { left, top: below }
  }
  // Doesn't fit below — try flipping above.
  const above = trigger.top - panel.height - margin
  if (above >= margin) {
    return { left, top: above }
  }
  // Fits neither: clamp to the nearest edge, keeping the top on-screen.
  const top = Math.max(margin, viewport.height - panel.height - margin)
  return { left, top }
}

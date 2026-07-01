// Whether to show the mobile timeline's "scroll for more" affordance for a
// scroll container: true only when the content overflows AND the viewport is not
// already at (within an epsilon of) the bottom. Pure and DOM-free — it takes the
// three metrics an `HTMLElement` exposes, so callers can pass the element itself
// (structural typing) and the logic stays unit-testable without a DOM.

export interface ScrollMetrics {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}

/** Slack (px) around the bottom so sub-pixel rounding doesn't pin the hint up. */
const BOTTOM_EPSILON = 2

export function showScrollHint({ scrollHeight, clientHeight, scrollTop }: ScrollMetrics): boolean {
  const overflowing = scrollHeight > clientHeight + BOTTOM_EPSILON
  const atBottom = scrollTop + clientHeight >= scrollHeight - BOTTOM_EPSILON
  return overflowing && !atBottom
}

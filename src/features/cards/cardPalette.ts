// How a card's category and ticket state turn into the v4 card treatment:
// a tinted body, a 3px left edge, and a type glyph — all in one accent hue —
// plus the corner ticket marker.
//
// Pure data + class lookups (no React), so the mapping is unit-testable and
// `Card.tsx` stays a renderer. Colours are token class names, never inline
// hexes, per the repo's styling rule.

import type { CardCategory, TicketState } from '../../data/schema'

export interface CategoryStyle {
  /** Body tint, hairline border and 3px left edge, all from one triad. */
  surface: string
  /** Stroke class for the inline type glyph. */
  glyph: string
  /** Accessible name for the glyph. */
  label: string
}

export const CATEGORY_STYLE: Record<CardCategory, CategoryStyle> = {
  indoor: {
    surface: 'bg-category-indoor-bg border-category-indoor-edge border-l-[3px] border-l-category-indoor',
    glyph: 'stroke-category-indoor',
    label: 'Sights',
  },
  food: {
    surface: 'bg-category-food-bg border-category-food-edge border-l-[3px] border-l-category-food',
    glyph: 'stroke-category-food',
    label: 'Food',
  },
  outdoor: {
    surface: 'bg-category-outdoor-bg border-category-outdoor-edge border-l-[3px] border-l-category-outdoor',
    glyph: 'stroke-category-outdoor',
    label: 'Outdoors',
  },
  transit: {
    surface: 'bg-category-transit-bg border-category-transit-edge border-l-[3px] border-l-category-transit',
    glyph: 'stroke-category-transit',
    label: 'Transport',
  },
}

/** An uncategorised card keeps the neutral surface — no tint, no left edge. */
export const UNCATEGORISED_SURFACE = 'bg-surface border-edge-100'

/**
 * The type-glyph geometry, as `<path>`/`<rect>` `d`/dimension data on a 24×24
 * viewBox. Outdoors is the stroked sun from the editor's type row rather than
 * the reference card's ☀️ emoji: the handoff README rules out emoji ("No raster
 * assets… Glyphs used are plain Unicode"), and a stroked glyph inherits the
 * category hue the way the other three do.
 */
export const CATEGORY_GLYPH: Record<CardCategory, { d: string; width: number }> = {
  indoor: { d: 'M4 12l8-8 8 8v8H4z', width: 2 },
  food: { d: 'M4 5h11v8a5.5 5.5 0 0 1-11 0zM15 7h2.5a2.75 2.75 0 0 1 0 5.5H15M3 21h13', width: 2 },
  outdoor: {
    d: 'M12 4.4V2.4M12 21.6v-2M4.4 12h-2M21.6 12h-2M7 7l-1.4-1.4M18.4 18.4 17 17M17 7l1.4-1.4M5.6 18.4 7 17',
    width: 1.9,
  },
  transit: { d: 'M5 3h14v13.5H5zM5.4 10.5h13.2M8.5 21l1.8-4.5M15.5 21l-1.8-4.5', width: 2 },
}

/**
 * Which ticket marker a card shows, if any.
 *
 * Only a card that actually has a ticket to think about is marked. The
 * reference draws a faint outline ticket for "none" as well, but that puts a
 * marker on *every* card — the common case, carrying no information — and the
 * corner reads as clutter rather than a signal. Transport is likewise never
 * marked: a train ticket is the activity, not something to buy alongside it.
 */
export function ticketMarkerState(
  ticketState: TicketState | undefined,
  category: CardCategory | undefined,
): Exclude<TicketState, 'none'> | undefined {
  if (category === 'transit') return undefined
  return ticketState === 'required' || ticketState === 'bought' ? ticketState : undefined
}

/**
 * A required-but-unbought ticket washes the whole card warm — over the category
 * tint, keeping the left edge — so it reads at a glance. Derived from data, not
 * set per card.
 */
export function isTicketWashed(
  ticketState: TicketState | undefined,
  category: CardCategory | undefined,
): boolean {
  return ticketMarkerState(ticketState, category) === 'required'
}

export const TICKET_WASH = 'bg-ticket-wash border-ticket-wash-edge'

/**
 * Cards at or under this height collapse to a single glyph + name + time row.
 *
 * This is a *pixel* threshold, not a duration, because it is about whether the
 * text fits: title (17) + gap (5) + time (12) + padding (16) needs ~50px. It
 * therefore holds regardless of {@link PX_PER_HOUR} — changing the scale changes
 * which durations collapse, not whether the rows would be legible.
 */
export const SHORT_CARD_PX = 50

export function isShortCard(heightPx: number | undefined): boolean {
  return heightPx !== undefined && heightPx <= SHORT_CARD_PX
}

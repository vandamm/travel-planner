// A card's travel lead-in: the time it takes to get there, counted *before* the
// start. A 09:00 activity with 45 travel minutes occupies 08:15–12:00.
//
// The lead-in is not decoration — it occupies timeline minutes, so the same
// numbers feed the band's geometry, the free-slot search (`timelineSlots.ts`)
// and the overlap check. Pure, so all three can never disagree.

import type { Card, Trip } from '../../data/schema'
import { SNAP_MINUTES, clockMinutes, clockString } from './cardHeight'

/** The lead-in moves in the same quarter-hours as everything else on the grid. */
export const TRAVEL_STEP_MINUTES = SNAP_MINUTES
/** What a freshly switched-on lead-in is worth when the trip names no default. */
export const DEFAULT_TRAVEL_MINUTES = 30

/**
 * Whether the board draws travel lead-ins at all. Absent reads as on: a doc
 * written before this feature existed should show the bands, not hide them.
 */
export function travelTimesShown(trip: Pick<Trip, 'showTravelTimes'>): boolean {
  return trip.showTravelTimes !== false
}

/** The trip's pre-fill for a newly switched-on lead-in. */
export function defaultTravelMinutes(trip: Pick<Trip, 'defaultTravelMinutes'>): number {
  const stored = trip.defaultTravelMinutes
  return typeof stored === 'number' && Number.isFinite(stored) && stored > 0
    ? stored
    : DEFAULT_TRAVEL_MINUTES
}

/**
 * How many timeline minutes this card's lead-in occupies above its start.
 *
 * Zero unless the card is *timed* — "counted before the start" needs a start to
 * count before — and unless the trip is showing travel times: switching them off
 * keeps every stored value but takes the lead-in back off the clock, which is
 * what "with it off there is no band to drag" means.
 */
export function travelLeadMinutes(card: Card, showTravelTimes: boolean): number {
  if (!showTravelTimes || !card.startTime) return 0
  const minutes = card.travelMinutes
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? minutes : 0
}

/** When to set off: the start, less the travel time. Undefined when either is missing. */
export function leaveByTime(card: Card): string | undefined {
  const minutes = travelLeadMinutes(card, true)
  if (!minutes || !card.startTime) return undefined
  return clockString(clockMinutes(card.startTime) - minutes)
}

/** '45 min' / '1h 30m' — the length on its own, without a noun. */
function travelDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** The hatched band's own label, e.g. '30 min travel'. */
export function travelBandLabel(minutes: number): string {
  return `${travelDuration(minutes)} travel`
}

/** The compact stand-in shown when travel times are switched off, e.g. '+45m'. */
export function travelBadgeLabel(minutes: number): string {
  if (minutes < 60) return `+${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `+${hours}h` : `+${hours}h ${rest}m`
}

/**
 * One press of the editor's − / + stepper. Snapped onto the quarter-hour grid
 * (so an off-grid value from an older doc joins it on first use) and floored at
 * one step — reaching zero is the toggle's job, not the stepper's.
 */
export function stepTravelMinutes(minutes: number, direction: -1 | 1): number {
  const snap = direction > 0 ? Math.floor : Math.ceil
  const next = snap(minutes / TRAVEL_STEP_MINUTES) * TRAVEL_STEP_MINUTES + direction * TRAVEL_STEP_MINUTES
  return Math.max(TRAVEL_STEP_MINUTES, next)
}

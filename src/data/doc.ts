// The Yjs document shape and the *only* sanctioned mutators for it.
//
// Both the client and the Cloudflare Worker import this module, so the agent
// API and the UI mutate the doc the same way and can never drift. The document
// is the single source of truth; every write goes through a mutator here.
//
// Layout (all top-level containers on one shared `Y.Doc`):
//   trip            Y.Map  — title / startDate / endDate (plain values)
//   cities          Y.Map<Y.Map>  — id → { id, name, color }
//   dayOverrides    Y.Map  — 'YYYY-MM-DD' → cityId (manual per-day city)
//   cards           Y.Map<Y.Map>  — id → Card fields
//   accommodations  Y.Map<Y.Map>  — id → Accommodation fields
//
// Entities are stored as *nested* `Y.Map`s (not plain objects) so concurrent
// edits to different fields of the same entity merge field-by-field instead of
// clobbering one another — the whole point of using a CRDT.

import * as Y from 'yjs'
import type { Accommodation, Card, CardCategory, CardSize, City, Trip } from './schema'

const TRIP = 'trip'
const CITIES = 'cities'
const DAY_OVERRIDES = 'dayOverrides'
const CARDS = 'cards'
const ACCOMMODATIONS = 'accommodations'

const DEFAULT_TRIP: Trip = {
  title: '',
  startDate: '',
  endDate: '',
  dayStart: '06:00',
  dayEnd: '21:00',
}

/** Generate an id, preferring WebCrypto's UUID when present (browser/Worker). */
function newId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  // Fallback for the rare runtime without `crypto.randomUUID` (some test envs).
  return `id-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

/** A top-level container of nested entity maps, keyed by entity id. */
function entityMap(doc: Y.Doc, key: string): Y.Map<Y.Map<unknown>> {
  return doc.getMap(key) as Y.Map<Y.Map<unknown>>
}

/** Build a `Y.Map` from a plain object, skipping `undefined` fields. */
function toYMap(obj: object): Y.Map<unknown> {
  const map = new Y.Map<unknown>()
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) map.set(k, v)
  }
  return map
}

/**
 * Apply a partial patch to a nested entity map. An explicit `undefined` value
 * *clears* that field (e.g. untiming a card); absent keys are left untouched.
 */
function patchYMap(map: Y.Map<unknown>, patch: object): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) map.delete(k)
    else map.set(k, v)
  }
}

// --- Whole-document reset --------------------------------------------------

/**
 * Remove every entity and reset trip settings. Used before applying an
 * imported or agent-supplied trip so the apply is a full *replace* (not a
 * field-by-field merge). Runs in a single transaction so the wipe-and-refill
 * lands as one atomic update for local persistence and remote sync.
 */
export function clearTrip(doc: Y.Doc): void {
  doc.transact(() => {
    doc.getMap(TRIP).clear()
    entityMap(doc, CITIES).clear()
    doc.getMap(DAY_OVERRIDES).clear()
    entityMap(doc, CARDS).clear()
    entityMap(doc, ACCOMMODATIONS).clear()
  })
}

// --- Trip ------------------------------------------------------------------

export function getTrip(doc: Y.Doc): Trip {
  const m = doc.getMap(TRIP)
  return {
    title: (m.get('title') as string | undefined) ?? DEFAULT_TRIP.title,
    startDate: (m.get('startDate') as string | undefined) ?? DEFAULT_TRIP.startDate,
    endDate: (m.get('endDate') as string | undefined) ?? DEFAULT_TRIP.endDate,
    dayStart: (m.get('dayStart') as string | undefined) ?? DEFAULT_TRIP.dayStart,
    dayEnd: (m.get('dayEnd') as string | undefined) ?? DEFAULT_TRIP.dayEnd,
  }
}

export function setTrip(doc: Y.Doc, patch: Partial<Trip>): void {
  const m = doc.getMap(TRIP)
  doc.transact(() => {
    if (patch.title !== undefined) m.set('title', patch.title)
    if (patch.startDate !== undefined || patch.endDate !== undefined) {
      const current = getTrip(doc)
      const startDate = patch.startDate ?? current.startDate
      const endDate = patch.endDate ?? current.endDate
      // Keep live picker edits exportable. A user can move an existing range by
      // changing the non-reversing bound first; blank setup fields stay allowed.
      if (!startDate || !endDate || endDate >= startDate) {
        if (patch.startDate !== undefined) m.set('startDate', startDate)
        if (patch.endDate !== undefined) m.set('endDate', endDate)
      }
    }
    // The day window must stay non-empty (dayEnd > dayStart, comparing 'HH:mm'
    // lexicographically) — `tripDocumentSchema` refines on it, so an inverted
    // window in the doc would make `exportTrip`/agent-GET throw. Resolve the
    // candidate against the current values and only write when valid, so the doc
    // can never hold a window export rejects. ponytail: a single-field edit that would invert is dropped (input
    // snaps back); edit the other bound first to move the whole window past it.
    if (patch.dayStart !== undefined || patch.dayEnd !== undefined) {
      const current = getTrip(doc)
      const dayStart = patch.dayStart ?? current.dayStart
      const dayEnd = patch.dayEnd ?? current.dayEnd
      if (dayEnd > dayStart) {
        if (patch.dayStart !== undefined) m.set('dayStart', dayStart)
        if (patch.dayEnd !== undefined) m.set('dayEnd', dayEnd)
      }
    }
  })
}

// --- Cities ----------------------------------------------------------------

export interface NewCity {
  name: string
  color: string
  /** Optional caller-supplied id; one is generated when omitted. */
  id?: string
}

export function listCities(doc: Y.Doc): City[] {
  return [...entityMap(doc, CITIES).values()].map((m) => m.toJSON() as City)
}

export function addCity(doc: Y.Doc, input: NewCity): City {
  const id = input.id ?? newId()
  const city: City = { id, name: input.name, color: input.color }
  doc.transact(() => entityMap(doc, CITIES).set(id, toYMap(city)))
  return city
}

export function updateCity(doc: Y.Doc, id: string, patch: Partial<Omit<City, 'id'>>): void {
  const m = entityMap(doc, CITIES).get(id)
  if (!m) return
  doc.transact(() => patchYMap(m, patch))
}

export function removeCity(doc: Y.Doc, id: string): void {
  doc.transact(() => {
    entityMap(doc, CITIES).delete(id)
    // Prune dangling references so the deleted city leaves no orphan behind: a
    // day override or accommodation `cityId` pointing at a missing city would
    // silently resolve to "no city" yet persist and round-trip through export.
    const overrides = doc.getMap(DAY_OVERRIDES)
    for (const [dayKey, cityId] of [...overrides.entries()]) {
      if (cityId === id) overrides.delete(dayKey)
    }
    for (const acc of entityMap(doc, ACCOMMODATIONS).values()) {
      if (acc.get('cityId') === id) acc.delete('cityId')
    }
  })
}

// --- Cards -----------------------------------------------------------------

export interface NewCard {
  dayKey: string
  title: string
  note?: string
  link?: string
  startTime?: string
  endTime?: string
  /** Manual order; defaults to the end of the target day when omitted. */
  order?: number
  color?: string
  icon?: string
  transport?: boolean
  category?: CardCategory
  size?: CardSize
  id?: string
}

export function listCards(doc: Y.Doc): Card[] {
  return [...entityMap(doc, CARDS).values()].map((m) => m.toJSON() as Card)
}

/** Cards for one day, sorted by manual `order` (timed sorting lives in Task 6). */
export function listCardsForDay(doc: Y.Doc, dayKey: string): Card[] {
  return listCards(doc)
    .filter((c) => c.dayKey === dayKey)
    .sort((a, b) => a.order - b.order)
}

export function getCard(doc: Y.Doc, id: string): Card | undefined {
  const m = entityMap(doc, CARDS).get(id)
  return m ? (m.toJSON() as Card) : undefined
}

/** Next free `order` value at the end of a day (max existing order + 1). */
function nextOrder(doc: Y.Doc, dayKey: string): number {
  return (
    listCards(doc)
      .filter((c) => c.dayKey === dayKey)
      .reduce((max, c) => Math.max(max, c.order), -1) + 1
  )
}

export function addCard(doc: Y.Doc, input: NewCard): Card {
  const id = input.id ?? newId()
  const order = input.order ?? nextOrder(doc, input.dayKey)
  const card: Card = {
    id,
    dayKey: input.dayKey,
    title: input.title,
    order,
    ...(input.note !== undefined && { note: input.note }),
    ...(input.link !== undefined && { link: input.link }),
    ...(input.startTime !== undefined && { startTime: input.startTime }),
    ...(input.endTime !== undefined && { endTime: input.endTime }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.icon !== undefined && { icon: input.icon }),
    ...(input.transport !== undefined && { transport: input.transport }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.size !== undefined && { size: input.size }),
  }
  doc.transact(() => entityMap(doc, CARDS).set(id, toYMap(card)))
  return card
}

export function updateCard(doc: Y.Doc, id: string, patch: Partial<Omit<Card, 'id'>>): void {
  const m = entityMap(doc, CARDS).get(id)
  if (!m) return
  doc.transact(() => patchYMap(m, patch))
}

/**
 * Move a card to another day. With no explicit `order` it is appended to the
 * end of the target day.
 */
export function moveCard(doc: Y.Doc, id: string, toDayKey: string, order?: number): void {
  const m = entityMap(doc, CARDS).get(id)
  if (!m) return
  const nextPos = order ?? nextOrder(doc, toDayKey)
  doc.transact(() => {
    m.set('dayKey', toDayKey)
    m.set('order', nextPos)
  })
}

/**
 * Reorder cards within a day to match `orderedIds`. Each listed card has its
 * `order` set to its index and is (re)assigned to `dayKey`.
 */
export function reorderCards(doc: Y.Doc, dayKey: string, orderedIds: string[]): void {
  const cards = entityMap(doc, CARDS)
  doc.transact(() => {
    orderedIds.forEach((id, index) => {
      const m = cards.get(id)
      if (!m) return
      m.set('dayKey', dayKey)
      m.set('order', index)
    })
  })
}

export function removeCard(doc: Y.Doc, id: string): void {
  doc.transact(() => entityMap(doc, CARDS).delete(id))
}

// --- Per-day city overrides ------------------------------------------------

export function setDayCityOverride(doc: Y.Doc, dayKey: string, cityId: string | null): void {
  const m = doc.getMap(DAY_OVERRIDES)
  doc.transact(() => {
    if (cityId === null) m.delete(dayKey)
    else m.set(dayKey, cityId)
  })
}

export function getDayOverride(doc: Y.Doc, dayKey: string): string | undefined {
  return doc.getMap(DAY_OVERRIDES).get(dayKey) as string | undefined
}

export function listDayOverrides(doc: Y.Doc): Record<string, string> {
  return doc.getMap(DAY_OVERRIDES).toJSON() as Record<string, string>
}

// --- Accommodations --------------------------------------------------------

export interface NewAccommodation {
  label: string
  cityId?: string
  startNight: string
  endNight: string
  id?: string
}

export function listAccommodations(doc: Y.Doc): Accommodation[] {
  return [...entityMap(doc, ACCOMMODATIONS).values()].map((m) => m.toJSON() as Accommodation)
}

export function getAccommodation(doc: Y.Doc, id: string): Accommodation | undefined {
  const m = entityMap(doc, ACCOMMODATIONS).get(id)
  return m ? (m.toJSON() as Accommodation) : undefined
}

export function addAccommodation(doc: Y.Doc, input: NewAccommodation): Accommodation {
  const id = input.id ?? newId()
  const acc: Accommodation = {
    id,
    label: input.label,
    startNight: input.startNight,
    endNight: input.endNight,
    ...(input.cityId !== undefined && { cityId: input.cityId }),
  }
  doc.transact(() => entityMap(doc, ACCOMMODATIONS).set(id, toYMap(acc)))
  return acc
}

export function updateAccommodation(
  doc: Y.Doc,
  id: string,
  patch: Partial<Omit<Accommodation, 'id'>>,
): void {
  const m = entityMap(doc, ACCOMMODATIONS).get(id)
  if (!m) return
  doc.transact(() => patchYMap(m, patch))
}

export function removeAccommodation(doc: Y.Doc, id: string): void {
  doc.transact(() => entityMap(doc, ACCOMMODATIONS).delete(id))
}

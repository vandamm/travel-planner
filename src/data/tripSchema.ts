// The zod schema for a whole trip — the single source of truth for the
// import/export JSON *and* the Worker's agent API. The client and the Worker
// both validate against this exact schema, so a trip an agent POSTs and a trip
// a human imports are held to identical rules and can never drift.
//
// Field semantics mirror `schema.ts` (the plain-JS domain types): calendar
// dates are ISO 'YYYY-MM-DD' and clock times are 'HH:mm'. The collections are
// optional on input (a minimal document is just `trip`) and default to empty,
// so `tripDocumentSchema.parse` always yields a fully-populated `TripDocument`.

import { isValid, parseISO } from 'date-fns'
import { z } from 'zod'
import { MAX_TRIP_DAYS } from './days'

/**
 * ISO-8601 date-only, 'YYYY-MM-DD'. The regex only checks shape, so a real
 * calendar check follows: an impossible date like '2027-99-99' or '2027-02-30'
 * matches the pattern yet would make `generateDays`' `parseISO`/`format` throw a
 * `RangeError` when the board renders. Reject it at the boundary instead.
 */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
  .refine((s) => isValid(parseISO(s)), 'Expected a real calendar date')
/** 24-hour clock time, 'HH:mm'. */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time as HH:mm')
/**
 * A web link: empty (cleared) or an http(s) URL. Rejecting other schemes here
 * keeps a dangerous `javascript:`/`data:` URI out of the doc at the import and
 * agent-API boundary; the card renderer guards the same way as defence in depth.
 */
const webLink = z
  .string()
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Expected an http(s) URL')

export const tripSettingsSchema = z.object({
  title: z.string(),
  // Empty while the trip is not yet set up; otherwise a calendar date.
  startDate: z.union([dateOnly, z.literal('')]),
  // Bounded so an oversized count can't generate an unbounded board (see days.ts).
  numDays: z.number().int().min(0).max(MAX_TRIP_DAYS),
})

export const citySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().min(1),
})

export const accommodationSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    cityId: z.string().optional(),
    startNight: dateOnly,
    endNight: dateOnly,
  })
  // Inclusive night span: the last night must not precede the first. ISO
  // date-only strings compare correctly lexicographically. An inverted span
  // would otherwise validate yet render no bar and color no day.
  .refine((a) => a.endNight >= a.startNight, {
    message: 'endNight must be on or after startNight',
    path: ['endNight'],
  })

export const cardSchema = z.object({
  id: z.string().min(1),
  dayKey: dateOnly,
  title: z.string(),
  note: z.string().optional(),
  link: webLink.optional(),
  startTime: clockTime.optional(),
  endTime: clockTime.optional(),
  order: z.number().int(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

// Entities are keyed by `id` on apply (into `Y.Map`s), so a duplicate id would
// silently overwrite an earlier entity and lose it. Reject duplicates here so
// the loss surfaces as a clear validation error at the import / agent boundary.
const uniqueIds = (items: { id: string }[]) =>
  new Set(items.map((i) => i.id)).size === items.length
const DUPLICATE_ID = 'Duplicate id — entity ids must be unique'

export const tripDocumentSchema = z
  .object({
    trip: tripSettingsSchema,
    cities: z.array(citySchema).refine(uniqueIds, DUPLICATE_ID).default([]),
    accommodations: z.array(accommodationSchema).refine(uniqueIds, DUPLICATE_ID).default([]),
    cards: z.array(cardSchema).refine(uniqueIds, DUPLICATE_ID).default([]),
    // dayKey → cityId.
    dayOverrides: z.record(z.string(), z.string()).default({}),
  })
  // Referential integrity: every accommodation/override cityId must name a city
  // in `cities`. `removeCity` cascades to prevent dangling references (see
  // doc.ts / CLAUDE.md); enforce the same invariant at the import/agent boundary
  // so a payload can't write the orphan the delete path is careful to avoid.
  .superRefine((document, ctx) => {
    const cityIds = new Set(document.cities.map((c) => c.id))
    document.accommodations.forEach((acc, i) => {
      if (acc.cityId !== undefined && !cityIds.has(acc.cityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['accommodations', i, 'cityId'],
          message: `Unknown cityId '${acc.cityId}' — no matching city`,
        })
      }
    })
    for (const [dayKey, cityId] of Object.entries(document.dayOverrides)) {
      if (!cityIds.has(cityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dayOverrides', dayKey],
          message: `Unknown cityId '${cityId}' — no matching city`,
        })
      }
    }
  })

/** A complete, validated trip document — the shape exported and imported. */
export type TripDocument = z.infer<typeof tripDocumentSchema>

/** Render a zod error as a readable, path-prefixed list of problems. */
export function formatTripErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join('.') || '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

export type ParseTripResult =
  | { ok: true; data: TripDocument }
  | { ok: false; error: string }

/**
 * Parse JSON *text* and validate it against the schema, returning a friendly
 * result either way: malformed JSON and schema violations both surface as a
 * single readable `error` string (used by the import UI).
 */
export function parseTripText(text: string): ParseTripResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` }
  }
  const result = tripDocumentSchema.safeParse(json)
  if (!result.success) return { ok: false, error: formatTripErrors(result.error) }
  return { ok: true, data: result.data }
}

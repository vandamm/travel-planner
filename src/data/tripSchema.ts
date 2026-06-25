// The zod schema for a whole trip — the single source of truth for the
// import/export JSON *and* the Worker's agent API. The client and the Worker
// both validate against this exact schema, so a trip an agent POSTs and a trip
// a human imports are held to identical rules and can never drift.
//
// Field semantics mirror `schema.ts` (the plain-JS domain types): calendar
// dates are ISO 'YYYY-MM-DD' and clock times are 'HH:mm'. The collections are
// optional on input (a minimal document is just `trip`) and default to empty,
// so `tripDocumentSchema.parse` always yields a fully-populated `TripDocument`.

import { z } from 'zod'

/** ISO-8601 date-only, 'YYYY-MM-DD'. */
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as YYYY-MM-DD')
/** 24-hour clock time, 'HH:mm'. */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a time as HH:mm')

export const tripSettingsSchema = z.object({
  title: z.string(),
  // Empty while the trip is not yet set up; otherwise a calendar date.
  startDate: z.union([dateOnly, z.literal('')]),
  numDays: z.number().int().min(0),
})

export const citySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  color: z.string().min(1),
})

export const accommodationSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  cityId: z.string().optional(),
  startNight: dateOnly,
  endNight: dateOnly,
})

export const cardSchema = z.object({
  id: z.string().min(1),
  dayKey: dateOnly,
  title: z.string(),
  note: z.string().optional(),
  link: z.string().optional(),
  startTime: clockTime.optional(),
  endTime: clockTime.optional(),
  order: z.number().int(),
  color: z.string().optional(),
  icon: z.string().optional(),
})

export const tripDocumentSchema = z.object({
  trip: tripSettingsSchema,
  cities: z.array(citySchema).default([]),
  accommodations: z.array(accommodationSchema).default([]),
  cards: z.array(cardSchema).default([]),
  // dayKey → cityId.
  dayOverrides: z.record(z.string(), z.string()).default({}),
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

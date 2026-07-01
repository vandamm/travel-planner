import { describe, expect, it } from 'vitest'
import { MAX_TRIP_DAYS } from './days'
import { parseTripText, tripDocumentSchema } from './tripSchema'

const VALID = {
  trip: { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3, dayStart: '06:00', dayEnd: '21:00' },
  cities: [{ id: 'rome', name: 'Rome', color: '#ef4444' }],
  accommodations: [
    { id: 'stay-1', label: 'Hotel Roma', cityId: 'rome', startNight: '2027-05-01', endNight: '2027-05-02' },
  ],
  cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
  dayOverrides: { '2027-05-03': 'rome' },
}

describe('tripDocumentSchema', () => {
  it('accepts a complete, well-formed trip document', () => {
    const parsed = tripDocumentSchema.parse(VALID)
    expect(parsed).toEqual(VALID)
  })

  it('fills empty defaults for the optional collections and day window', () => {
    const parsed = tripDocumentSchema.parse({
      trip: { title: '', startDate: '', numDays: 0 },
    })
    expect(parsed).toEqual({
      trip: { title: '', startDate: '', numDays: 0, dayStart: '06:00', dayEnd: '21:00' },
      cities: [],
      accommodations: [],
      cards: [],
      dayOverrides: {},
    })
  })

  it('keeps an explicit day window and rejects a malformed one', () => {
    const parsed = tripDocumentSchema.parse({
      trip: { title: 'X', startDate: '2027-05-01', numDays: 1, dayStart: '07:30', dayEnd: '22:00' },
    })
    expect(parsed.trip).toMatchObject({ dayStart: '07:30', dayEnd: '22:00' })

    expect(
      tripDocumentSchema.safeParse({
        trip: { title: 'X', startDate: '2027-05-01', numDays: 1, dayStart: '6am', dayEnd: '21:00' },
      }).success,
    ).toBe(false)
  })

  it('rejects a day window whose end is not after its start', () => {
    const result = tripDocumentSchema.safeParse({
      trip: { title: 'X', startDate: '2027-05-01', numDays: 1, dayStart: '21:00', dayEnd: '06:00' },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['trip', 'dayEnd'])
  })

  it('accepts a card flagged as transport', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'Flight', order: 0, transport: true }],
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.cards[0].transport).toBe(true)
  })

  it('accepts a card category enum and rejects a bad value', () => {
    for (const category of ['indoor', 'outdoor', 'transit']) {
      const ok = tripDocumentSchema.safeParse({
        ...VALID,
        cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'X', order: 0, category }],
      })
      expect(ok.success).toBe(true)
      if (ok.success) expect(ok.data.cards[0].category).toBe(category)
    }

    const bad = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'X', order: 0, category: 'museum' }],
    })
    expect(bad.success).toBe(false)
  })

  it('rejects a card with a malformed date and points at the offending path', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [{ id: 'card-1', dayKey: '05/01/2027', title: 'Bad', order: 0 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['cards', 0, 'dayKey'])
    }
  })

  it('rejects a date that matches the pattern but is not a real calendar date', () => {
    // Would otherwise pass the regex yet make generateDays' parseISO/format throw.
    for (const bad of ['2027-99-99', '2027-02-30', '2027-13-01']) {
      const result = tripDocumentSchema.safeParse({
        trip: { title: 'X', startDate: bad, numDays: 1 },
      })
      expect(result.success).toBe(false)
    }
  })

  it('rejects duplicate ids within a collection (silent overwrite on apply)', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [
        { id: 'dup', dayKey: '2027-05-01', title: 'A', order: 0 },
        { id: 'dup', dayKey: '2027-05-01', title: 'B', order: 1 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a card time that is not HH:mm', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'X', order: 0, startTime: '9am' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a negative day count', () => {
    const result = tripDocumentSchema.safeParse({
      trip: { title: 'X', startDate: '2027-05-01', numDays: -1 },
    })
    expect(result.success).toBe(false)
  })

  it('accepts a day count at the maximum but rejects one beyond it', () => {
    expect(
      tripDocumentSchema.safeParse({
        trip: { title: 'X', startDate: '2027-05-01', numDays: MAX_TRIP_DAYS },
      }).success,
    ).toBe(true)
    expect(
      tripDocumentSchema.safeParse({
        trip: { title: 'X', startDate: '2027-05-01', numDays: MAX_TRIP_DAYS + 1 },
      }).success,
    ).toBe(false)
  })

  it('rejects an accommodation whose endNight precedes its startNight', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      accommodations: [
        { id: 'stay-1', label: 'Hotel', startNight: '2027-05-03', endNight: '2027-05-01' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['accommodations', 0, 'endNight'])
  })

  it('accepts an accommodation whose endNight equals its startNight (single night)', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      accommodations: [
        { id: 'stay-1', label: 'Hotel', startNight: '2027-05-01', endNight: '2027-05-01' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an accommodation cityId that names no city (would dangle on apply)', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      accommodations: [
        { id: 'stay-1', label: 'Hotel', cityId: 'ghost', startNight: '2027-05-01', endNight: '2027-05-02' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['accommodations', 0, 'cityId'])
  })

  it('rejects a dayOverride pointing at a city that does not exist', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      dayOverrides: { '2027-05-02': 'ghost' },
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['dayOverrides', '2027-05-02'])
  })

  it('rejects a card link with a non-http(s) scheme', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [
        { id: 'card-1', dayKey: '2027-05-01', title: 'X', order: 0, link: 'javascript:alert(1)' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path).toEqual(['cards', 0, 'link'])
  })

  it('accepts an http(s) card link', () => {
    const result = tripDocumentSchema.safeParse({
      ...VALID,
      cards: [
        { id: 'card-1', dayKey: '2027-05-01', title: 'X', order: 0, link: 'https://example.com' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('parseTripText', () => {
  it('parses and validates well-formed JSON text', () => {
    const out = parseTripText(JSON.stringify(VALID))
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.data.trip.title).toBe('Italy 2027')
  })

  it('reports malformed JSON with a clear error', () => {
    const out = parseTripText('{ not json')
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error).toMatch(/Invalid JSON/i)
  })

  it('reports a schema violation with the offending field path', () => {
    const out = parseTripText(JSON.stringify({ trip: { title: 'X', startDate: 'nope', numDays: 1 } }))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error).toMatch(/trip\.startDate/)
  })
})

import { describe, expect, it } from 'vitest'
import { generateDays } from '../../data/days'
import type { Accommodation } from '../../data/schema'
import { accommodationColumnSpan, packAccommodations } from './accommodationSpan'

const days = generateDays('2027-05-01', 5) // 05-01 … 05-05

const stay = (over: Partial<Accommodation> = {}): Accommodation => ({
  id: 'a',
  label: 'Hotel',
  cityId: 'rome',
  startNight: '2027-05-01',
  endNight: '2027-05-02',
  ...over,
})

describe('accommodationColumnSpan', () => {
  it('spans the columns whose nights the stay covers', () => {
    const span = accommodationColumnSpan(days, stay({ startNight: '2027-05-02', endNight: '2027-05-04' }))
    expect(span).toEqual({ startIndex: 1, span: 3, clippedStart: false, clippedEnd: false })
  })

  it('covers a single column for a one-night stay', () => {
    const span = accommodationColumnSpan(days, stay({ startNight: '2027-05-03', endNight: '2027-05-03' }))
    expect(span).toMatchObject({ startIndex: 2, span: 1 })
  })

  it('returns null for a stay entirely outside the visible days', () => {
    expect(accommodationColumnSpan(days, stay({ startNight: '2027-06-01', endNight: '2027-06-03' }))).toBeNull()
    expect(accommodationColumnSpan(days, stay({ startNight: '2027-04-01', endNight: '2027-04-03' }))).toBeNull()
  })

  it('clamps to the visible range and flags clipping at both ends', () => {
    const span = accommodationColumnSpan(days, stay({ startNight: '2027-04-29', endNight: '2027-05-09' }))
    expect(span).toEqual({ startIndex: 0, span: 5, clippedStart: true, clippedEnd: true })
  })

  it('returns null when there are no days', () => {
    expect(accommodationColumnSpan([], stay())).toBeNull()
  })
})

describe('packAccommodations', () => {
  it('keeps non-overlapping stays on a single row', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'b', startNight: '2027-05-03', endNight: '2027-05-04' }),
    ])
    expect(placed.map((p) => [p.accommodation.id, p.row])).toEqual([
      ['a', 0],
      ['b', 0],
    ])
  })

  it('stacks two genuinely-overlapping stays (share >1 night) on separate rows', () => {
    // They share 05-02 and 05-03 — more than a changeover boundary — so they
    // genuinely conflict and stack. (A bare changeover would chain on one row.)
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-03' }),
      stay({ id: 'b', startNight: '2027-05-02', endNight: '2027-05-04' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect(byId.a).toMatchObject({ row: 0 })
    expect(byId.b).toMatchObject({ row: 1 })
    expect([byId.a.half, byId.b.half]).toEqual([undefined, undefined])
  })

  it('splits two stays covering the same columns, earlier left / later right', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'b', label: 'B', startNight: '2027-05-02', endNight: '2027-05-04' }),
      stay({ id: 'a', label: 'A', startNight: '2027-05-02', endNight: '2027-05-04' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    // Tie on startNight → label breaks it: 'A' is earlier (left), 'B' is later (right).
    expect(byId.a).toMatchObject({ row: 0, half: 'left' })
    expect(byId.b).toMatchObject({ row: 0, half: 'right' })
  })

  it('falls back to stacked rows for three or more genuinely-overlapping stays', () => {
    // All three start on 05-01 and overlap fully — no changeover boundary — so
    // they stack on three rows.
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-03' }),
      stay({ id: 'b', startNight: '2027-05-01', endNight: '2027-05-04' }),
      stay({ id: 'c', startNight: '2027-05-01', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect(byId.a).toMatchObject({ row: 0 })
    expect(byId.b).toMatchObject({ row: 1 })
    expect(byId.c).toMatchObject({ row: 2 })
    expect([byId.a.half, byId.b.half, byId.c.half]).toEqual([undefined, undefined, undefined])
  })

  it('splits one same-column pair while leaving a separate stay un-split', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'a', label: 'A', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'b', label: 'B', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'c', startNight: '2027-05-05', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect(byId.a).toMatchObject({ row: 0, half: 'left' })
    expect(byId.b).toMatchObject({ row: 0, half: 'right' })
    expect(byId.c).toMatchObject({ row: 0 })
    expect(byId.c.half).toBeUndefined()
  })

  it('leaves a single stay un-split', () => {
    const [p] = packAccommodations(days, [stay({ id: 'a' })])
    expect(p.half).toBeUndefined()
  })

  it('drops stays that fall outside the visible days', () => {
    const placed = packAccommodations(days, [stay({ id: 'x', startNight: '2030-01-01', endNight: '2030-01-02' })])
    expect(placed).toEqual([])
  })

  it('chains a changeover pair on one row with half insets meeting mid-day', () => {
    // A checks out on 05-03, B checks in on 05-03 — they share only that day.
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-03' }),
      stay({ id: 'b', startNight: '2027-05-03', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect(byId.a).toMatchObject({ row: 0, endHalf: true })
    expect(byId.b).toMatchObject({ row: 0, startHalf: true })
    expect(byId.a.startHalf).toBeUndefined()
    expect(byId.b.endHalf).toBeUndefined()
    // A changeover is not the same as a left/right split.
    expect([byId.a.half, byId.b.half]).toEqual([undefined, undefined])
  })

  it('stacks a genuine multi-night overlap on separate rows', () => {
    // A(05-01..05-04) and B(05-02..05-05) share 3 nights — not just a changeover.
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-04' }),
      stay({ id: 'b', startNight: '2027-05-02', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect(byId.a).toMatchObject({ row: 0 })
    expect(byId.b).toMatchObject({ row: 1 })
    expect([byId.a.startHalf, byId.a.endHalf, byId.b.startHalf, byId.b.endHalf]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it('chains three consecutive changeover stays on one row', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'b', startNight: '2027-05-02', endNight: '2027-05-04' }),
      stay({ id: 'c', startNight: '2027-05-04', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect(byId.a).toMatchObject({ row: 0, endHalf: true })
    expect(byId.b).toMatchObject({ row: 0, startHalf: true, endHalf: true })
    expect(byId.c).toMatchObject({ row: 0, startHalf: true })
  })

  it('stacks a one-night stay sandwiched between two changeovers instead of collapsing it', () => {
    // A checks out 05-03, B is a single night on 05-03, C checks in 05-03 — all
    // three claim 05-03. A span-1 B can't be both startHalf and endHalf on one
    // column (that renders negative-width) and must not share B's column with C,
    // so the genuine triple-claim stacks rather than chaining on row 0.
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-03' }),
      stay({ id: 'b', label: 'B', startNight: '2027-05-03', endNight: '2027-05-03' }),
      stay({ id: 'c', label: 'C', startNight: '2027-05-03', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    // No bar is ever both startHalf and endHalf on a single column.
    for (const p of placed) expect(p.span === 1 && p.startHalf && p.endHalf).toBeFalsy()
    expect(byId.a).toMatchObject({ row: 0, endHalf: true })
    expect(byId.b).toMatchObject({ row: 0, startHalf: true })
    expect(byId.b.endHalf).toBeUndefined()
    // C shares B's start column, so it must stack on a different row, not collide.
    expect(byId.c.row).not.toBe(byId.b.row)
  })

  it('leaves non-adjacent stays unchanged (no halves)', () => {
    const placed = packAccommodations(days, [
      stay({ id: 'a', startNight: '2027-05-01', endNight: '2027-05-02' }),
      stay({ id: 'b', startNight: '2027-05-04', endNight: '2027-05-05' }),
    ])
    const byId = Object.fromEntries(placed.map((p) => [p.accommodation.id, p]))
    expect([byId.a.startHalf, byId.a.endHalf, byId.b.startHalf, byId.b.endHalf]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })
})

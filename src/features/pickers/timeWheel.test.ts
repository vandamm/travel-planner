import { describe, expect, it } from 'vitest'
import { HOURS, MINUTES, formatTime, parseTime, snapTime } from './timeWheel'

describe('value lists', () => {
  it('lists all 24 hours, zero-padded', () => {
    expect(HOURS).toHaveLength(24)
    expect(HOURS[0]).toBe('00')
    expect(HOURS.at(-1)).toBe('23')
  })

  it('lists all 60 minutes, zero-padded', () => {
    expect(MINUTES).toHaveLength(60)
    expect(MINUTES[0]).toBe('00')
    expect(MINUTES.at(-1)).toBe('59')
  })
})

describe('parseTime', () => {
  it('parses a valid 24h HH:mm', () => {
    expect(parseTime('09:30')).toEqual({ hour: 9, minute: 30 })
    expect(parseTime('00:00')).toEqual({ hour: 0, minute: 0 })
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 })
  })

  it('returns null for empty or malformed input', () => {
    expect(parseTime(undefined)).toBeNull()
    expect(parseTime('')).toBeNull()
    expect(parseTime('9am')).toBeNull()
    expect(parseTime('9:5')).toBeNull()
  })

  it('returns null for out-of-range values', () => {
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('12:60')).toBeNull()
  })
})

describe('formatTime round-trip', () => {
  it('pads parts back to HH:mm', () => {
    expect(formatTime({ hour: 9, minute: 5 })).toBe('09:05')
    expect(formatTime({ hour: 0, minute: 0 })).toBe('00:00')
  })

  it('round-trips a parsed value unchanged', () => {
    expect(formatTime(parseTime('07:45')!)).toBe('07:45')
  })
})

describe('snapTime', () => {
  it('leaves valid parts unchanged', () => {
    expect(snapTime({ hour: 9, minute: 30 })).toEqual({ hour: 9, minute: 30 })
  })

  it('clamps out-of-range parts to the nearest valid cell', () => {
    expect(snapTime({ hour: 25, minute: 70 })).toEqual({ hour: 23, minute: 59 })
    expect(snapTime({ hour: -1, minute: -5 })).toEqual({ hour: 0, minute: 0 })
  })

  it('rounds fractional parts to a whole cell', () => {
    expect(snapTime({ hour: 9.4, minute: 30.6 })).toEqual({ hour: 9, minute: 31 })
  })
})

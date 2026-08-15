import { describe, expect, it } from 'vitest'
import type { Card, Trip } from '../../data/schema'
import {
  DEFAULT_TRAVEL_MINUTES,
  TRAVEL_STEP_MINUTES,
  leaveByTime,
  stepTravelMinutes,
  travelBadgeLabel,
  travelBandLabel,
  travelLeadMinutes,
  travelTimesShown,
} from './travelTime'

const card = (patch: Partial<Card> = {}): Card => ({
  id: 'c',
  dayKey: '2027-05-01',
  title: 'Colosseum',
  startTime: '09:00',
  order: 0,
  duration: 'custom',
  durationHours: 3,
  ...patch,
})

const trip = (patch: Partial<Trip> = {}): Trip => ({
  title: 'T',
  startDate: '2027-05-01',
  endDate: '2027-05-02',
  dayStart: '06:00',
  dayEnd: '21:00',
  ...patch,
})

describe('travelTimesShown', () => {
  it('treats an absent preference as shown', () => {
    expect(travelTimesShown(trip())).toBe(true)
  })

  it('honours an explicit off', () => {
    expect(travelTimesShown(trip({ showTravelTimes: false }))).toBe(false)
  })
})

describe('travelLeadMinutes', () => {
  it('is the card travel time when shown', () => {
    expect(travelLeadMinutes(card({ travelMinutes: 45 }), true)).toBe(45)
  })

  it('is zero with travel times switched off — the values survive, the time does not', () => {
    expect(travelLeadMinutes(card({ travelMinutes: 45 }), false)).toBe(0)
  })

  it('is zero on an untimed card — a lead-in needs a start to be counted before', () => {
    expect(travelLeadMinutes(card({ travelMinutes: 45, startTime: undefined }), true)).toBe(0)
  })

  it('is zero when the card carries no travel time', () => {
    expect(travelLeadMinutes(card(), true)).toBe(0)
  })

  it('ignores a negative or non-finite stored value', () => {
    expect(travelLeadMinutes(card({ travelMinutes: -30 }), true)).toBe(0)
    expect(travelLeadMinutes(card({ travelMinutes: Number.NaN }), true)).toBe(0)
  })
})

describe('leaveByTime', () => {
  it('counts the travel time back from the start', () => {
    expect(leaveByTime(card({ startTime: '09:00', travelMinutes: 45 }))).toBe('08:15')
  })

  it('crosses midnight backwards rather than wrapping to a bogus time', () => {
    expect(leaveByTime(card({ startTime: '00:30', travelMinutes: 45 }))).toBe('23:45')
  })

  it('is undefined without a start time or without travel', () => {
    expect(leaveByTime(card({ startTime: undefined, travelMinutes: 45 }))).toBeUndefined()
    expect(leaveByTime(card())).toBeUndefined()
  })
})

describe('labels', () => {
  it('reads as the reference does', () => {
    expect(travelBandLabel(30)).toBe('30 min travel')
    expect(travelBadgeLabel(45)).toBe('+45m')
  })

  it('says hours once the lead-in is long enough to read as one', () => {
    expect(travelBandLabel(90)).toBe('1h 30m travel')
    expect(travelBadgeLabel(120)).toBe('+2h')
  })
})

describe('stepTravelMinutes', () => {
  it('moves by one snapped step', () => {
    expect(stepTravelMinutes(45, 1)).toBe(45 + TRAVEL_STEP_MINUTES)
    expect(stepTravelMinutes(45, -1)).toBe(45 - TRAVEL_STEP_MINUTES)
  })

  it('never drops below one step — zero travel is the toggle`s job, not the stepper`s', () => {
    expect(stepTravelMinutes(TRAVEL_STEP_MINUTES, -1)).toBe(TRAVEL_STEP_MINUTES)
  })

  it('snaps an off-grid legacy value onto the grid as it steps', () => {
    expect(stepTravelMinutes(20, 1)).toBe(30)
    expect(stepTravelMinutes(20, -1)).toBe(15)
  })

  it('defaults a new lead-in to the reference`s 30 minutes', () => {
    expect(DEFAULT_TRAVEL_MINUTES).toBe(30)
  })
})

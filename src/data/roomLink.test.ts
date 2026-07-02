import { describe, it, expect } from 'vitest'
import { roomIdFromHash, roomIdFromLink } from './roomLink'

describe('roomIdFromHash', () => {
  it('parses #room=<id>', () => {
    expect(roomIdFromHash('#room=italy-2027')).toBe('italy-2027')
  })

  it('parses a bare #<id>', () => {
    expect(roomIdFromHash('#italy-2027')).toBe('italy-2027')
  })

  it('returns null for an empty or room-less hash', () => {
    expect(roomIdFromHash('')).toBeNull()
    expect(roomIdFromHash('#')).toBeNull()
    expect(roomIdFromHash('#room=')).toBeNull()
  })
})

describe('roomIdFromLink', () => {
  it('extracts the room id from a full share link', () => {
    expect(roomIdFromLink('https://travel-planner.pages.dev/#room=italy-2027')).toBe('italy-2027')
  })

  it('extracts a bare-fragment room id from a full link', () => {
    expect(roomIdFromLink('https://app.example.com/#italy-2027')).toBe('italy-2027')
  })

  it('returns null for a URL with no fragment (no room id to find)', () => {
    expect(roomIdFromLink('https://travel-planner.pages.dev/')).toBeNull()
  })

  it('accepts a bare hash string', () => {
    expect(roomIdFromLink('#room=italy-2027')).toBe('italy-2027')
  })

  it('accepts a bare room id string', () => {
    expect(roomIdFromLink('italy-2027')).toBe('italy-2027')
  })

  it('accepts a bare room id containing a colon (not parsed as a URL scheme)', () => {
    expect(roomIdFromLink('a:b')).toBe('a:b')
    expect(roomIdFromLink('https://app.example.com/#room=a:b')).toBe('a:b')
  })

  it('returns null for empty / whitespace input', () => {
    expect(roomIdFromLink('')).toBeNull()
    expect(roomIdFromLink('   ')).toBeNull()
  })
})

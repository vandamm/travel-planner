import { describe, expect, it } from 'vitest'
import { isValidSlug, slugFromPath } from './slug'

describe('slug helpers', () => {
  it('accepts canonical room slugs', () => {
    expect(isValidSlug('rome-2027')).toBe(true)
    expect(isValidSlug('r1')).toBe(true)
  })

  it('rejects non-canonical slugs', () => {
    for (const s of ['', '-rome', 'rome-', 'Rome', 'rome_2027', 'a'.repeat(65)]) {
      expect(isValidSlug(s)).toBe(false)
    }
  })

  it('extracts one slug path segment', () => {
    expect(slugFromPath('/rome-2027')).toBe('rome-2027')
    expect(slugFromPath('/rome-2027/')).toBe('rome-2027')
    expect(slugFromPath('/')).toBeNull()
    expect(slugFromPath('/rome/2027')).toBeNull()
  })
})

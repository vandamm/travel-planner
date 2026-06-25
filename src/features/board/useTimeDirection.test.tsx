import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TIME_DIRECTION_KEY } from './timeDirection'
import { useTimeDirection } from './useTimeDirection'

describe('useTimeDirection', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('starts at the default direction', () => {
    const { result } = renderHook(() => useTimeDirection())
    expect(result.current.direction).toBe('down')
  })

  it('seeds the initial value from localStorage', () => {
    localStorage.setItem(TIME_DIRECTION_KEY, 'up')
    const { result } = renderHook(() => useTimeDirection())
    expect(result.current.direction).toBe('up')
  })

  it('toggles and persists the choice', () => {
    const { result } = renderHook(() => useTimeDirection())
    act(() => result.current.toggle())
    expect(result.current.direction).toBe('up')
    expect(localStorage.getItem(TIME_DIRECTION_KEY)).toBe('up')

    act(() => result.current.toggle())
    expect(result.current.direction).toBe('down')
    expect(localStorage.getItem(TIME_DIRECTION_KEY)).toBe('down')
  })

  it('sets an explicit direction and persists it', () => {
    const { result } = renderHook(() => useTimeDirection())
    act(() => result.current.setDirection('up'))
    expect(result.current.direction).toBe('up')
    expect(localStorage.getItem(TIME_DIRECTION_KEY)).toBe('up')
  })
})

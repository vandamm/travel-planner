import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  columnsThatFit,
  LAPTOP_BREAKPOINT,
  selectViewport,
  useColumnsThatFit,
  useViewport,
} from './useViewport'

// jsdom's default window width; restore it after tests that mutate it so other
// suites (e.g. Board) keep seeing the desktop viewport.
const DEFAULT_WIDTH = 1024

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
}

describe('selectViewport', () => {
  it('is mobile below the laptop breakpoint', () => {
    expect(selectViewport(375)).toBe('mobile')
    expect(selectViewport(LAPTOP_BREAKPOINT - 1)).toBe('mobile')
  })

  it('is desktop at and above the laptop breakpoint', () => {
    expect(selectViewport(LAPTOP_BREAKPOINT)).toBe('desktop')
    expect(selectViewport(1440)).toBe('desktop')
  })
})

describe('columnsThatFit', () => {
  it('always shows at least one column, even on a narrow phone', () => {
    expect(columnsThatFit(320)).toBe(1)
    expect(columnsThatFit(375)).toBe(1)
  })

  it('fits more 224px columns (plus 12px gaps) as the viewport widens', () => {
    // 224 + 12 gap + 224 = 460, plus 32px container padding = 492.
    expect(columnsThatFit(492)).toBe(2)
    // One pixel short of a clean two-column fit drops back to one.
    expect(columnsThatFit(491)).toBe(1)
    expect(columnsThatFit(900)).toBe(3)
  })
})

describe('useViewport', () => {
  afterEach(() => setWidth(DEFAULT_WIDTH))

  it('reports the viewport for the current width', () => {
    setWidth(1280)
    const { result } = renderHook(() => useViewport())
    expect(result.current).toBe('desktop')
  })

  it('switches when the window is resized across the breakpoint', () => {
    setWidth(1280)
    const { result } = renderHook(() => useViewport())
    expect(result.current).toBe('desktop')

    act(() => {
      setWidth(500)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe('mobile')
  })
})

describe('useColumnsThatFit', () => {
  afterEach(() => setWidth(DEFAULT_WIDTH))

  it('re-renders with the new column count when the window is resized', () => {
    setWidth(375)
    const { result } = renderHook(() => useColumnsThatFit())
    expect(result.current).toBe(1)

    act(() => {
      setWidth(900)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(3)
  })
})

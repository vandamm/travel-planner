import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LAPTOP_BREAKPOINT, selectViewport, useViewport } from './useViewport'

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

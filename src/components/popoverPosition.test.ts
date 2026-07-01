import { describe, expect, it } from 'vitest'
import { popoverPosition } from './popoverPosition'

const VIEWPORT = { width: 1024, height: 768 }

describe('popoverPosition', () => {
  it('places the panel just below and left-aligned to the trigger', () => {
    const trigger = { left: 100, top: 100, width: 120, height: 32 }
    const { left, top } = popoverPosition(trigger, { width: 260, height: 300 }, VIEWPORT)
    expect(left).toBe(100)
    expect(top).toBe(100 + 32 + 8) // trigger bottom + margin
  })

  it('clamps a right-edge trigger so the panel stays fully in view', () => {
    const trigger = { left: 1000, top: 100, width: 120, height: 32 }
    const { left } = popoverPosition(trigger, { width: 260, height: 300 }, VIEWPORT)
    // maxLeft = 1024 - 260 - 8 = 756
    expect(left).toBe(756)
    expect(left + 260).toBeLessThanOrEqual(VIEWPORT.width)
  })

  it('never pushes the panel past the left gutter', () => {
    const trigger = { left: -50, top: 100, width: 120, height: 32 }
    const { left } = popoverPosition(trigger, { width: 260, height: 300 }, VIEWPORT)
    expect(left).toBe(8)
  })

  it('flips above the trigger when it would overflow the bottom', () => {
    const trigger = { left: 100, top: 700, width: 120, height: 32 }
    const { top } = popoverPosition(trigger, { width: 260, height: 300 }, VIEWPORT)
    // below (740) + 300 + 8 > 768, so flip above: 700 - 300 - 8 = 392
    expect(top).toBe(392)
  })

  it('clamps to the nearest edge when the panel fits neither below nor above', () => {
    const trigger = { left: 100, top: 400, width: 120, height: 32 }
    // A panel taller than fits below the trigger and doesn't fit above it either.
    const { top } = popoverPosition(trigger, { width: 260, height: 700 }, VIEWPORT)
    expect(top).toBe(Math.max(8, VIEWPORT.height - 700 - 8)) // 60
    expect(top).toBeGreaterThanOrEqual(8)
  })

  it('clamps left to the gutter when the panel is wider than the viewport', () => {
    const trigger = { left: 100, top: 100, width: 120, height: 32 }
    const { left } = popoverPosition(trigger, { width: 2000, height: 300 }, VIEWPORT)
    expect(left).toBe(8)
  })
})

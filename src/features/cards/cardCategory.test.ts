import { describe, expect, it } from 'vitest'
import type { Card } from '../../data/schema'
import { cardCategory } from './cardCategory'

const base: Card = { id: 'c', dayKey: '2027-05-01', title: 'X', order: 0 }

describe('cardCategory', () => {
  it('returns the explicit category when set', () => {
    expect(cardCategory({ ...base, category: 'outdoor' })).toBe('outdoor')
  })

  it('derives legacy transport:true as transit', () => {
    expect(cardCategory({ ...base, transport: true })).toBe('transit')
  })

  it('prefers an explicit category over the legacy flag', () => {
    expect(cardCategory({ ...base, category: 'indoor', transport: true })).toBe('indoor')
  })

  it('returns undefined for a plain card', () => {
    expect(cardCategory(base)).toBeUndefined()
    expect(cardCategory({ ...base, transport: false })).toBeUndefined()
  })
})

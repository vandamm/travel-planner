import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { BoardEmptyState } from './BoardEmptyState'

it('opens trip setup from the first-run state', () => {
  const onOpenTrip = vi.fn()
  render(<BoardEmptyState onOpenTrip={onOpenTrip} />)
  fireEvent.click(screen.getByRole('button', { name: 'Set trip dates' }))
  expect(onOpenTrip).toHaveBeenCalledOnce()
})

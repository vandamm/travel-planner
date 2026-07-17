import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BoardToolbar } from './BoardToolbar'

const actions = {
  onOpenTrip: vi.fn(),
  onOpenCities: vi.fn(),
  onOpenShare: vi.fn(),
  onOpenMenu: vi.fn(),
  onAddStay: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onToggleDirection: vi.fn(),
}

describe('BoardToolbar', () => {
  it('keeps all approved desktop actions inside the framed-board toolbar', async () => {
    const user = userEvent.setup()
    render(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="synced"
        presences={[{ userId: 'anna', name: 'Anna', color: '#c0392b' }]}
        canUndo={false}
        canRedo={false}
        direction="down"
        {...actions}
      />,
    )
    expect(screen.getByTestId('board-toolbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit trip' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cities & colours' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add stay' })).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collaborators' }))
    expect(actions.onOpenShare).toHaveBeenCalledOnce()
  })
})

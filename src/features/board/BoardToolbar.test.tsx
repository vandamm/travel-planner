import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BoardToolbar } from './BoardToolbar'

const actions = {
  onOpenTrip: vi.fn(),
  onOpenCities: vi.fn(),
  onOpenShare: vi.fn(),
  onOpenMenu: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onToggleDirection: vi.fn(),
}

describe('BoardToolbar', () => {
  it('opens trip and city actions from the compact edit menu', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Edit trip menu' }))
    const menu = screen.getByRole('dialog', { name: 'Edit trip' })
    expect(screen.queryByRole('button', { name: 'Add stay' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Trip details' }))
    expect(actions.onOpenTrip).toHaveBeenCalledOnce()
    expect(menu).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit trip menu' }))
    await user.click(screen.getByRole('button', { name: 'Cities & colours' }))
    expect(actions.onOpenCities).toHaveBeenCalledOnce()
    expect(screen.getByText('Live')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Collaborators' }))
    expect(actions.onOpenShare).toHaveBeenCalledOnce()
  })

  it('keeps a fixed-width sync status immediately before stable right controls', () => {
    const { rerender } = render(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="local"
        presences={[]}
        canUndo={false}
        canRedo={false}
        direction="down"
        {...actions}
      />,
    )
    const sync = screen.getByTestId('sync-container')
    const controls = screen.getByTestId('right-controls')
    expect(sync).toHaveClass('w-24', 'shrink-0')
    expect(sync.nextElementSibling).toBe(controls)

    rerender(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="connecting"
        presences={[]}
        canUndo={false}
        canRedo={false}
        direction="down"
        {...actions}
      />,
    )
    expect(screen.getByTestId('sync-container')).toHaveTextContent('Connecting…')
    expect(screen.getByTestId('sync-container').nextElementSibling).toBe(
      screen.getByTestId('right-controls'),
    )
  })
})

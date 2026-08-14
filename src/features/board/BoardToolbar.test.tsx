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
}

describe('BoardToolbar', () => {
  it('exposes Trip, Cities and Share as visible toolbar buttons', async () => {
    const user = userEvent.setup()
    render(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="synced"
        presences={[{ userId: 'anna', name: 'Anna', color: '#c0392b' }]}
        canUndo={false}
        canRedo={false}
        {...actions}
      />,
    )
    expect(screen.getByTestId('board-toolbar')).toBeInTheDocument()
    // No compact ✎ popover any more — the three actions sit in the toolbar.
    expect(screen.queryByRole('button', { name: 'Edit trip menu' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add stay' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trip' }))
    expect(actions.onOpenTrip).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Cities' }))
    expect(actions.onOpenCities).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(actions.onOpenShare).toHaveBeenCalledOnce()

    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(screen.getByTestId('app-seal')).toHaveClass('h-[34px]', 'w-[34px]')
    expect(screen.getByTestId('app-title-block')).toContainElement(screen.getByTestId('app-meta'))
    expect(document.querySelector('[data-presence-avatar]')).toHaveClass('rounded-full')
    await user.click(screen.getByRole('button', { name: 'Collaborators' }))
    expect(actions.onOpenShare).toHaveBeenCalledTimes(2)
  })

  it('keeps the right controls anchored right as the sync status text changes', () => {
    const { rerender } = render(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="local"
        presences={[]}
        canUndo={false}
        canRedo={false}
        {...actions}
      />,
    )
    // The status now shares the title's sub-line; the controls stay pinned right
    // by `ml-auto`, so its changing width can never shove them about.
    expect(screen.getByTestId('app-title-block')).toContainElement(
      screen.getByTestId('sync-container'),
    )
    expect(screen.getByTestId('right-controls')).toHaveClass('ml-auto')

    rerender(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="connecting"
        presences={[]}
        canUndo={false}
        canRedo={false}
        {...actions}
      />,
    )
    expect(screen.getByTestId('sync-container')).toHaveTextContent('Connecting…')
    expect(screen.getByTestId('right-controls')).toHaveClass('ml-auto')
  })

  it('shows the tickets-to-buy chip only when something is unbought', () => {
    const { rerender } = render(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="synced"
        presences={[]}
        canUndo={false}
        canRedo={false}
        {...actions}
      />,
    )
    expect(screen.queryByTestId('tickets-to-buy')).not.toBeInTheDocument()

    rerender(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="synced"
        presences={[]}
        ticketsToBuy={3}
        canUndo={false}
        canRedo={false}
        {...actions}
      />,
    )
    expect(screen.getByTestId('tickets-to-buy')).toHaveTextContent('3 tickets to buy')

    rerender(
      <BoardToolbar
        title="Italy 2027"
        meta="3 days · 2 cities"
        status="synced"
        presences={[]}
        ticketsToBuy={1}
        canUndo={false}
        canRedo={false}
        {...actions}
      />,
    )
    expect(screen.getByTestId('tickets-to-buy')).toHaveTextContent('1 ticket to buy')
  })
})

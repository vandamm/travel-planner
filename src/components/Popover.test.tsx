import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Popover } from './Popover'
import { Modal } from './Modal'

// jsdom reports window.innerWidth = 1024 (>= LAPTOP_BREAKPOINT), so these
// exercise the desktop anchored-panel path. The mobile Modal-sheet fallback is
// covered by the pickers' e2e (they render through this same primitive).

function renderPopover() {
  return render(
    <Popover label="Test picker" trigger="Open me">
      {(close) => (
        <button type="button" onClick={close}>
          Pick
        </button>
      )}
    </Popover>,
  )
}

describe('Popover', () => {
  it('is closed until the trigger is clicked, then shows a labelled dialog', async () => {
    const user = userEvent.setup()
    renderPopover()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'Open me' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Test picker' })
    expect(dialog).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('moves focus into the panel on open', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.click(screen.getByRole('button', { name: 'Open me' }))
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderPopover()
    await user.click(screen.getByRole('button', { name: 'Open me' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escape over an open popover closes only the popover, not the modal behind it', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal label="Editor" onClose={onClose}>
        <Popover label="Test picker" trigger="Open me">
          {() => <p>Body</p>}
        </Popover>
      </Modal>,
    )
    await user.click(screen.getByRole('button', { name: 'Open me' }))
    expect(screen.getByRole('dialog', { name: 'Test picker' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    // Popover gone; editor Modal's onClose was NOT called (it stays open).
    expect(screen.queryByRole('dialog', { name: 'Test picker' })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Editor' })).toBeInTheDocument()

    // A second Escape now closes the editor Modal.
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on an outside click but not on a click inside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <span data-testid="outside">outside</span>
        <Popover label="Test picker" trigger="Open me">
          {() => <p>Body</p>}
        </Popover>
      </div>,
    )
    await user.click(screen.getByRole('button', { name: 'Open me' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByText('Body'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByTestId('outside'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes when a consumer calls the render-prop close and restores focus', async () => {
    const user = userEvent.setup()
    renderPopover()
    const trigger = screen.getByRole('button', { name: 'Open me' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'Pick' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})

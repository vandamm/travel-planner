import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

describe('Modal', () => {
  it('renders children in an aria-labelled modal dialog', () => {
    render(
      <Modal label="Test dialog" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'Test dialog')
    expect(screen.getByText('Body')).toBeInTheDocument()
  })

  it('switches directly from a titled full-screen mobile view to a floating card at 640px', () => {
    render(
      <Modal label="Test dialog" onClose={() => {}}>
        <h2>Body title</h2>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    expect(screen.getByText('Test dialog')).toBeInTheDocument()
    expect(dialog.parentElement).toHaveClass('sm:items-center', 'sm:justify-center', 'sm:p-4')
    expect(dialog).toHaveClass('h-full', 'pt-0', 'sm:h-auto', 'sm:p-6', 'sm:rounded-frame')
    expect(dialog).toHaveClass('[&_h2]:hidden', 'sm:[&_h2]:block')
    const ribbon = screen.getByRole('button', { name: 'Close' }).parentElement
    expect(ribbon).toHaveClass('sm:hidden')
    expect(ribbon).not.toHaveClass('-mt-6')
  })

  it('closes on backdrop click but not on a click inside', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal label="Test dialog" onClose={onClose}>
        <button type="button">Inside</button>
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Inside' }))
    expect(onClose).not.toHaveBeenCalled()

    // The backdrop is the dialog's parent element.
    await user.click(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('caps its height to the viewport and scrolls a long body', () => {
    render(
      <Modal label="Test dialog" onClose={() => {}}>
        <p>Body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveClass('max-h-full')
    expect(dialog).toHaveClass('overflow-y-auto')
  })

  it('renders a mobile "Close" control that calls onClose', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal label="Test dialog" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal label="Test dialog" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus into the dialog and restores it to the opener', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && (
            <Modal label="Test dialog" onClose={() => setOpen(false)}>
              <p>Body</p>
            </Modal>
          )}
        </>
      )
    }
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await user.click(opener)
    expect(screen.getByRole('dialog')).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(opener).toHaveFocus()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
})

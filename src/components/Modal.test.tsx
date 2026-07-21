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

  it('puts a supplied primary action in the phone sheet header', () => {
    render(
      <Modal
        label="Editor"
        onClose={() => {}}
        mobileAction={<button type="button">Save</button>}
      >
        <p>Body</p>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Editor' })
    expect(dialog.parentElement).toHaveClass('bg-[rgba(31,29,24,0.46)]')
    expect(dialog).toHaveClass('shadow-[0_30px_70px_-20px_rgba(20,18,14,0.60)]')
    expect(screen.getByRole('button', { name: 'Save' }).parentElement).toHaveClass('ml-auto')
  })

  it('switches directly from a titled full-screen mobile view to a floating card at 640px', () => {
    render(
      <Modal label="Test dialog" onClose={() => {}}>
        <h2>Body title</h2>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    expect(screen.getByText('Test dialog')).toBeInTheDocument()
    expect(dialog.parentElement).toHaveClass(
      'min-[400px]:items-center',
      'min-[400px]:justify-center',
      'min-[400px]:p-4',
    )
    expect(dialog).toHaveClass('h-full', 'pt-0', 'min-[400px]:h-auto', 'min-[400px]:p-6')
    expect(dialog).toHaveClass('[&_h2]:hidden', 'min-[400px]:[_h2]:block')
    const ribbon = screen.getByRole('button', { name: 'Close' }).parentElement
    expect(ribbon).toHaveClass('min-[400px]:hidden')
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

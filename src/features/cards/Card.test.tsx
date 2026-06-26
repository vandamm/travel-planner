import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Card as CardType } from '../../data/schema'
import { Card } from './Card'

const base: CardType = { id: 'x', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }

describe('Card', () => {
  it('renders the title', () => {
    render(<Card card={base} />)
    expect(screen.getByTestId('card-title')).toHaveTextContent('Colosseum')
  })

  it('shows a start–end time when the card is time-bound', () => {
    render(<Card card={{ ...base, startTime: '19:00', endTime: '21:00' }} />)
    expect(screen.getByTestId('card-time')).toHaveTextContent('19:00–21:00')
  })

  it('shows only the start time when there is no end time', () => {
    render(<Card card={{ ...base, startTime: '08:00' }} />)
    expect(screen.getByTestId('card-time')).toHaveTextContent('08:00')
    expect(screen.getByTestId('card-time')).not.toHaveTextContent('–')
  })

  it('omits the time when the card is untimed', () => {
    render(<Card card={base} />)
    expect(screen.queryByTestId('card-time')).not.toBeInTheDocument()
  })

  it('renders an optional note', () => {
    render(<Card card={{ ...base, note: 'Bring tickets' }} />)
    expect(screen.getByTestId('card-note')).toHaveTextContent('Bring tickets')
  })

  it('renders an optional link as an anchor', () => {
    render(<Card card={{ ...base, link: 'https://example.com' }} />)
    const link = screen.getByTestId('card-link')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('never renders a javascript: link as a clickable anchor', () => {
    render(<Card card={{ ...base, link: 'javascript:alert(document.cookie)' }} />)
    // No anchor at all, so the dangerous scheme can't be a clickable href.
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const inert = screen.getByTestId('card-link')
    expect(inert.tagName).toBe('SPAN')
    expect(inert).not.toHaveAttribute('href')
  })

  it('omits note and link when absent', () => {
    render(<Card card={base} />)
    expect(screen.queryByTestId('card-note')).not.toBeInTheDocument()
    expect(screen.queryByTestId('card-link')).not.toBeInTheDocument()
  })

  it('renders a transport icon and accent style for a transport card', () => {
    render(<Card card={{ ...base, transport: true }} />)
    expect(screen.getByTestId('card-transport-icon')).toBeInTheDocument()
    expect(screen.getByTestId('card')).toHaveAttribute('data-transport', '')
  })

  it('omits the transport icon for a normal card', () => {
    render(<Card card={base} />)
    expect(screen.queryByTestId('card-transport-icon')).not.toBeInTheDocument()
    expect(screen.getByTestId('card')).not.toHaveAttribute('data-transport')
  })

  it('calls onEdit with the card when clicked', () => {
    const onEdit = vi.fn()
    render(<Card card={base} onEdit={onEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Colosseum' }))
    expect(onEdit).toHaveBeenCalledWith(base)
  })
})

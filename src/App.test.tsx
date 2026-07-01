import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the wordmark heading (falls back to Travel Planner when untitled)', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Travel Planner' })).toBeInTheDocument()
  })

  it('renders the vermilion seal', () => {
    render(<App />)
    const seal = screen.getByTestId('app-seal')
    expect(seal).toHaveTextContent('I')
  })

  it('renders the meta line with day and city counts', () => {
    render(<App />)
    // default trip: 0 days, no cities.
    expect(screen.getByTestId('app-meta')).toHaveTextContent('0 days · 0 cities')
  })

  it('does not render the on-page import/export controls', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Export trip' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Import / Export' })).not.toBeInTheDocument()
  })

  it('opens the Trip details modal from the header button', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Trip setup lives behind a modal now, not an inline section.
    expect(screen.queryByRole('dialog', { name: 'Trip details' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Trip' }))
    expect(screen.getByRole('dialog', { name: 'Trip details' })).toBeInTheDocument()
  })

  it('opens the Cities & colours modal from the header button', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Cities live behind a modal now, not an inline section.
    expect(screen.queryByRole('dialog', { name: 'Cities & colours' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cities' }))
    expect(screen.getByRole('dialog', { name: 'Cities & colours' })).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { encodePayload } from './data/token'

// A board link is a `#<token>` fragment; build one for the board-focused tests.
const TOKEN_HASH = '#' + encodePayload({ r: 'test-room', p: 'edit', v: 1 }) + '.dummySig'

// The app only mounts when a decodable token is present in the URL hash; give the
// board-focused tests one, and reset the hash after each test.
afterEach(() => {
  window.location.hash = ''
})

describe('App (with a board token in the hash)', () => {
  beforeEach(() => {
    window.location.hash = TOKEN_HASH
  })

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

    // Escape flips AppShell's open flag back off, unmounting the modal.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Trip details' })).not.toBeInTheDocument()
  })

  it('opens the Cities & colours modal from the header button', async () => {
    const user = userEvent.setup()
    render(<App />)
    // Cities live behind a modal now, not an inline section.
    expect(screen.queryByRole('dialog', { name: 'Cities & colours' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cities' }))
    expect(screen.getByRole('dialog', { name: 'Cities & colours' })).toBeInTheDocument()

    // Escape flips AppShell's open flag back off, unmounting the modal.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Cities & colours' })).not.toBeInTheDocument()
  })
})

describe('App without a decodable token', () => {
  it('shows a notice and renders no board or editing controls', () => {
    window.location.hash = ''
    render(<App />)
    // A quiet notice, not the editable board.
    expect(screen.getByText(/share link/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Trip' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('app-meta')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Board' })).not.toBeInTheDocument()
  })

  it('treats an old `#room=…` link as no token (hard cut)', () => {
    window.location.hash = '#room=legacy'
    render(<App />)
    expect(screen.getByText(/share link/i)).toBeInTheDocument()
    expect(screen.queryByTestId('app-meta')).not.toBeInTheDocument()
  })
})

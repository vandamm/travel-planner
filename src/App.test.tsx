import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
})

describe('App (with a room slug path)', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/test-room')
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

  it('uses the desktop board inset for the full-width trip header at 768px', () => {
    render(<App />)

    const header = screen.getByTestId('app-seal').closest('header')
    expect(header).toHaveClass('w-full', 'px-6')
    expect(header).not.toHaveClass('max-w-2xl')
    expect(screen.getByRole('button', { name: 'Trip' }).parentElement).toHaveClass('md:flex')
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveClass('md:hidden')
  })

  it('renders the meta line with day and city counts', () => {
    render(<App />)
    // default trip: 0 days, no cities.
    expect(screen.getByTestId('app-meta')).toHaveTextContent('0 days · 0 cities')
  })

  it('shows the current sync state', () => {
    render(<App />)
    expect(screen.getByTestId('sync-status')).toHaveTextContent('Local')
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

describe('App without a room slug', () => {
  it('shows the year calendar and renders no board or editing controls', async () => {
    window.history.replaceState(null, '', '/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trips: [] }) }),
    )
    render(<App />)
    expect(await screen.findByRole('heading', { name: /travel year/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new trip/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Trip' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('app-meta')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Board' })).not.toBeInTheDocument()
  })

  it('opens the new trip form and reports creation errors', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: string, init?: RequestInit) => {
      if (input.startsWith('https://openholidaysapi.org/')) {
        return { ok: true, json: async () => [] }
      }
      if (init?.method === 'POST') {
        return { ok: false, json: async () => ({ error: 'room already exists' }) }
      }
      return { ok: true, json: async () => ({ trips: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /new trip/i }))
    await user.type(screen.getByLabelText('Trip slug'), 'japan-2028')
    await user.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('room already exists')
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/rooms',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ room: 'japan-2028' }) }),
    )
  })

  it('links trip markings on the calendar to their boards', async () => {
    const year = new Date().getFullYear()
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (input.startsWith('https://openholidaysapi.org/')) {
        return { ok: true, json: async () => [] }
      }
      if (input.includes('cursor=page-2')) {
        return {
          ok: true,
          json: async () => ({
            trips: [
              {
                id: 'lisbon-autumn',
                title: 'Lisbon',
                startDate: `${year}-10-15`,
                endDate: `${year}-10-18`,
              },
            ],
            nextCursor: null,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          trips: [
            {
              id: 'japan-spring',
              title: 'Japan',
              startDate: `${year}-03-24`,
              endDate: `${year}-03-26`,
            },
          ],
          nextCursor: 'page-2',
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(await screen.findByRole('link', { name: /Japan on 24 March/ })).toHaveAttribute(
      'href',
      '/japan-spring',
    )
    expect(screen.getByRole('link', { name: /Lisbon on 15 October/ })).toHaveAttribute(
      'href',
      '/lisbon-autumn',
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/rooms?cursor=page-2')
  })

  it('shows Bavaria school holidays as a light calendar background', async () => {
    const year = new Date().getFullYear()
    const fetchMock = vi.fn().mockImplementation(async (input: string) => ({
      ok: true,
      json: async () =>
        input.startsWith('https://openholidaysapi.org/')
          ? [
              {
                startDate: `${year}-01-02`,
                endDate: `${year}-01-03`,
                name: [{ language: 'EN', text: 'Christmas Holidays' }],
              },
            ]
          : { trips: [] },
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    const holidayDays = await screen.findAllByTitle('Christmas Holidays · Bavaria school holidays')
    expect(holidayDays).toHaveLength(2)
    expect(holidayDays.every((day) => day.classList.contains('bg-[#e8efff]'))).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('subdivisionCode=DE-BY'))
  })

  it('rejects non-canonical slug paths', () => {
    window.history.replaceState(null, '', '/Room_legacy')
    render(<App />)
    expect(screen.getByText(/slug url/i)).toBeInTheDocument()
    expect(screen.queryByTestId('app-meta')).not.toBeInTheDocument()
  })
})

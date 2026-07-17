import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import App from './App'
import * as provider from './data/provider'

afterEach(() => {
  window.history.replaceState(null, '', '/')
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

  it('puts trip controls inside the framed board at the 400px boundary', () => {
    render(<App />)

    expect(screen.getByTestId('board-frame')).toContainElement(screen.getByTestId('board-toolbar'))
    expect(screen.getByRole('button', { name: 'Edit trip' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cities & colours' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Board' })).not.toBeInTheDocument()
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

  it('keeps the board mounted while connecting, then shows a missing trip response', async () => {
    vi.stubEnv('MODE', 'production')
    const doc = new Y.Doc()
    let emitStatus!: (status: provider.SyncStatus) => void
    const spy = vi.spyOn(provider, 'connectRoom').mockReturnValue({
      doc,
      whenLocalLoaded: Promise.resolve(),
      getStatus: () => 'connecting',
      onStatus: (callback: (status: provider.SyncStatus) => void) => {
        emitStatus = callback
        return () => undefined
      },
      getPresences: () => [],
      onPresences: () => () => undefined,
      destroy: () => undefined,
    } as unknown as provider.RoomConnection)

    render(<App />)
    expect(screen.getByTestId('app-seal')).toBeInTheDocument()

    act(() => emitStatus('missing'))
    expect(await screen.findByRole('heading', { name: "This trip doesn't exist." })).toBeInTheDocument()
    spy.mockRestore()
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

    await user.click(screen.getByRole('button', { name: 'Edit trip' }))
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

    await user.click(screen.getByRole('button', { name: 'Cities & colours' }))
    expect(screen.getByRole('dialog', { name: 'Cities & colours' })).toBeInTheDocument()

    // Escape flips AppShell's open flag back off, unmounting the modal.
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Cities & colours' })).not.toBeInTheDocument()
  })
})

describe('App without a room slug', () => {
  it('renders the timeline when no dated trips exist', async () => {
    window.history.replaceState(null, '', '/')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trips: [] }) }),
    )
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your travel timeline' })).toBeInTheDocument()
    expect(screen.queryByText('Plan your first journey')).not.toBeInTheDocument()
    expect(screen.queryByText('Continue planning')).not.toBeInTheDocument()
    expect(document.querySelector('[data-timeline-canvas]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new trip/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Trip' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('app-meta')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Board' })).not.toBeInTheDocument()
  })

  it('renders one timeline page for dated trips', async () => {
    const today = new Date().toISOString().slice(0, 10)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          trips: [{ id: 'summer', title: 'Summer coast', startDate: today, endDate: today }],
        }),
      }),
    )
    render(<App />)

    await screen.findByRole('link', { name: /Summer coast/ })
    expect(screen.getAllByRole('heading', { name: 'Your travel timeline' })).toHaveLength(1)
    expect(document.querySelectorAll('main')).toHaveLength(1)
  })

  it('loads school holidays through the final timeline year', async () => {
    const year = new Date().getFullYear()
    const nextYear = year + 1
    const fetchMock = vi.fn().mockImplementation(async (input: string) => {
      if (input.startsWith('https://openholidaysapi.org/SchoolHolidays')) {
        return {
          ok: true,
          json: async () =>
            input.includes(`validTo=${nextYear}-12-31`)
              ? [
                  {
                    startDate: `${nextYear}-04-05`,
                    endDate: `${nextYear}-04-09`,
                    name: [{ language: 'EN', text: 'Spring Holidays' }],
                  },
                ]
              : [],
        }
      }
      if (input.startsWith('https://openholidaysapi.org/PublicHolidays')) {
        return { ok: true, json: async () => [] }
      }
      return {
        ok: true,
        json: async () => ({
          trips: [
            {
              id: 'japan-spring',
              title: 'Japan',
              startDate: `${nextYear}-03-22`,
              endDate: `${nextYear}-03-22`,
            },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(await screen.findByText('5–9 Apr')).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`validTo=${nextYear}-12-31`),
      ),
    )
  })

  it('shows the calendar when selected by the query string', async () => {
    window.history.replaceState(null, '', '/?view=calendar')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trips: [] }) }),
    )
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Your travel calendar' })).toBeInTheDocument()
  })

  it('opens a trip draft from an empty calendar date with only its start date selected', async () => {
    const year = new Date().getFullYear()
    window.history.replaceState(null, '', '/?view=calendar')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ trips: [] }) }),
    )
    const user = userEvent.setup()
    render(<App />)

    await user.click(
      await screen.findByRole('button', { name: `Plan trip starting 3 January ${year}` }),
    )
    expect(screen.getByLabelText('Start date')).toHaveValue(`${year}-01-03`)
    expect(screen.getByLabelText('End date')).toHaveValue('')
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
    expect(screen.getByRole('dialog', { name: 'Plan new trip' })).toBeInTheDocument()
    const name = screen.getByLabelText('Trip name')
    const slug = screen.getByLabelText('Trip slug')
    const startDate = screen.getByLabelText('Start date')
    const endDate = screen.getByLabelText('End date')
    const dateGroup = screen.getByRole('group', { name: 'Trip dates' })
    expect(dateGroup.firstElementChild).toHaveClass('sr-only')
    expect(dateGroup.children[1]).toHaveClass('grid-cols-2')
    expect(name).toBeRequired()
    expect(slug).toBeRequired()
    expect(startDate).toBeRequired()
    expect(endDate).toBeRequired()

    await user.type(name, 'Japan Spring')
    expect(slug).toHaveValue('japan-spring')
    await user.clear(slug)
    await user.type(slug, 'japan-2028')
    await user.type(name, ' 2028')
    expect(slug).toHaveValue('japan-2028')
    await user.type(startDate, '2028-03-10')
    await user.type(endDate, '2028-03-24')
    await user.click(screen.getByRole('button', { name: 'Create trip' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('room already exists')
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/rooms',
      expect.objectContaining({
        method: 'POST',
      }),
    )
    const [, createInit] = fetchMock.mock.calls.at(-1)!
    expect(JSON.parse(createInit?.body as string)).toEqual(expect.objectContaining({
      room: 'japan-2028',
      title: 'Japan Spring 2028',
      startDate: '2028-03-10',
      endDate: '2028-03-24',
    }))
  })

  it('links trip markings on the calendar to their boards', async () => {
    const year = new Date().getFullYear()
    window.history.replaceState(null, '', '/?view=calendar')
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
    window.history.replaceState(null, '', '/?view=calendar')
    const fetchMock = vi.fn().mockImplementation(async (input: string) => ({
      ok: true,
      json: async () =>
        input.startsWith('https://openholidaysapi.org/SchoolHolidays')
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
    expect(holidayDays[0]).toHaveClass('bg-[#edf1e1]')
    expect(holidayDays[1]).toHaveClass('bg-[#edf1e1]', 'text-city-vermilion')
    expect(holidayDays[1]).not.toHaveClass('bg-[#fff0ee]')
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('subdivisionCode=DE-BY'))
  })

  it('loads Bavaria public holidays into the calendar', async () => {
    const year = new Date().getFullYear()
    window.history.replaceState(null, '', '/?view=calendar')
    const fetchMock = vi.fn().mockImplementation(async (input: string) => ({
      ok: true,
      json: async () =>
        input.startsWith('https://openholidaysapi.org/PublicHolidays')
          ? [
              {
                startDate: `${year}-01-06`,
                endDate: `${year}-01-06`,
                regionalScope: 'Regional',
                name: [{ language: 'EN', text: 'Epiphany' }],
              },
            ]
          : input.startsWith('https://openholidaysapi.org/')
            ? []
            : { trips: [] },
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    expect(await screen.findByTitle('Epiphany · Bavaria public holiday')).toHaveClass(
      'bg-[#fff0ee]',
      'text-city-vermilion',
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/PublicHolidays?countryIsoCode=DE'),
    )
  })

  it('rejects non-canonical slug paths', () => {
    window.history.replaceState(null, '', '/Room_legacy')
    render(<App />)
    expect(screen.getByText(/slug url/i)).toBeInTheDocument()
    expect(screen.queryByTestId('app-meta')).not.toBeInTheDocument()
  })
})

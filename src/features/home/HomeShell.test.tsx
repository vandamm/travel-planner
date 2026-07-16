import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { HomeShell } from './HomeShell'

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

it('renders the timeline while the trips request is pending', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

  const { container } = render(<HomeShell />)

  expect(screen.getByRole('heading', { name: 'Your travel timeline' })).toBeInTheDocument()
  expect(container.querySelector('[data-timeline-canvas]')).toBeInTheDocument()
  expect(screen.queryByText('Loading trips…')).not.toBeInTheDocument()
})

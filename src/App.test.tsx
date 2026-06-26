import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app heading', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Travel Planner' })).toBeInTheDocument()
  })

  it('does not render the on-page import/export controls', () => {
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Export trip' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Import / Export' })).not.toBeInTheDocument()
  })
})

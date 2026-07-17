import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CityPicker } from './CityPicker'

describe('CityPicker', () => {
  it('offers Auto, marks the resolved city, and can request a new city', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onAddCity = vi.fn()
    render(
      <CityPicker
        label="Choose city"
        resolvedCityId="rome"
        cities={[{ id: 'rome', name: 'Rome', color: '#c0392b' }]}
        onChange={onChange}
        includeAddCity
        onAddCity={onAddCity}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Choose city' }))
    expect(screen.getByRole('button', { name: /Auto/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Rome/ })).toHaveTextContent('✓')
    await user.click(screen.getByRole('button', { name: '+ Add city' }))
    expect(onAddCity).toHaveBeenCalledOnce()
  })
})

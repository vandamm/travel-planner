import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ReactNode } from 'react'
import { RoomProvider } from '../../data/RoomProvider'
import { TripSettings } from './TripSettings'

function renderInRoom(ui: ReactNode) {
  return render(
    <RoomProvider workerUrl="" roomId={null} enableSync={false}>
      {ui}
    </RoomProvider>,
  )
}

describe('TripSettings', () => {
  it('writes title, start date, and day count into the trip', () => {
    renderInRoom(<TripSettings />)
    fireEvent.change(screen.getByLabelText('Trip title'), { target: { value: 'Italy' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-05-01' } })
    fireEvent.change(screen.getByLabelText('Number of days'), { target: { value: '12' } })

    expect(screen.getByLabelText('Trip title')).toHaveValue('Italy')
    expect(screen.getByLabelText('Start date')).toHaveValue('2027-05-01')
    expect(screen.getByLabelText('Number of days')).toHaveValue(12)
  })

  it('defaults and writes the day timeline window', () => {
    renderInRoom(<TripSettings />)
    expect(screen.getByLabelText('Day start')).toHaveValue('06:00')
    expect(screen.getByLabelText('Day end')).toHaveValue('21:00')

    fireEvent.change(screen.getByLabelText('Day start'), { target: { value: '07:30' } })
    fireEvent.change(screen.getByLabelText('Day end'), { target: { value: '22:00' } })

    expect(screen.getByLabelText('Day start')).toHaveValue('07:30')
    expect(screen.getByLabelText('Day end')).toHaveValue('22:00')
  })
})

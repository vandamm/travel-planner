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
})

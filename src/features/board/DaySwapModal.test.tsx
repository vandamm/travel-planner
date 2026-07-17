import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { City, Day } from '../../data/schema'
import { DaySwapModal } from './DaySwapModal'

const days: Day[] = [
  { key: '2027-05-01', index: 0 },
  { key: '2027-05-02', index: 1 },
  { key: '2027-05-03', index: 2 },
]
const rome: City = { id: 'rome', name: 'Rome', color: '#ef4444' }
const florence: City = { id: 'florence', name: 'Florence', color: '#3b82f6' }

function renderModal() {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <DaySwapModal
      sourceDay={days[0]}
      days={days}
      cityByDay={
        new Map([
          [days[0].key, rome],
          [days[1].key, florence],
          [days[2].key, undefined],
        ])
      }
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )
  return { onConfirm, onClose }
}

describe('DaySwapModal', () => {
  it('offers every other trip date and previews both dates and cities', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Swap activity day' })
    const select = within(dialog).getByLabelText('Swap with') as HTMLSelectElement

    expect([...select.options].map((option) => option.value)).toEqual([
      '2027-05-02',
      '2027-05-03',
    ])
    expect(within(dialog).getByTestId('swap-source')).toHaveTextContent('01.05')
    expect(within(dialog).getByTestId('swap-source')).toHaveTextContent('Rome')
    expect(within(dialog).getByTestId('swap-target')).toHaveTextContent('02.05')
    expect(within(dialog).getByTestId('swap-target')).toHaveTextContent('Florence')
  })

  it('updates the preview and confirms the selected cityless date once', () => {
    const { onConfirm } = renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Swap activity day' })

    fireEvent.change(within(dialog).getByLabelText('Swap with'), {
      target: { value: '2027-05-03' },
    })
    expect(within(dialog).getByTestId('swap-target')).toHaveTextContent('03.05')
    expect(within(dialog).getByTestId('swap-target')).toHaveTextContent('No city')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Swap days' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledWith('2027-05-03')
  })

  it('closes without confirming from Cancel', () => {
    const { onConfirm, onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

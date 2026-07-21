import { expect, test } from '@playwright/test'
import { pickDate, pickRange, setupTrip, E2E_LINK } from './helpers'

// §10 date picker: the custom calendar pop-over replaces the native date inputs.

test('picking the trip start via the calendar rebuilds the board to that date', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Cal Trip', startDate: '2027-05-01', endDate: '2027-05-03' })

  // Board rebuilt from the picked ISO date.
  const labels = page.getByTestId('day-label')
  await expect(labels).toHaveCount(3)
  await expect(labels.nth(0)).toHaveText('SAT · 01 MAY')

  // Re-picking a different month moves the whole board.
  await page.getByRole('button', { name: 'Edit trip menu' }).click()
  await page.getByRole('dialog', { name: 'Edit trip' }).getByRole('button', { name: 'Trip details' }).click()
  const trip = page.getByRole('dialog', { name: 'Trip details' })
  await pickDate(trip, 'End date', '2027-06-12')
  await pickDate(trip, 'Start date', '2027-06-10')
  await trip.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByTestId('day-label').nth(0)).toHaveText('THU · 10 JUN')
})

test('a stay range highlights both endpoints and the days between', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-05' })

  await page.getByTestId('add-stay-gap').click()
  const editor = page.getByRole('dialog', { name: 'Accommodation editor' })
  await pickRange(editor, 'Stay nights', '2027-05-01', '2027-05-03')

  // Reopen to inspect the highlighted grid (the picker closes on a complete range).
  await editor.getByRole('button', { name: 'Stay nights' }).click()
  const cal = editor.getByRole('dialog', { name: 'Stay nights' })
  await expect(cal.locator('[data-key="2027-05-01"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(cal.locator('[data-key="2027-05-03"]')).toHaveAttribute('aria-pressed', 'true')
  // The in-between day is tinted but not an endpoint.
  await expect(cal.locator('[data-key="2027-05-02"]')).not.toHaveAttribute('aria-pressed', 'true')
})

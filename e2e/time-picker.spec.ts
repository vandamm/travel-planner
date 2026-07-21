import { expect, test } from '@playwright/test'
import { pickTime, setupTrip, E2E_LINK } from './helpers'

// §11 time picker: the custom hour/minute wheel pop-over replaces the native
// time inputs on cards and the trip day window. (Card height is derived from the
// times and unit-tested in cardHeight.test.ts; here we only prove the wheel
// writes/clears the stored HH:mm.)

test('setting a card start through the wheel shows its start and duration', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const firstColumn = page.locator('[data-testid="day-column"]').first()
  await firstColumn.getByRole('button', { name: 'Add activity', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Title').fill('Train ride')
  await pickTime(editor, 'Start time', '10:00')
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-time')).toHaveText('10:00 · 1h 00m')
})

test('clearing a card start time in the wheel untimes the card', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const firstColumn = page.locator('[data-testid="day-column"]').first()
  await firstColumn.getByRole('button', { name: 'Add activity', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Title').fill('Loose plan')
  await pickTime(editor, 'Start time', '09:00')
  await editor.getByRole('button', { name: 'Save card' }).click()
  await expect(firstColumn.getByTestId('card-time')).toHaveText('09:00 · 1h 00m')

  // Reopen, clear the start time in the wheel, save → the card is untimed.
  await firstColumn
    .getByTestId('card')
    .getByRole('button', { name: 'Edit Loose plan', exact: true })
    .click()
  const reopen = page.getByRole('dialog', { name: 'Card editor' })
  await reopen.getByRole('button', { name: 'Start time' }).click()
  await reopen
    .getByRole('dialog', { name: 'Start time' })
    .getByRole('button', { name: 'Clear' })
    .click()
  await reopen.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-time')).toHaveText('1h 00m')
})

test('setting the trip day window through the wheel updates the field', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  await page.getByRole('button', { name: 'Edit trip' }).click()
  const trip = page.getByRole('dialog', { name: 'Trip details' })
  await expect(trip.getByRole('button', { name: 'Day start' })).toHaveText('06:00')
  await pickTime(trip, 'Day start', '08:00')
  await expect(trip.getByRole('button', { name: 'Day start' })).toHaveText('08:00')
})

test.describe('mobile time picker', () => {
  test.use({ viewport: { width: 456, height: 652 }, hasTouch: true, isMobile: true })

  test('centers the first minute instead of pinning it to the top edge', async ({ page }) => {
    await page.goto('/mobile-picker-e2e')
    await setupTrip(page, { title: 'Picker', startDate: '2027-05-01', endDate: '2027-05-01' })

    await page.getByRole('button', { name: 'Add activity', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Card editor' })
    await editor.getByRole('button', { name: 'Start time' }).click()

    const picker = page.getByRole('dialog', { name: 'Start time' })
    const minutes = picker.getByRole('listbox', { name: 'Minute' })
    const selected = minutes.getByRole('option', { name: 'Minute 00' })
    await expect
      .poll(async () => {
        const [listBox, selectedBox] = await Promise.all([
          minutes.boundingBox(),
          selected.boundingBox(),
        ])
        if (!listBox || !selectedBox) return Number.POSITIVE_INFINITY
        return Math.abs(listBox.y + listBox.height / 2 - (selectedBox.y + selectedBox.height / 2))
      })
      .toBeLessThanOrEqual(1)
  })
})

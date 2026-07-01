import { expect, test } from '@playwright/test'
import { pickTime, setupTrip } from './helpers'

// §11 time picker: the custom hour/minute wheel pop-over replaces the native
// time inputs on cards and the trip day window. (Card height is derived from the
// times and unit-tested in cardHeight.test.ts; here we only prove the wheel
// writes/clears the stored HH:mm.)

test('setting a card start + end through the wheel shows the time range', async ({ page }) => {
  await page.goto('/')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 })

  const firstColumn = page.locator('[data-testid="day-column"]').first()
  await firstColumn.getByRole('button', { name: /Add card/ }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Train ride')
  await editor.getByLabel('Set a time').check()
  await pickTime(editor, 'Start time', '10:00')
  await pickTime(editor, 'End time', '12:30')
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-time')).toHaveText('10:00–12:30')
})

test('clearing a card start time in the wheel untimes the card', async ({ page }) => {
  await page.goto('/')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 })

  const firstColumn = page.locator('[data-testid="day-column"]').first()
  await firstColumn.getByRole('button', { name: /Add card/ }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Card title').fill('Loose plan')
  await editor.getByLabel('Set a time').check()
  await pickTime(editor, 'Start time', '09:00')
  await editor.getByRole('button', { name: 'Save card' }).click()
  await expect(firstColumn.getByTestId('card-time')).toHaveText('09:00')

  // Reopen, clear the start time in the wheel, save → the card is untimed.
  await firstColumn.getByRole('button', { name: 'Edit Loose plan' }).click()
  const reopen = page.getByRole('dialog', { name: 'Card editor' })
  await reopen.getByRole('button', { name: 'Start time' }).click()
  await reopen.getByRole('dialog', { name: 'Start time' }).getByRole('button', { name: 'Clear' }).click()
  await reopen.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-time')).toHaveCount(0)
})

test('setting the trip day window through the wheel updates the field', async ({ page }) => {
  await page.goto('/')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 3 })

  await page.getByRole('button', { name: 'Trip' }).click()
  const trip = page.getByRole('dialog', { name: 'Trip details' })
  await expect(trip.getByRole('button', { name: 'Day start' })).toHaveText('06:00')
  await pickTime(trip, 'Day start', '08:00')
  await expect(trip.getByRole('button', { name: 'Day start' })).toHaveText('08:00')
})

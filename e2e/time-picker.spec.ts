import { expect, test } from '@playwright/test'
import { pickTime, setupTrip, E2E_LINK } from './helpers'

// Native time inputs preserve the existing HH:mm storage while using the
// platform's formatted time-entry surface.

test('setting a card start through the native input shows its start and duration', async ({ page }) => {
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

test('clearing a native card start time untimes the card', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const firstColumn = page.locator('[data-testid="day-column"]').first()
  await firstColumn.getByRole('button', { name: 'Add activity', exact: true }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })
  await editor.getByLabel('Title').fill('Loose plan')
  await pickTime(editor, 'Start time', '09:00')
  await editor.getByRole('button', { name: 'Save card' }).click()
  await expect(firstColumn.getByTestId('card-time')).toHaveText('09:00 · 1h 00m')

  // Reopen, clear the start time, save → the card is untimed.
  await firstColumn
    .getByTestId('card')
    .getByRole('button', { name: 'Edit Loose plan', exact: true })
    .click()
  const reopen = page.getByRole('dialog', { name: 'Card editor' })
  await reopen.getByLabel('Start time').fill('')
  await reopen.getByRole('button', { name: 'Save card' }).click()

  await expect(firstColumn.getByTestId('card-time')).toHaveText('1h 00m')
})

test('native trip day-window inputs update valid values and reject inverted windows', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  await page.getByRole('button', { name: 'Edit trip menu' }).click()
  await page.getByRole('dialog', { name: 'Edit trip' }).getByRole('button', { name: 'Trip details' }).click()
  const trip = page.getByRole('dialog', { name: 'Trip details' })
  await expect(trip.getByLabel('Day start')).toHaveValue('06:00')
  await pickTime(trip, 'Day start', '08:00')
  await expect(trip.getByLabel('Day start')).toHaveValue('08:00')
  await pickTime(trip, 'Day end', '08:00')
  await expect(trip.getByRole('alert')).toHaveText('Day end must be later than day start.')
  await expect(trip.getByLabel('Day end')).toHaveValue('21:00')
})

test.describe('mobile native time input', () => {
  test.use({ viewport: { width: 456, height: 652 }, hasTouch: true, isMobile: true })

  test('uses the 16px iOS-safe text size without opening a custom wheel', async ({ page }) => {
    await page.goto('/mobile-picker-e2e')
    await setupTrip(page, { title: 'Picker', startDate: '2027-05-01', endDate: '2027-05-01' })

    await page.getByRole('button', { name: 'Add activity', exact: true }).click()
    const editor = page.getByRole('dialog', { name: 'Card editor' })
    const input = editor.getByLabel('Start time')
    await expect(input).toHaveAttribute('type', 'time')
    expect(await input.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
    await expect(page.getByRole('dialog', { name: 'Start time' })).toHaveCount(0)
  })
})

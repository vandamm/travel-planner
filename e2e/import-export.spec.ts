import { expect, test } from '@playwright/test'

const TRIP = {
  trip: { title: 'Italy 2027', startDate: '2027-05-01', numDays: 2 },
  cities: [{ id: 'rome', name: 'Rome', color: '#ef4444' }],
  accommodations: [
    { id: 'stay-1', label: 'Hotel Roma', cityId: 'rome', startNight: '2027-05-01', endNight: '2027-05-01' },
  ],
  cards: [{ id: 'card-1', dayKey: '2027-05-01', title: 'Colosseum', order: 0 }],
}

test('import a trip JSON and see it render on the board', async ({ page }) => {
  await page.goto('/')

  // The board is empty before any trip is imported.
  await expect(page.getByTestId('board-empty')).toBeVisible()

  await page.getByRole('button', { name: 'Paste JSON' }).click()
  await page.getByLabel('Trip JSON').fill(JSON.stringify(TRIP))
  await page.getByRole('button', { name: 'Import trip' }).click()

  // Confirmation, and the imported settings flow back into the form.
  await expect(page.getByText('Trip imported.')).toBeVisible()
  await expect(page.getByLabel('Trip title')).toHaveValue('Italy 2027')

  // Two day columns, the imported card, and the imported stay all render.
  const columns = page.locator('[data-testid="day-column"]')
  await expect(columns).toHaveCount(2)
  await expect(columns.nth(0).getByTestId('card-title')).toHaveText('Colosseum')
  await expect(page.getByTestId('accommodation-bar')).toHaveText('Hotel Roma')
})

test('export downloads a JSON file for the current trip', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Trip title').fill('Italy 2027')
  await page.getByLabel('Start date').fill('2027-05-01')
  await page.getByLabel('Number of days').fill('2')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export trip' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('italy-2027.json')
})

test('a malformed import shows an error without changing the board', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Paste JSON' }).click()
  await page.getByLabel('Trip JSON').fill('{ not json')
  await page.getByRole('button', { name: 'Import trip' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByTestId('board-empty')).toBeVisible()
})

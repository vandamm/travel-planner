import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

// A minimal valid replacement document (full-replace apply target).
const REPLACEMENT = JSON.stringify({
  trip: { title: 'Spain 2028', startDate: '2028-06-01', endDate: '2028-06-02', dayStart: '06:00', dayEnd: '21:00' },
  cities: [],
  accommodations: [],
  cards: [],
  dayOverrides: {},
})

async function openJsonPanel(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Edit trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Trip details' })
  await dialog.getByText('Trip JSON (for AI)').click()
  return dialog
}

test('Trip JSON panel: show current + copy', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const dialog = await openJsonPanel(page)
  const current = dialog.getByLabel('Current trip JSON')
  await expect(current).toContainText('Italy 2027')

  await dialog.getByRole('button', { name: 'Copy' }).click()
  await expect(dialog.getByRole('button', { name: 'Copied' })).toBeVisible()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toContain('Italy 2027')
})

test('Trip JSON panel: paste valid JSON replaces the trip (after confirm)', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const dialog = await openJsonPanel(page)
  await dialog.getByLabel('Paste updated trip JSON').fill(REPLACEMENT)

  page.once('dialog', (d) => d.accept())
  await dialog.getByRole('button', { name: 'Apply' }).click()

  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Spain 2028' })).toBeVisible()
})

test('Trip JSON panel: confirm gates the apply (dismiss keeps the trip)', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const dialog = await openJsonPanel(page)
  await dialog.getByLabel('Paste updated trip JSON').fill(REPLACEMENT)

  page.once('dialog', (d) => d.dismiss())
  await dialog.getByRole('button', { name: 'Apply' }).click()

  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Italy 2027' })).toBeVisible()
})

test('Trip JSON panel: invalid JSON shows an error and does not apply', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

  const dialog = await openJsonPanel(page)
  await dialog.getByLabel('Paste updated trip JSON').fill('{ not valid json')
  // No confirm dialog should appear: parse fails before the confirm guard.
  await dialog.getByRole('button', { name: 'Apply' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Invalid JSON')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Italy 2027' })).toBeVisible()
})

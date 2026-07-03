import { expect, test } from '@playwright/test'
import { addCity, setupTrip } from './helpers'

test('set up a trip and add a city', async ({ page }) => {
  await page.goto('/#room=e2e')

  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 10 })

  // Live writes surface in the header wordmark + meta line.
  await expect(page.getByRole('heading', { name: 'Italy 2027' })).toBeVisible()
  await expect(page.getByTestId('app-meta')).toContainText('10 days')

  await addCity(page, 'Rome')
  await addCity(page, 'Florence')

  // Removing lives in the Cities modal.
  await page.getByRole('button', { name: 'Cities' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cities & colours' })
  await dialog.getByRole('button', { name: 'Remove Rome' }).click()
  await expect(dialog.getByLabel('Name for Rome')).toHaveCount(0)
})

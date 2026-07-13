import { expect, test } from '@playwright/test'
import { setupTrip } from './helpers'

test('a locally edited trip survives a reload', async ({ page }) => {
  const authRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth') authRequests.push(request.url())
  })
  await page.goto('/persistence-e2e')
  await expect(page.getByTestId('sync-status')).toHaveText('Local')
  await setupTrip(page, {
    title: 'Persistent trip',
    startDate: '2027-05-01',
    endDate: '2027-05-03',
  })

  await page.reload()

  await expect(page.getByRole('heading', { name: 'Persistent trip' })).toBeVisible()
  await expect(page.getByTestId('app-meta')).toHaveText(/3 days/)
  expect(authRequests).toEqual([])
})

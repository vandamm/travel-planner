import { expect, test, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

interface PlannerBridge {
  doc: unknown
  addCity: (doc: unknown, input: { id?: string; name: string; color: string }) => unknown
  addAccommodation: (
    doc: unknown,
    input: { label: string; startNight: string; endNight: string; cityId?: string },
  ) => unknown
}

// Seed cities + a covering stay via the dev bridge so colors are known (the
// Add-city UI auto-picks a random palette color, which we don't want to assert).
async function seed(page: Page) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(() => {
    const planner = (window as unknown as { __planner: PlannerBridge }).__planner
    planner.addCity(planner.doc, { id: 'rome', name: 'Rome', color: '#ef4444' })
    planner.addCity(planner.doc, { id: 'florence', name: 'Florence', color: '#3b82f6' })
    planner.addAccommodation(planner.doc, {
      label: 'Hotel Roma',
      cityId: 'rome',
      startNight: '2027-05-01',
      endNight: '2027-05-01',
    })
  })
}

test('per-day city override recolors the header and Auto reverts it', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-02' })
  await seed(page)

  const first = page.locator('[data-testid="day-column"]').nth(0)
  const band = first.getByTestId('city-band')

  // Day 1 resolves to Rome via the stay.
  await expect(band).toHaveCSS('background-color', 'rgb(239, 68, 68)') // #ef4444
  // Pin Florence from the header → recolors.
  await first.getByRole('button', { name: 'Choose city' }).click()
  await page.getByRole('button', { name: /Florence/ }).click()
  await expect(band).toHaveCSS('background-color', 'rgb(59, 130, 246)') // #3b82f6

  // Auto clears the override → reverts to the accommodation-resolved Rome.
  await first.getByRole('button', { name: 'Choose city' }).click()
  await page.getByRole('button', { name: /Auto/ }).click()
  await expect(band).toHaveCSS('background-color', 'rgb(239, 68, 68)')
})

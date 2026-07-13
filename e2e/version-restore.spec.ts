import { expect, test } from '@playwright/test'
import { setupTrip, RESTORE_LINK } from './helpers'

// The app is local-first with no live backend in e2e, so we mock the Access-gated
// version endpoints the Trip-settings panel calls. The snapshot we hand back is
// an earlier board state; restoring it should replace the current trip with it.
const SNAPSHOT = JSON.stringify({
  trip: {
    title: 'Restored Rome',
    startDate: '2027-05-01',
    endDate: '2027-05-02',
    dayStart: '06:00',
    dayEnd: '21:00',
  },
  cities: [],
  accommodations: [],
  cards: [],
  dayOverrides: {},
})
test('Recent versions: restore reverts the board to an earlier snapshot', async ({ page }) => {
  await page.route('**/api/versions/**', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined()
    const url = route.request().url()
    if (url.endsWith('/1000')) {
      await route.fulfill({ contentType: 'application/json', body: SNAPSHOT })
    } else {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ versions: [{ id: '1000', timestamp: 1000 }] }),
      })
    }
  })

  // A room slug in the path is what makes the "Recent versions" section render.
  await page.goto(RESTORE_LINK)
  await setupTrip(page, { title: 'Current Draft', startDate: '2027-05-01', endDate: '2027-05-03' })

  await page.getByRole('button', { name: 'Trip' }).click()
  const dialog = page.getByRole('dialog', { name: 'Trip details' })
  await dialog.getByText('Trip JSON (for AI)').click()
  await dialog.getByText('Recent versions').click()

  page.once('dialog', (d) => d.accept())
  await dialog.getByRole('button', { name: 'Restore' }).click()

  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Restored Rome' })).toBeVisible()
})

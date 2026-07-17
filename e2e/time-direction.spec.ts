import { expect, test, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

interface PlannerBridge {
  doc: unknown
  addCard: (doc: unknown, input: { dayKey: string; title: string; startTime?: string }) => unknown
}

// Seed cards on a given day via the dev bridge (the card-entry UI arrives in
// Task 6) so we can observe the direction toggle reorder them.
async function seedCards(
  page: Page,
  dayKey: string,
  cards: Array<{ title: string; startTime: string }>,
) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(
    ({ dayKey, cards }) => {
      const planner = (window as unknown as { __planner: PlannerBridge }).__planner
      for (const c of cards) {
        planner.addCard(planner.doc, { dayKey, title: c.title, startTime: c.startTime })
      }
    },
    { dayKey, cards },
  )
}

async function setUpTrip(page: Page) {
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', endDate: '2027-05-03' })
}

test('toggling time direction reverses card order and persists across reload', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setUpTrip(page)
  await seedCards(page, '2027-05-01', [
    { title: 'Breakfast', startTime: '08:00' },
    { title: 'Dinner', startTime: '19:00' },
  ])

  const firstColumn = page.locator('[data-testid="day-column"]').first()
  const titles = firstColumn.locator('[data-testid="card-title"]')

  // Default direction: morning at the top.
  await expect(titles).toHaveText(['Breakfast', 'Dinner'])

  // Toggle to bottom-to-top: the order reverses.
  await page.getByRole('button', { name: 'Toggle time direction' }).click()
  await expect(titles).toHaveText(['Dinner', 'Breakfast'])

  // The direction is a per-user preference (localStorage) and survives a reload.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Toggle time direction' })).toHaveText('↑')

  // After reload the persisted direction is applied to freshly rendered cards.
  await setUpTrip(page)
  await seedCards(page, '2027-05-02', [
    { title: 'Lunch', startTime: '12:00' },
    { title: 'Tea', startTime: '16:00' },
  ])
  const secondColumn = page.locator('[data-testid="day-column"]').nth(1)
  await expect(secondColumn.locator('[data-testid="card-title"]')).toHaveText(['Tea', 'Lunch'])
})

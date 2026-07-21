import { expect, test, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

interface PlannerBridge { doc: unknown; addCard: (doc: unknown, input: Record<string, unknown>) => unknown }

async function seed(page: Page) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(() => {
    const p = (window as unknown as { __planner: PlannerBridge }).__planner
    p.addCard(p.doc, { id: 'rome-card', dayKey: '2027-05-01', title: 'Rome walk', duration: 'custom', durationHours: 1, order: 0 })
    p.addCard(p.doc, { id: 'milan-card', dayKey: '2027-05-02', title: 'Milan walk', duration: 'custom', durationHours: 1, order: 0 })
  })
}

test('swapping days exchanges their activities', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy', startDate: '2027-05-01', endDate: '2027-05-02' })
  await seed(page)
  const first = page.getByTestId('day-column').nth(0)
  const second = page.getByTestId('day-column').nth(1)
  await first.getByRole('button', { name: 'Swap day' }).click()
  const dialog = page.getByRole('dialog', { name: 'Swap activity day' })
  await dialog.getByRole('button', { name: 'Swap days' }).click()
  await expect(first.getByTestId('card-title')).toHaveText('Milan walk')
  await expect(second.getByTestId('card-title')).toHaveText('Rome walk')
})

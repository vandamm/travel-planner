import { expect, test, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

interface PlannerBridge {
  doc: unknown
  addCard: (doc: unknown, input: Record<string, unknown>) => unknown
}

async function seedTimedCard(page: Page) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(() => {
    const planner = (window as unknown as { __planner: PlannerBridge }).__planner
    planner.addCard(planner.doc, {
      id: 'museum', dayKey: '2027-05-01', title: 'Museum', startTime: '10:00',
      duration: 'custom', durationHours: 1, order: 0,
    })
  })
}

test('dragging a resize edge commits a quarter-hour duration', async ({ page }) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Italy', startDate: '2027-05-01', endDate: '2027-05-01' })
  await seedTimedCard(page)

  const card = page.getByTestId('card').filter({ hasText: 'Museum' })
  const handle = card.getByRole('button', { name: 'Resize Museum end' })
  const box = await handle.boundingBox()
  if (!box) throw new Error('missing resize handle')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 15, { steps: 5 })
  await page.mouse.up()

  await expect(card.getByTestId('card-time')).toHaveText('10:00 · 1.25h')
})

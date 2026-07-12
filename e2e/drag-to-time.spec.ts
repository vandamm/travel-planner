import { expect, test, type Locator, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

/** Same stepped-pointer drag the dnd spec uses (the high-level dragTo is unreliable). */
async function dragHandleOnto(page: Page, handle: Locator, target: Locator) {
  await handle.scrollIntoViewIfNeeded()
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('missing bounding box for drag')

  const sx = from.x + from.width / 2
  const sy = from.y + from.height / 2
  const tx = to.x + to.width / 2
  const ty = to.y + to.height / 2

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx, sy + 10, { steps: 5 })
  await page.mouse.move(tx, ty, { steps: 20 })
  await page.waitForTimeout(200)
  await page.mouse.move(tx, ty + 1, { steps: 2 })
  await page.waitForTimeout(200)
  await page.mouse.up()
}

test('dragging an untimed card toward the evening gives it an evening time', async ({ page }) => {
  await page.goto(E2E_LINK)

  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-01' })

  // Seed a morning + evening timed card and one untimed card via the dev bridge.
  await page.evaluate(() => {
    const p = window.__planner!
    p.addCard(p.doc, { dayKey: '2027-05-01', title: 'Breakfast', startTime: '08:00' })
    p.addCard(p.doc, { dayKey: '2027-05-01', title: 'Dinner', startTime: '19:00' })
    p.addCard(p.doc, { dayKey: '2027-05-01', title: 'Stroll' })
  })

  const column = page.locator('[data-testid="day-column"]').first()
  const stroll = column.locator('[data-testid="card"]', { hasText: 'Stroll' })
  // Untimed to start with: no time chip.
  await expect(stroll.getByTestId('card-time')).toHaveCount(0)

  // Drag the untimed card onto the evening (Dinner) card → lands beside it and
  // gains a time between 08:00 and 19:00 (or after it), i.e. it becomes timed.
  const handle = column.getByRole('button', { name: 'Drag Stroll' })
  const dinner = column.locator('[data-testid="card"]', { hasText: 'Dinner' })
  await dragHandleOnto(page, handle, dinner)

  await expect(stroll.getByTestId('card-time')).toHaveCount(1)
})

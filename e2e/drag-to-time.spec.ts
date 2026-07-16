import { expect, test, type Locator, type Page } from '@playwright/test'
import { pickTime, setupTrip, E2E_LINK } from './helpers'

async function openLocalBoard(page: Page) {
  await page.route('**/api/auth', (route) => route.fulfill({ status: 503 }))
  await page.goto(E2E_LINK)
}

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
  await openLocalBoard(page)

  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', endDate: '2027-05-01' })

  const column = page.locator('[data-testid="day-column"]').first()
  for (const [title, time] of [
    ['Breakfast', '08:00'],
    ['Dinner', '19:00'],
    ['Stroll', undefined],
  ] as const) {
    await column.getByRole('button', { name: /Add card/ }).click()
    const editor = page.getByRole('dialog', { name: 'Card editor' })
    await editor.getByLabel('Card title').fill(title)
    if (time) {
      await editor.getByLabel('Set a time').check()
      await pickTime(editor, 'Start time', time)
    }
    await editor.getByRole('button', { name: 'Save card' }).click()
  }

  const stroll = column.locator('[data-testid="card"]', { hasText: 'Stroll' })
  await expect(stroll.getByTestId('card-time')).toHaveText('1h')

  // Drag the untimed card onto the evening (Dinner) card → lands beside it and
  // gains a time between 08:00 and 19:00 (or after it), i.e. it becomes timed.
  const handle = column.getByRole('button', { name: 'Drag Stroll' })
  const dinner = column.locator('[data-testid="card"]', { hasText: 'Dinner' })
  await dragHandleOnto(page, handle, dinner)

  await expect(stroll.getByTestId('card-time')).toHaveText(/19:(00|30) · 1h/)
  await expect(dinner.getByTestId('card-time')).toHaveText(/20:(00|30) · 1h/)
})

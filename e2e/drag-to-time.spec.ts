import { expect, test, type Locator, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

interface PlannerBridge {
  doc: unknown
  addCard: (doc: unknown, input: Record<string, unknown>) => unknown
}

async function openLocalBoard(page: Page) {
  await page.route('**/api/auth', (route) => route.fulfill({ status: 503 }))
  await page.goto(E2E_LINK)
}

async function seedTimedCards(page: Page) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(() => {
    const planner = (window as unknown as { __planner: PlannerBridge }).__planner
    for (const card of [
      {
        id: 'museum',
        dayKey: '2027-05-02',
        title: 'Museum',
        startTime: '10:00',
        duration: 'custom',
        durationHours: 1,
        order: 0,
      },
      {
        id: 'lunch',
        dayKey: '2027-05-02',
        title: 'Lunch',
        startTime: '11:00',
        duration: 'custom',
        durationHours: 1,
        order: 1,
      },
    ]) {
      planner.addCard(planner.doc, card)
    }
  })
}

async function holdSurfaceOnto(page: Page, surface: Locator, target: Locator) {
  const from = await surface.boundingBox()
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
  await page.waitForTimeout(100)
}

test('whole-card drag shows live timing and permits an overlap without moving its neighbor', async ({
  page,
}) => {
  await openLocalBoard(page)
  await setupTrip(page, {
    title: 'Italy 2027',
    startDate: '2027-05-01',
    endDate: '2027-05-07',
  })
  await seedTimedCards(page)

  const board = page.getByTestId('board-scroll')
  const column = page.locator('[data-testid="day-column"]').nth(1)
  const museum = column.locator('[data-testid="card"]', { hasText: 'Museum' })
  const lunch = column.locator('[data-testid="card"]', { hasText: 'Lunch' })
  await expect(museum).toBeVisible()
  await expect(lunch).toBeVisible()

  await board.evaluate((element) => {
    element.scrollLeft = 100
  })
  await page.evaluate(() => window.scrollTo(0, 120))
  const beforeScrollLeft = await board.evaluate((element) => element.scrollLeft)
  const beforeWindowScrollY = await page.evaluate(() => window.scrollY)
  const beforeBoard = await board.boundingBox()
  const beforeMuseum = await museum.boundingBox()

  await holdSurfaceOnto(page, museum, lunch)

  const preview = page.locator('[data-testid="drag-preview-card"]:visible')
  await expect(preview).toHaveCount(1)
  await expect(preview.getByTestId('event-timing-start')).toHaveText('11:00')
  await expect(preview.getByTestId('event-timing-end')).toHaveText('12:00')
  await expect(preview.getByTestId('card-time')).toHaveText('11:00 · 1h 00m')
  await expect(
    page.locator('[data-testid="card-title"]:visible').filter({ hasText: 'Museum' }),
  ).toHaveCount(1)
  await expect(page.getByRole('button', { name: /Resize Museum/ })).toHaveCount(0)

  await page.mouse.up()

  const movedMuseum = column.locator('[data-testid="card"]', { hasText: 'Museum' })
  const unchangedLunch = column.locator('[data-testid="card"]', { hasText: 'Lunch' })
  await expect(movedMuseum.getByTestId('card-time')).toHaveText('11:00 · 1h 00m')
  await expect(unchangedLunch.getByTestId('card-time')).toHaveText('11:00 · 1h 00m')
  await expect(movedMuseum.getByTestId('card-conflict')).toHaveText('Overlap')
  await expect(unchangedLunch.getByTestId('card-conflict')).toHaveText('Overlap')
  await expect(board).toHaveJSProperty('scrollLeft', beforeScrollLeft)
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeWindowScrollY)

  const afterBoard = await board.boundingBox()
  const afterMuseum = await movedMuseum.boundingBox()
  expect(afterBoard?.x).toBe(beforeBoard?.x)
  expect(afterBoard?.y).toBe(beforeBoard?.y)
  expect(afterMuseum?.x).toBe(beforeMuseum?.x)
})

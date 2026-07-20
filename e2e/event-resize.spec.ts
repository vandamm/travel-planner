import { expect, test, type Locator, type Page } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

interface PlannerBridge {
  doc: unknown
  addCard: (doc: unknown, input: Record<string, unknown>) => unknown
}

async function seedTimedCards(page: Page) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate(() => {
    const planner = (window as unknown as { __planner: PlannerBridge }).__planner
    for (const card of [
      {
        id: 'breakfast',
        dayKey: '2027-05-02',
        title: 'Breakfast',
        startTime: '09:30',
        duration: 'custom',
        durationHours: 1,
        order: 0,
      },
      {
        id: 'museum',
        dayKey: '2027-05-02',
        title: 'Museum',
        startTime: '10:00',
        duration: 'custom',
        durationHours: 1,
        order: 1,
      },
      {
        id: 'lunch',
        dayKey: '2027-05-02',
        title: 'Lunch',
        startTime: '11:00',
        duration: 'custom',
        durationHours: 1,
        order: 2,
      },
    ]) {
      planner.addCard(planner.doc, card)
    }
  })
}

async function holdResize(page: Page, handle: Locator, deltaY: number) {
  const box = await handle.boundingBox()
  if (!box) throw new Error('missing resize handle')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + deltaY)
  await page.waitForTimeout(50)
}

test('both resize edges show snapped live timing without moving overlapping neighbors', async ({
  page,
}) => {
  await page.goto(E2E_LINK)
  await setupTrip(page, {
    title: 'Italy',
    startDate: '2027-05-01',
    endDate: '2027-05-07',
  })
  await seedTimedCards(page)

  const board = page.getByTestId('board-scroll')
  const column = page.locator('[data-testid="day-column"]').nth(1)
  const card = (title: string) => column.locator('[data-testid="card"]', { hasText: title })
  await expect(card('Museum')).toBeVisible()

  await board.evaluate((element) => {
    element.scrollLeft = 100
  })
  await page.evaluate(() => window.scrollTo(0, 120))
  const beforeScrollLeft = await board.evaluate((element) => element.scrollLeft)
  const beforeWindowScrollY = await page.evaluate(() => window.scrollY)
  const beforeBoard = await board.boundingBox()
  const beforeMuseum = await card('Museum').boundingBox()

  await holdResize(page, card('Museum').getByRole('button', { name: 'Resize Museum start' }), -15)
  let hint = page.locator('[data-testid="event-timing-hint"]:visible')
  await expect(hint.getByTestId('event-timing-start')).toHaveText('09:45')
  await expect(hint.getByTestId('event-timing-end')).toHaveText('11:00')
  await expect(hint.getByTestId('event-timing-duration')).toHaveText('1h 15m')
  await expect(page.getByRole('button', { name: /Resize Museum/ })).toHaveCount(0)
  await page.mouse.up()

  await expect(card('Museum').getByTestId('card-time')).toHaveText('09:45 · 1.25h')
  await expect(card('Breakfast').getByTestId('card-time')).toHaveText('09:30 · 1h')

  await holdResize(page, card('Museum').getByRole('button', { name: 'Resize Museum end' }), 15)
  hint = page.locator('[data-testid="event-timing-hint"]:visible')
  await expect(hint.getByTestId('event-timing-start')).toHaveText('09:45')
  await expect(hint.getByTestId('event-timing-end')).toHaveText('11:15')
  await expect(hint.getByTestId('event-timing-duration')).toHaveText('1h 30m')
  await expect(page.getByRole('button', { name: /Resize Museum/ })).toHaveCount(0)
  await page.mouse.up()

  await expect(card('Museum').getByTestId('card-time')).toHaveText('09:45 · 1.5h')
  await expect(card('Breakfast').getByTestId('card-time')).toHaveText('09:30 · 1h')
  await expect(card('Lunch').getByTestId('card-time')).toHaveText('11:00 · 1h')
  await expect(card('Museum').getByTestId('card-conflict')).toHaveText('Overlap')
  await expect(card('Breakfast').getByTestId('card-conflict')).toHaveText('Overlap')
  await expect(card('Lunch').getByTestId('card-conflict')).toHaveText('Overlap')
  await expect(board).toHaveJSProperty('scrollLeft', beforeScrollLeft)
  expect(await page.evaluate(() => window.scrollY)).toBe(beforeWindowScrollY)

  const afterBoard = await board.boundingBox()
  const afterMuseum = await card('Museum').boundingBox()
  expect(afterBoard?.x).toBe(beforeBoard?.x)
  expect(afterBoard?.y).toBe(beforeBoard?.y)
  expect(afterMuseum?.x).toBe(beforeMuseum?.x)
})

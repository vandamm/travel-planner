import { expect, test, type Page } from '@playwright/test'
import { MIN_PX_PER_HOUR } from '../src/features/cards/cardHeight'
import { E2E_LINK, setupTrip } from './helpers'

/** Offline board (no IndexedDB, no auth round-trip) — the other specs' preamble. */
async function offlineBoard(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
    const fetch = globalThis.fetch
    globalThis.fetch = (input, init) =>
      String(input).includes('/api/auth') ? new Promise<Response>(() => {}) : fetch(input, init)
  })
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Travel', startDate: '2027-05-01', endDate: '2027-05-01' })
}

/** Seed one 09:00–11:00 card carrying a 45-minute travel lead-in. */
async function seedCardWithTravel(page: Page) {
  await page.evaluate(() => {
    const p = window.__planner!
    p.addCard(p.doc, {
      id: 'uffizi',
      dayKey: '2027-05-01',
      title: 'Uffizi',
      startTime: '09:00',
      duration: 'custom',
      durationHours: 2,
      travelMinutes: 45,
    })
  })
}

test('a travel lead-in draws a band fused above the card and occupies its time', async ({
  page,
}) => {
  await offlineBoard(page)
  await seedCardWithTravel(page)

  const column = page.getByTestId('day-column').first()
  const band = column.getByTestId('card-travel-band')
  await expect(band).toHaveText('45 min travel')

  const bandBox = (await band.boundingBox())!
  const cardBox = (await column.getByTestId('card').boundingBox())!
  // 45 minutes tall at the board's own scale, and flush against the card's top.
  expect(bandBox.height).toBeCloseTo((45 / 60) * MIN_PX_PER_HOUR, 0)
  expect(bandBox.y + bandBox.height).toBeCloseTo(cardBox.y, 0)

  // The card says when to set off.
  await expect(column.getByTestId('card-leave-by')).toHaveText('leave by 08:15')

  // The morning gap ends at 08:15, not 09:00: the drive there is already spent,
  // so "＋ plan something" must not offer it.
  await expect(column.getByTestId('timeline-slot').first()).toHaveAttribute(
    'aria-label',
    'Plan something between 06:00 and 08:15',
  )
})

test('switching travel times off keeps the value as a badge and gives the time back', async ({
  page,
}) => {
  await offlineBoard(page)
  await seedCardWithTravel(page)
  await page.evaluate(() => {
    const p = window.__planner!
    p.setTrip(p.doc, { showTravelTimes: false })
  })

  const column = page.getByTestId('day-column').first()
  await expect(column.getByTestId('card-travel-band')).toHaveCount(0)
  await expect(column.getByTestId('card-travel-badge')).toHaveText('+45m')
  await expect(column.getByTestId('timeline-slot').first()).toHaveAttribute(
    'aria-label',
    'Plan something between 06:00 and 09:00',
  )
})

test('the editor switches a lead-in on and reports what it occupies', async ({ page }) => {
  await offlineBoard(page)
  await seedCardWithTravel(page)

  const column = page.getByTestId('day-column').first()
  await column.getByTestId('card-title-row').getByRole('button', { name: 'Edit Uffizi' }).click()
  const editor = page.getByRole('dialog', { name: 'Card editor' })

  await expect(editor.getByTestId('travel-minutes')).toHaveText('45min')
  await expect(editor.getByTestId('travel-summary')).toContainText('Leave by 08:15')
  await expect(editor.getByTestId('travel-summary')).toContainText('occupies 08:15 – 11:00')

  await editor.getByRole('button', { name: 'More travel time' }).click()
  await expect(editor.getByTestId('travel-summary')).toContainText('Leave by 08:00')

  await editor.getByRole('switch', { name: 'Travel time' }).click()
  await expect(editor.getByTestId('travel-summary')).toHaveCount(0)
  await editor.getByRole('button', { name: 'Save card' }).click()

  await expect(column.getByTestId('card-travel-band')).toHaveCount(0)
})

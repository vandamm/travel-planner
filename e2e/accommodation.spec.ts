import { expect, test, type Page } from '@playwright/test'
import { addCity, pickRange, setupTrip } from './helpers'

interface PlannerBridge {
  doc: unknown
  addAccommodation: (
    doc: unknown,
    input: { label: string; startNight: string; endNight: string; cityId?: string },
  ) => unknown
}

// Seed stays via the dev bridge so we can arrange a specific coverage gap
// without clicking through the editor for each one.
async function seedStays(
  page: Page,
  stays: Array<{ label: string; startNight: string; endNight: string }>,
) {
  await page.waitForFunction(() => Boolean((window as { __planner?: unknown }).__planner))
  await page.evaluate((stays) => {
    const planner = (window as unknown as { __planner: PlannerBridge }).__planner
    for (const s of stays) planner.addAccommodation(planner.doc, s)
  }, stays)
}

test('add an accommodation and see day headers recolor', async ({ page }) => {
  await page.goto('/')

  // A trip with days plus a city to assign the stay to.
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 4 })
  await addCity(page, 'Rome')

  const columns = page.locator('[data-testid="day-column"]')
  const firstBand = columns.nth(0).getByTestId('city-band')
  // No covering stay yet → neutral band color.
  await expect(firstBand).toHaveCSS('background-color', 'rgb(194, 187, 168)') // ink-200 warm neutral

  // Add a stay covering the first two nights, in Rome.
  await page.getByRole('button', { name: 'Add stay' }).click()
  const editor = page.getByRole('dialog', { name: 'Accommodation editor' })
  await editor.getByLabel('Accommodation label').fill('Hotel Roma')
  await editor.getByLabel('City').selectOption({ label: 'Rome' })
  await pickRange(editor, 'Stay nights', '2027-05-01', '2027-05-02')
  await editor.getByRole('button', { name: 'Save stay' }).click()

  // The bar shows up in the lane…
  await expect(page.getByTestId('accommodation-bar')).toHaveText('Hotel Roma')

  // …and the first two day headers now carry Rome's color (auto-assigned from the
  // palette when the city was added), while the third stays neutral. The default
  // color is random, so compare the covered days against the actually applied
  // color rather than a hard-coded value.
  const stayColor = await firstBand.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(stayColor).not.toBe('rgb(194, 187, 168)') // a real city color, not the neutral fallback
  await expect(columns.nth(0).getByTestId('city-name')).toHaveText('Rome')
  await expect(columns.nth(1).getByTestId('city-band')).toHaveCSS('background-color', stayColor)
  await expect(columns.nth(2).getByTestId('city-band')).toHaveCSS('background-color', 'rgb(194, 187, 168)')

  // Editing the stay from its bar updates the label live.
  await page.getByTestId('accommodation-bar').click()
  const editAgain = page.getByRole('dialog', { name: 'Accommodation editor' })
  await editAgain.getByLabel('Accommodation label').fill('Hotel Roma Centro')
  await editAgain.getByRole('button', { name: 'Save stay' }).click()
  await expect(page.getByTestId('accommodation-bar')).toHaveText('Hotel Roma Centro')
})

test('stays lane shows gap and right-end Add stay buttons', async ({ page }) => {
  await page.goto('/')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 5 })

  // With no stays the whole trip is one gap: the right-end button is present and
  // a single gap button sits on the first day.
  await expect(page.getByTestId('add-stay')).toBeVisible()
  await expect(page.getByTestId('add-stay-gap')).toHaveCount(1)
  await expect(page.getByTestId('add-stay-gap')).toHaveAttribute('data-gap-start', '2027-05-01')

  // Cover days 1–2 and 4–5, leaving day 3 (2027-05-03) as a middle gap.
  await seedStays(page, [
    { label: 'Hotel A', startNight: '2027-05-01', endNight: '2027-05-02' },
    { label: 'Hotel B', startNight: '2027-05-04', endNight: '2027-05-05' },
  ])

  const gapButton = page.getByTestId('add-stay-gap')
  await expect(gapButton).toHaveCount(1)
  await expect(gapButton).toHaveAttribute('data-gap-start', '2027-05-03')
  await expect(page.getByTestId('add-stay')).toBeVisible()

  // Clicking the gap button opens the editor seeded with the gap's first day.
  await gapButton.click()
  const editor = page.getByRole('dialog', { name: 'Accommodation editor' })
  await expect(editor.getByRole('button', { name: 'Stay nights' })).toContainText('03.05')
})

test('Add-stay popup preselects the first uncovered night and saves a range', async ({ page }) => {
  await page.goto('/')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 5 })

  // Cover the first two nights; the right-end "Add stay" should preselect the
  // first uncovered night (day 3) as both range endpoints (a one-night default).
  await seedStays(page, [{ label: 'Hotel A', startNight: '2027-05-01', endNight: '2027-05-02' }])

  await page.getByTestId('add-stay').click()
  const editor = page.getByRole('dialog', { name: 'Accommodation editor' })
  const nights = editor.getByRole('button', { name: 'Stay nights' })
  await expect(nights).toContainText('03.05 → 03.05')

  // Pick a two-night range through the calendar → the trigger reflects first→last.
  await pickRange(editor, 'Stay nights', '2027-05-03', '2027-05-04')
  await expect(nights).toContainText('03.05 → 04.05')

  // Saving persists the stay.
  await editor.getByLabel('Accommodation label').fill('Hotel C')
  await editor.getByRole('button', { name: 'Save stay' }).click()
  await expect(page.getByTestId('accommodation-bar').filter({ hasText: 'Hotel C' })).toBeVisible()
})

test('two stays sharing a changeover day render on one row meeting mid-day', async ({ page }) => {
  await page.goto('/')
  await setupTrip(page, { title: 'Italy 2027', startDate: '2027-05-01', numDays: 5 })

  // A checks out 05-03; B checks in 05-03 — a pure changeover, only that day shared.
  await seedStays(page, [
    { label: 'Hotel A', startNight: '2027-05-01', endNight: '2027-05-03' },
    { label: 'Hotel B', startNight: '2027-05-03', endNight: '2027-05-05' },
  ])

  const barA = page.getByTestId('accommodation-bar').filter({ hasText: 'Hotel A' })
  const barB = page.getByTestId('accommodation-bar').filter({ hasText: 'Hotel B' })
  await expect(barA).toBeVisible()
  await expect(barB).toBeVisible()

  const a = await barA.boundingBox()
  const b = await barB.boundingBox()
  if (!a || !b) throw new Error('missing bar geometry')

  // Same row: identical top (chained, not stacked).
  expect(Math.abs(a.y - b.y)).toBeLessThan(2)
  // They meet near the middle of the shared day: B starts right where A ends —
  // not overlapping, and within roughly a column gap (the inset formula folds in
  // half the 0.75rem gap), nowhere near a full column apart.
  const aRight = a.x + a.width
  const between = b.x - aRight
  expect(between).toBeGreaterThanOrEqual(-1)
  expect(between).toBeLessThan(16)
})

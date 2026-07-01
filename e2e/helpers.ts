import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Navigate an open calendar Popover to `iso`'s month (stepping ‹/› by the month
 * delta read off `data-month`) and click that day cell. Only in-month days carry
 * `data-key`, so the selector is unambiguous.
 */
async function clickCalendarDay(cal: Locator, iso: string) {
  const targetYear = Number(iso.slice(0, 4))
  const targetMonth = Number(iso.slice(5, 7))
  for (let guard = 0; guard < 120; guard++) {
    const cur = await cal.locator('[data-month]').getAttribute('data-month')
    if (!cur) break
    const diff = (targetYear - Number(cur.slice(0, 4))) * 12 + (targetMonth - Number(cur.slice(5, 7)))
    if (diff === 0) break
    await cal.getByRole('button', { name: diff > 0 ? 'Next month' : 'Previous month' }).click()
  }
  await cal.locator(`[data-key="${iso}"]`).click()
}

/** Pick a single date through the custom calendar pop-over (trip start etc.). */
export async function pickDate(scope: Page | Locator, triggerName: string, iso: string) {
  await scope.getByRole('button', { name: triggerName }).click()
  await clickCalendarDay(scope.getByRole('dialog', { name: triggerName }), iso)
}

/** Pick a first→last night range through the custom calendar pop-over. */
export async function pickRange(
  scope: Page | Locator,
  triggerName: string,
  startIso: string,
  endIso: string,
) {
  await scope.getByRole('button', { name: triggerName }).click()
  const cal = scope.getByRole('dialog', { name: triggerName })
  await clickCalendarDay(cal, startIso)
  await clickCalendarDay(cal, endIso)
}

/** Pick a time through the custom hour/minute wheel pop-over (card / day window). */
export async function pickTime(scope: Page | Locator, triggerName: string, hhmm: string) {
  const [hh, mm] = hhmm.split(':')
  await scope.getByRole('button', { name: triggerName }).click()
  const wheel = scope.getByRole('dialog', { name: triggerName })
  await wheel.getByRole('option', { name: `Hour ${hh}` }).click()
  await wheel.getByRole('option', { name: `Minute ${mm}` }).click()
  await wheel.getByRole('button', { name: `Set ${hhmm}` }).click()
}

/** Below the 1024px `lg` breakpoint the inline Trip/Cities buttons collapse into
 *  the header ≡ menu, so the path to those editors differs by viewport. */
function isMobile(page: Page): boolean {
  const size = page.viewportSize()
  return size !== null && size.width < 1024
}

/** Open Trip / Cities, handling the mobile ≡ menu vs. the desktop inline button. */
async function openEditor(page: Page, menuItem: 'Trip setup' | 'Cities & colours', inline: 'Trip' | 'Cities') {
  if (isMobile(page)) {
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: menuItem }).click()
  } else {
    await page.getByRole('button', { name: inline }).click()
  }
}

/**
 * Open the Trip pop-over (via the ≡ menu on mobile, the inline button on
 * desktop), fill the given trip fields (live writes), and close it. Centralises
 * the inline→modal churn so specs that only need a set-up trip as a precondition
 * don't each re-encode the modal flow.
 */
export async function setupTrip(
  page: Page,
  { title, startDate, numDays }: { title?: string; startDate?: string; numDays?: number | string },
) {
  await openEditor(page, 'Trip setup', 'Trip')
  const dialog = page.getByRole('dialog', { name: 'Trip details' })
  if (title !== undefined) await dialog.getByLabel('Trip title').fill(title)
  if (startDate !== undefined) await pickDate(dialog, 'Start date', startDate)
  if (numDays !== undefined) await dialog.getByLabel('Number of days').fill(String(numDays))
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toHaveCount(0)
}

/**
 * Open the `[◉ Cities]` header pop-over, add a city, wait for its row, then close
 * — so the board underneath stays interactable for the caller. Centralises the
 * inline→modal churn; specs that need to keep the modal open (e.g. to remove a
 * city) open it themselves.
 */
export async function addCity(page: Page, name: string) {
  await openEditor(page, 'Cities & colours', 'Cities')
  const dialog = page.getByRole('dialog', { name: 'Cities & colours' })
  await dialog.getByLabel('New city name').fill(name)
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(dialog.getByLabel(`Name for ${name}`)).toHaveValue(name)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
}

import { expect, type Locator, type Page } from '@playwright/test'

/** The default e2e board link (room "e2e"). */
export const E2E_LINK = '/e2e'

/** A distinct board used by the version-restore spec. */
export const RESTORE_LINK = '/restore-test'

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
    const diff =
      (targetYear - Number(cur.slice(0, 4))) * 12 + (targetMonth - Number(cur.slice(5, 7)))
    if (diff === 0) break
    await cal.getByRole('button', { name: diff > 0 ? 'Next month' : 'Previous month' }).click()
  }
  await cal.locator(`[data-key="${iso}"]`).click()
}

function pageOf(scope: Page | Locator): Page {
  return 'page' in scope ? scope.page() : scope
}

/** Pick a single date through the custom calendar pop-over (trip start etc.). */
export async function pickDate(scope: Page | Locator, triggerName: string, iso: string) {
  await scope.getByRole('button', { name: triggerName }).click()
  await clickCalendarDay(pageOf(scope).getByRole('dialog', { name: triggerName }), iso)
}

/** Pick a first→last night range through the custom calendar pop-over. */
export async function pickRange(
  scope: Page | Locator,
  triggerName: string,
  startIso: string,
  endIso: string,
) {
  await scope.getByRole('button', { name: triggerName }).click()
  const cal = pageOf(scope).getByRole('dialog', { name: triggerName })
  await clickCalendarDay(cal, startIso)
  await clickCalendarDay(cal, endIso)
}

/** Fill a native time input (card / day window). */
export async function pickTime(scope: Page | Locator, triggerName: string, hhmm: string) {
  await scope.getByLabel(triggerName).fill(hhmm)
}

/** Open the card editor from the first free-time gap in a day. */
export async function addActivity(scope: Page | Locator) {
  const target = scope.getByTestId('timeline-slot').first()
  await expect(target).toBeAttached()
  await target.click()
}

/**
 * Open Trip / Cities. On desktop they are visible toolbar buttons (the ✎ popover
 * is gone in v4); on mobile they still collapse into the ≡ menu.
 */
async function openEditor(page: Page, menuItem: 'Trip details' | 'Cities & colours') {
  // Decide by width, not by probing visibility — the toolbar may not have
  // rendered yet when the helper runs, and a false negative sends us to a
  // control the mobile layout does not have.
  if ((page.viewportSize()?.width ?? 0) < 400) {
    const menuButton = page.getByRole('button', { name: 'Menu', exact: true })
    await menuButton.click()
    await page
      .getByRole('dialog', { name: 'Menu' })
      .getByRole('button', { name: menuItem === 'Trip details' ? 'Trip setup' : menuItem })
      .click()
    return
  }
  await page
    .getByRole('button', { name: menuItem === 'Trip details' ? 'Trip' : 'Cities', exact: true })
    .click()
}

/**
 * Open the Trip pop-over (via the ≡ menu on mobile, the inline button on
 * desktop), fill the given trip fields (live writes), and close it. Centralises
 * the inline→modal churn so specs that only need a set-up trip as a precondition
 * don't each re-encode the modal flow.
 */
export async function setupTrip(
  page: Page,
  { title, startDate, endDate }: { title?: string; startDate?: string; endDate?: string },
) {
  await openEditor(page, 'Trip details')
  const dialog = page.getByRole('dialog', { name: 'Trip details' })
  if (title !== undefined) await dialog.getByLabel('Trip title').fill(title)
  if (startDate !== undefined) await pickDate(dialog, 'Start date', startDate)
  if (endDate !== undefined) await pickDate(dialog, 'End date', endDate)
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
  await openEditor(page, 'Cities & colours')
  const dialog = page.getByRole('dialog', { name: 'Cities & colours' })
  await dialog.getByLabel('New city name').fill(name)
  await dialog.getByRole('button', { name: 'Add' }).click()
  await expect(dialog.getByLabel(`Name for ${name}`)).toHaveValue(name)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
}

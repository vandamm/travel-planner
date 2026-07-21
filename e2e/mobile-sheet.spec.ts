import { expect, test } from '@playwright/test'
import { addActivity, setupTrip, E2E_LINK } from './helpers'

// The shared Modal is a full-screen slide-up sheet on phones (base classes) and
// the Phase-2 centered scrim card on desktop (`lg:`). The switch is pure CSS at
// the 1024px `lg` breakpoint, so we assert both viewports drive the same DOM.

const MOBILE = { width: 375, height: 667 }

async function openCardEditor(page: import('@playwright/test').Page) {
  await page.goto(E2E_LINK)
  await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', endDate: '2027-05-03' })
  const firstColumn = page.locator('[data-testid="day-column"]').first()
  await addActivity(firstColumn)
  return page.getByRole('dialog', { name: 'Card editor' })
}

test.describe('mobile: editors are full-screen sheets', () => {
  test.use({ viewport: MOBILE, hasTouch: true, isMobile: true })

  test('the card editor fills the viewport and shows a Close control', async ({ page }) => {
    const dialog = await openCardEditor(page)
    await expect(dialog).toBeVisible()

    // Sheet: the dialog fills (≈) the whole 375×667 viewport.
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(MOBILE.width - 1)
    expect(box!.height).toBeGreaterThanOrEqual(MOBILE.height - 1)

    // The mobile back/close control is present and closes the sheet.
    const close = dialog.getByRole('button', { name: 'Close' })
    await expect(close).toBeVisible()
    await close.click()
    await expect(dialog).toHaveCount(0)
  })
})

test.describe('desktop: editors are centered scrim cards', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the card editor is a card narrower than the viewport, no Close control', async ({
    page,
  }) => {
    const dialog = await openCardEditor(page)
    await expect(dialog).toBeVisible()

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeLessThan(1280)

    // The `‹` Close control is mobile-only (`lg:hidden`) → absent from the a11y tree.
    await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0)
  })
})

import { expect, test } from '@playwright/test'
import { setupTrip, E2E_LINK } from './helpers'

// The edit menu remains beside the title at every width. On a phone the separate
// ≡ action sheet still carries the mobile Add stay action.

test.describe('mobile: ≡ menu', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

  test('collapses Trip/Cities/Add-stay into the ≡ menu', async ({ page }) => {
    await page.goto(E2E_LINK)

    await expect(page.getByRole('button', { name: 'Edit trip menu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cities & colours' })).toHaveCount(0)
    const menuButton = page.getByRole('button', { name: 'Menu', exact: true })
    await expect(menuButton).toBeVisible()

    // A trip so "Add stay" has sensible night defaults.
    await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', endDate: '2027-05-03' })

    // ≡ → Trip setup opens the Trip sheet.
    await menuButton.click()
    const menu = page.getByRole('dialog', { name: 'Menu' })
    await menu.getByRole('button', { name: 'Trip setup' }).click()
    await expect(page.getByRole('dialog', { name: 'Trip details' })).toBeVisible()
    await page.keyboard.press('Escape')

    // ≡ → Cities & colours opens the Cities sheet.
    await menuButton.click()
    await menu.getByRole('button', { name: 'Cities & colours' }).click()
    await expect(page.getByRole('dialog', { name: 'Cities & colours' })).toBeVisible()
    await page.keyboard.press('Escape')

    // ≡ → Add stay opens the Accommodation sheet.
    await menuButton.click()
    await menu.getByRole('button', { name: 'Add stay' }).click()
    await expect(page.getByRole('dialog', { name: 'Accommodation editor' })).toBeVisible()
  })
})

test.describe('desktop: consolidated edit menu', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('keeps trip and city actions in one menu and has no ≡', async ({ page }) => {
    await page.goto(E2E_LINK)
    await page.getByRole('button', { name: 'Edit trip menu' }).click()
    const editMenu = page.getByRole('dialog', { name: 'Edit trip' })
    await expect(editMenu.getByRole('button', { name: 'Trip details' })).toBeVisible()
    await expect(editMenu.getByRole('button', { name: 'Cities & colours' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add stay' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveCount(0)
  })
})

import { expect, test } from '@playwright/test'
import { setupTrip } from './helpers'

// On a phone the crowded inline [✎ Trip]/[◉ Cities] header buttons collapse into
// a ≡ menu (a shared-Modal sheet) that also carries "Add stay". On desktop the
// inline buttons stay and there is no ≡.

test.describe('mobile: ≡ menu', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

  test('collapses Trip/Cities/Add-stay into the ≡ menu', async ({ page }) => {
    await page.goto('/')

    // Inline buttons are lg:-only → not in the mobile a11y tree; ≡ is present.
    await expect(page.getByRole('button', { name: 'Trip' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Cities' })).toHaveCount(0)
    const menuButton = page.getByRole('button', { name: 'Menu' })
    await expect(menuButton).toBeVisible()

    // A trip so "Add stay" has sensible night defaults.
    await setupTrip(page, { title: 'Japan 2027', startDate: '2027-05-01', numDays: 3 })

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

test.describe('desktop: inline header buttons', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('keeps inline Trip/Cities and has no ≡', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Trip' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cities' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0)
  })
})

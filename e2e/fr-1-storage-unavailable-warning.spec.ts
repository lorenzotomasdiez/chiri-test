import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

/**
 * T-FR-1-17 / PRD Q1-b: local storage that starts working and then throws
 * mid-session (a quota hit, or the browser silently blocking writes) must not
 * crash the app - it degrades to an in-memory settings object and shows a
 * standing, dismissible warning (src/components/StorageWarningBanner.tsx),
 * per the tech blueprint's "in-memory with a persistent visible banner"
 * resolution of open question 2.
 */
test('a settings write that throws shows the storage warning, and dismissing it clears it', async ({
  page,
}) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await expect(page.getByRole('textbox')).toBeVisible()

  await expect(page.getByTestId('storage-warning')).not.toBeVisible()

  // Every write from here on throws, as a full or blocked localStorage would.
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }
  })

  await page.getByRole('button', { name: 'Predictions' }).click()

  const banner = page.getByTestId('storage-warning')
  await expect(banner).toBeVisible()
  await expect(banner).toContainText("can't save your work")

  await banner.getByTestId('dismiss-button').click()
  await expect(banner).not.toBeVisible()
})

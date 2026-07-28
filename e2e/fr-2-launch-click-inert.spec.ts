import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test('T-FR-2-7: Clicking during the launch state has no effect (AC-2.4, CC-SPLASH.5)', async ({
  page,
}) => {
  await seedValidatedKey(page)
  await page.goto('/')

  // Capture the start time for measuring dwell duration
  const startTime = Date.now()

  // Verify splash is visible
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // Perform clicks within the first ~300ms of the dwell
  await page.mouse.click(400, 300)
  await page.mouse.click(20, 20)

  // Immediately after clicks, splash must still be visible - clicks do not
  // dismiss or skip ahead (no dismissal affordance exists per AC-2.4).
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // URL must be unchanged
  expect(page.url()).toBe('http://localhost:5173/')

  // Wait for the splash to disappear, which marks the end of the dwell. The
  // clicks must not have shortened the dwell - measure elapsed time and assert
  // it is >= 1100ms (leaving ~100ms margin on the 1200ms SPLASH_MIN_DWELL_MS).
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)
  const elapsedMs = Date.now() - startTime

  expect(elapsedMs).toBeGreaterThanOrEqual(1100)

  // The editor must now be visible (AC-2.3 with stored key)
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()
})

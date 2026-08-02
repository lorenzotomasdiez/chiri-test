import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, moveCaret, snapshot } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

// AC-10.5 / T-FR-10-7: turning continuation off is not just a session-local
// UI state - it has to survive a reload, and the scheduler wiring at boot
// has to actually honor the persisted value rather than defaulting back on.
test('T-FR-10-7: Turning continuation off persists across reload, and no request is issued after reload', async ({
  page,
}) => {
  const toggle = page.locator('button[aria-label="Predictions"]')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  const stored = await page.evaluate(() => localStorage.getItem('chiri-settings'))
  expect(JSON.parse(stored ?? '{}').continuationEnabled).toBe(false)

  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // The setting still reads off after reload.
  const reloadedToggle = page.locator('button[aria-label="Predictions"]')
  await expect(reloadedToggle).toHaveAttribute('aria-pressed', 'false')
  const restoredStored = await page.evaluate(() => localStorage.getItem('chiri-settings'))
  expect(JSON.parse(restoredStored ?? '{}').continuationEnabled).toBe(false)

  const mock = await mockOpenRouter(page, { continuation: ' the kettle went on.' })

  const doc = 'The cabin sat quiet under the first snow, and'
  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)
  await page.waitForTimeout(PAST_SETTLE_MS)

  // An eligible caret position after a long pause still issues nothing.
  await moveCaret(page, doc.length)
  await page.waitForTimeout(PAST_SETTLE_MS)

  const state = await snapshot(page)
  expect(state.ghost).toBeNull()
  expect(state.ghostWidgets).toBe(0)
  expect(mock.continuationCount(), 'requests issued after reload with predictions off').toBe(0)
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, snapshot } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-27: The off state persists across a reload', async ({ page }) => {
  const doc = 'The cabin sat quiet under the first snow of the season, and'

  const toggle = page.locator('button[aria-label="Predictions"]')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // A preference the writer set once is not a preference they should have to
  // set again every session.
  await expect(page.locator('button[aria-label="Predictions"]')).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  const mock = await mockOpenRouter(page, { continuation: ' the road out had vanished.' })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)
  await page.waitForTimeout(PAST_SETTLE_MS)

  expect(mock.continuationCount(), 'requests issued after reloading with predictions off').toBe(0)

  const state = await snapshot(page)
  expect(state.ghost).toBeNull()
  expect(state.ghostWidgets).toBe(0)
  expect(state.doc).toBe(doc)
})

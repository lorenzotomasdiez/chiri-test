import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, snapshot } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/**
 * The UI half of T-FR-5-19. The sanitizer's behaviour is settled by
 * src/core/continuation.blank-response.test.ts; this is the confirmation that
 * a response with nothing in it produces no widget and no complaint.
 */
for (const [label, body] of [
  ['an empty response', ''],
  ['a whitespace-only response', '   \n\n \t '],
] as const) {
  test(`T-FR-5-19: ${label} shows nothing and no error`, async ({ page }) => {
    const doc = 'The cabin sat quiet under the first snow of the season, and'

    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    const mock = await mockOpenRouter(page, { continuation: body })

    await page.locator('.cm-content').click()
    await page.keyboard.type(doc)
    await page.waitForTimeout(PAST_SETTLE_MS)

    expect(mock.continuationCount(), 'the request should have been made').toBeGreaterThan(0)

    const state = await snapshot(page)
    expect(state.ghost).toBeNull()
    expect(state.ghostWidgets).toBe(0)
    expect(state.doc).toBe(doc)

    await expect(page.locator('[role="alert"]')).toHaveCount(0)
    await expect(page.locator('[role="dialog"]')).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })
}

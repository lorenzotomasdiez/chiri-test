import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

/** Wraps one fragment of continuation text in the SSE frame OpenRouter sends for it. */
function continuationFrame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-28: A shown continuation is announced to assistive technology', async ({ page }) => {
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: continuationFrame(' the pot for coffee.') + 'data: [DONE]\n\n',
    })
  })

  const announcer = page.locator('[data-testid="ghost-announcer"]')

  // AC-5.14 covers the announcement, not the visual treatment: the region
  // exists and is empty before any continuation is requested.
  await expect(announcer).toBeAttached()
  await expect(announcer).toHaveText('')

  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('- Pack the tent, the stove, and')

  await page.waitForSelector('[data-testid="ghost-text"]', { timeout: 5000 })

  // The live region's text is what a screen reader would announce - it must
  // change the instant the ghost is shown, not stay silent while only the
  // (visual-only) widget appears.
  await expect(announcer).not.toHaveText('')

  // Accepting clears the ghost, so the announcement clears with it rather
  // than continuing to claim a suggestion is available.
  await page.keyboard.press('Tab')
  await expect(announcer).toHaveText('')
})

test('T-FR-5-28: Dismissing a continuation by typing clears its announcement too', async ({
  page,
}) => {
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: continuationFrame(' the pot for coffee.') + 'data: [DONE]\n\n',
    })
  })

  const announcer = page.locator('[data-testid="ghost-announcer"]')

  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('- Pack the tent, the stove, and')
  await page.waitForSelector('[data-testid="ghost-text"]', { timeout: 5000 })
  await expect(announcer).not.toHaveText('')

  await page.keyboard.type(' more')

  await expect(page.locator('[data-testid="ghost-text"]')).toHaveCount(0)
  await expect(announcer).toHaveText('')
})

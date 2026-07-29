import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => Promise.reject(new Error('denied')),
      },
      configurable: true,
    })
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-SHAPE-3: FailureBanner uses the spec\'s whisper shadow, not a stronger one', async ({
  page,
}) => {
  // Given a clipboard failure has surfaced the FailureBanner
  const copyButton = page.getByRole('button', { name: 'Copy' })
  await copyButton.click()

  const failureMessage = page.locator('[data-testid="failure-message"]')
  await expect(failureMessage).toBeVisible()

  // Then its box-shadow matches CC-SHAPE.3's canonical whisper shadow
  // (0 4px 32px rgba(0,0,0,0.02)), the same value KeyGateModal's card uses,
  // not a stronger shadow that would read as elevation.
  const boxShadow = await failureMessage.evaluate((el) => window.getComputedStyle(el).boxShadow)
  expect(boxShadow).toContain('rgba(0, 0, 0, 0.02) 0px 4px 32px 0px')
  expect(boxShadow).not.toContain('0.08)')
})

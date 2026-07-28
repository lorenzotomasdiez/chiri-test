import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-4-6: First-ever session starts with an empty, persisted-from-scratch document', async ({ page }) => {
  // Verify the document is empty
  const docContent = await page.evaluate(() => {
    return window.__editor.state.doc.toString()
  })
  expect(docContent).toBe('')

  // Verify the FR-11 onboarding cue is visible
  const onboardingCue = page.locator('[data-testid="onboarding-cue"]')
  await expect(onboardingCue).toBeVisible()

  // Verify no error/banner surface is shown
  const alertElement = page.locator('[role="alert"]')
  await expect(alertElement).toHaveCount(0)

  // Verify typing Hello immediately lands in the document
  const editor = page.locator('[data-testid="editor"] .cm-content')
  await editor.click()
  await page.keyboard.type('Hello')

  const docContentAfterTyping = await page.evaluate(() => {
    return window.__editor.state.doc.toString()
  })
  expect(docContentAfterTyping).toBe('Hello')
})

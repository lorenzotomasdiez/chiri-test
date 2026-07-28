import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-4-8: A document emptied by deleting all content persists as empty', async ({ page }) => {
  // Focus the editor and type content
  const editorContent = page.locator('[data-testid="editor"] .cm-content')
  await editorContent.click()
  await page.keyboard.type('Temporary notes to be discarded.')

  // Wait for the initial content to persist past the 2-second durability window
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2500)))

  // Select all content and delete
  await editorContent.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')

  // Wait for the empty state to persist past the 2-second durability window
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 2500)))

  // Reload the page
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Verify the document state is empty
  const docState = await page.evaluate(() => {
    return window.__editor.state.doc.toString()
  })
  expect(docState).toBe('')

  // Verify the original content is not present
  expect(docState).not.toContain('Temporary notes to be discarded.')

  // Verify the FR-11 onboarding cue is visible again
  const onboardingCue = page.locator('[data-testid="onboarding-cue"]')
  await expect(onboardingCue).toBeVisible()
})

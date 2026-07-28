import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  // Settle the webfonts before anything is typed. The editor layout depends
  // on font metrics, so a font landing after the page has loaded but before
  // the text is verified could cause layout shifts that affect what was typed.
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-4-1: Typing is saved with no explicit save action', async ({ page }) => {
  const editorContent = page.locator('[data-testid="editor"] .cm-content')

  // Type the content into the editor with no save button clicked
  const textToType = '## Release notes\nThe build shipped on Tuesday. Nothing regressed.'
  await editorContent.click()
  await editorContent.type(textToType)

  // Wait past the 800ms write debounce to ensure the content is persisted
  await page.waitForTimeout(850)

  // Verify that no save button or save affordance exists in the UI
  const saveButton = page.locator('[data-testid*="save"]')
  await expect(saveButton).toHaveCount(0)

  const saveText = page.locator('text=/save/i')
  await expect(saveText).toHaveCount(0)

  // Reload the page - nothing re-writes the document here; what survives
  // is what the app itself persisted during the debounce, which is the
  // whole of what this scenario claims.
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // After reload, verify the content persisted in the editor state
  const editorStateAfterReload = await page.evaluate(() => {
    const editor = (window as any).__editor
    return editor?.state?.doc?.toString?.()
  })

  expect(editorStateAfterReload).toBe(textToType)

  // Verify no save affordance exists after reload either
  const saveButtonAfterReload = page.locator('[data-testid*="save"]')
  await expect(saveButtonAfterReload).toHaveCount(0)

  const saveTextAfterReload = page.locator('text=/save/i')
  await expect(saveTextAfterReload).toHaveCount(0)
})

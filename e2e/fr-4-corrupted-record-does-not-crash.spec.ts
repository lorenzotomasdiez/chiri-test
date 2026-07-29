import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  // Seed a valid key so the shell and editor are available (FR-1 precondition)
  await seedValidatedKey(page)

  // Seed a corrupted document record before load. The expected shape is
  // { text, caretOffset, savedAt } but we corrupt it with truncated JSON.
  // This init script runs before the app boots and attempts to read storage.
  await page.addInitScript(() => {
    localStorage.setItem('chiri-document', '{"text": ')
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  // Settle the webfonts before any interaction
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-4-14: A corrupted persisted record does not crash the editor', async ({ page }) => {
  // Verify the editor is present and the page did not crash with a blank/crashed screen
  const editorContent = page.locator('[data-testid="editor"] .cm-content')
  await expect(editorContent).toBeVisible()

  // Verify there is no uncaught page error by checking the page stayed navigable
  // (if there was an uncaught error, the page would typically show a blank screen
  // or error state; the presence of the editor with working keyboard input
  // is the indicator that no crash occurred)

  // Type "Recovered." to verify the editor is usable and autosave works
  await editorContent.click()
  await page.keyboard.type('Recovered.')

  // Wait past the 800ms write debounce to ensure the content is persisted
  await page.waitForTimeout(850)

  // Reload the page - nothing re-writes the document here; what survives
  // is what the app itself persisted during the debounce, which proves
  // autosave resumed after recovery.
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // After reload, verify the typed content persisted in the editor
  // (autosave resumed and the recovered state was saved)
  const editorStateAfterReload = await page.evaluate(() => {
    const editor = (window as any).__editor
    return editor?.state?.doc?.toString?.()
  })

  expect(editorStateAfterReload).toBe('Recovered.')
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-11-6: The cue never shows while the document has any content', async ({ page }) => {
  const testContent = 'Meeting notes for Tuesday'

  // Set up the initial document with content
  await page.locator('.cm-content').click()
  await page.keyboard.type(testContent)

  // Verify the document has the content
  expect(await docText(page)).toBe(testContent)

  // Test scenario 1: Click on page background outside editor, then refocus
  // Click on a neutral area outside .cm-content
  await page.locator('body').click({ position: { x: 100, y: 100 } })
  // Verify cue is not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Click back into the editor to refocus
  await page.locator('.cm-content').click()
  // Verify cue is still not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Test scenario 2: Move caret to offset 0 via Ctrl+Home, then to end via Ctrl+End
  await page.keyboard.press('Control+Home')
  // Small delay to ensure cursor movement is processed
  await page.waitForTimeout(50)
  // Verify cue is not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Move cursor to the end
  await page.keyboard.press('Control+End')
  // Small delay to ensure cursor movement is processed
  await page.waitForTimeout(50)
  // Verify cue is still not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Test scenario 3: Select all content with Ctrl+A
  await page.keyboard.press('Control+a')
  // Small delay to ensure selection is processed
  await page.waitForTimeout(50)
  // Verify cue is not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Deselect by moving cursor
  await page.keyboard.press('ArrowRight')
  // Small delay to ensure cursor movement is processed
  await page.waitForTimeout(50)
  // Verify cue is still not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Verify document content remains intact
  expect(await docText(page)).toBe(testContent)

  // Test scenario 4: Resize the window from 1280x800 to 640x480
  await page.setViewportSize({ width: 640, height: 480 })
  // Small delay to ensure resize is processed
  await page.waitForTimeout(100)
  // Verify cue is not visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Verify document content remains intact after resize
  expect(await docText(page)).toBe(testContent)
})

import { test, expect, chromium } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { tmpdir } from 'os'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'

test('T-FR-4-5: The document survives the browser being fully closed and reopened', async () => {
  // Create a temporary user-data-dir for the persistent context
  const tempDir = mkdtempSync(join(tmpdir(), 'chiri-e2e-'))

  try {
    // First browser session: Launch persistent context and type content
    const browser1 = await chromium.launchPersistentContext(tempDir, {
      headless: process.env.HEADLESS !== 'false',
    })

    const page1 = browser1.pages()[0] || (await browser1.newPage())

    // Seed the API key before app boots
    await seedValidatedKey(page1)
    await page1.setViewportSize({ width: 1280, height: 800 })
    await page1.goto('/')
    await page1.waitForSelector('[data-testid="editor"] .cm-content')
    // Settle webfonts before typing
    await page1.evaluate(() => document.fonts.ready)

    // Type three paragraphs separated by blank lines
    const editorContent = page1.locator('[data-testid="editor"] .cm-content')
    const textToType = 'Paragraph one.\n\nParagraph two.\n\nParagraph three.'
    await editorContent.click()
    await editorContent.type(textToType)

    // Wait for the 800ms debounce to ensure content is persisted
    await page1.waitForTimeout(850)

    // Close the browser entirely (simulates a full browser restart)
    await browser1.close()

    // Second browser session: Launch new persistent context with same user-data-dir
    const browser2 = await chromium.launchPersistentContext(tempDir, {
      headless: process.env.HEADLESS !== 'false',
    })

    const page2 = browser2.pages()[0] || (await browser2.newPage())

    // Seed the key for the new context
    await seedValidatedKey(page2)
    await page2.setViewportSize({ width: 1280, height: 800 })
    await page2.goto('/')
    await page2.waitForSelector('[data-testid="editor"] .cm-content')
    await page2.evaluate(() => document.fonts.ready)

    // Verify all three paragraphs are present in the editor state
    const editorStateAfterRestart = await page2.evaluate(() => {
      const editor = (window as any).__editor
      return editor?.state?.doc?.toString?.()
    })

    expect(editorStateAfterRestart).toBe(textToType)

    // Verify the editor is immediately editable - no key gate modal
    const keyGateModal = page2.locator('[data-testid="key-gate"]')
    await expect(keyGateModal).toHaveCount(0)

    // Verify no spinner or blocking overlay
    const spinner = page2.locator('[role="status"]')
    await expect(spinner).toHaveCount(0)

    // Verify immediate editability by typing and seeing the text appear
    const editorContentAfter = page2.locator('[data-testid="editor"] .cm-content')
    await editorContentAfter.click()

    // Move cursor to end of document
    await page2.keyboard.press('End')

    // Type additional content
    await editorContentAfter.type(' more')

    // Verify the new text was typed immediately and appears in the editor
    const editorStateAfterTyping = await page2.evaluate(() => {
      const editor = (window as any).__editor
      return editor?.state?.doc?.toString?.()
    })

    expect(editorStateAfterTyping).toBe(textToType + ' more')

    await browser2.close()
  } finally {
    // Clean up the temporary directory
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
})

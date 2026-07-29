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
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-11-4 (a): typing H dismisses the cue and preserves the character', async ({ page }) => {
  // The cue should be visible in an empty document
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(1)

  // Click the editor and type 'H'
  await page.locator('.cm-content').click()
  await page.keyboard.type('H')

  // The cue should be gone
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // The document should contain exactly 'H'
  expect(await docText(page)).toBe('H')
})

test('T-FR-11-4 (b): typing 1 dismisses the cue and preserves the character', async ({ page }) => {
  // The cue should be visible in an empty document
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(1)

  // Click the editor and type '1'
  await page.locator('.cm-content').click()
  await page.keyboard.type('1')

  // The cue should be gone
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // The document should contain exactly '1'
  expect(await docText(page)).toBe('1')
})

test('T-FR-11-4 (c): typing space dismisses the cue and preserves whitespace', async ({ page }) => {
  // The cue should be visible in an empty document
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(1)

  // Click the editor and type a space
  await page.locator('.cm-content').click()
  await page.keyboard.type(' ')

  // The cue should be gone
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // The document should contain exactly one space
  expect(await docText(page)).toBe(' ')
})

test('T-FR-11-4 (d): pasting text dismisses the cue and preserves the paste', async ({ page }) => {
  // The cue should be visible in an empty document
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(1)

  // Click the editor and paste 'Hello there' via clipboard
  await page.locator('.cm-content').click()
  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text)
  }, 'Hello there')
  await page.keyboard.press('Control+V')

  // The cue should be gone
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // The document should contain exactly 'Hello there'
  expect(await docText(page)).toBe('Hello there')
})

test('T-FR-11-4 (e): pressing Enter dismisses the cue and preserves the newline', async ({ page }) => {
  // The cue should be visible in an empty document
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(1)

  // Click the editor and press Enter
  await page.locator('.cm-content').click()
  await page.keyboard.press('Enter')

  // The cue should be gone
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // The document should contain exactly one newline
  expect(await docText(page)).toBe('\n')
})

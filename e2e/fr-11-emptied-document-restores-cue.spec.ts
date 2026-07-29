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

test('T-FR-11-5(a): Backspace deletion restores cue and typing dismisses it again', async ({
  page,
}) => {
  const initialText = 'Draft notes for the launch event'

  // Type the initial document
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type(initialText)

  // Verify the document contains the text
  expect(await docText(page)).toBe(initialText)

  // Verify the cue is not visible (document is not empty)
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Delete all content by pressing Backspace 32 times
  for (let i = 0; i < initialText.length; i++) {
    await page.keyboard.press('Backspace')
  }

  // Verify the document is now empty
  expect(await docText(page)).toBe('')

  // Verify the cue is visible again
  await expect(page.locator('[data-testid="onboarding-cue"]')).toBeVisible()

  // Type 'N'
  await page.keyboard.type('N')

  // Verify the document contains only 'N'
  expect(await docText(page)).toBe('N')

  // Verify the cue is no longer visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Verify no fragment of the original text remains
  const finalDoc = await docText(page)
  expect(finalDoc).not.toContain('Draft')
  expect(finalDoc).not.toContain('notes')
  expect(finalDoc).not.toContain('event')
})

test('T-FR-11-5(b): Select-all and Delete restores cue and typing dismisses it again', async ({
  page,
}) => {
  const initialText = 'Draft notes for the launch event'

  // Type the initial document
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type(initialText)

  // Verify the document contains the text
  expect(await docText(page)).toBe(initialText)

  // Verify the cue is not visible (document is not empty)
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Select all and delete
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')

  // Verify the document is now empty
  expect(await docText(page)).toBe('')

  // Verify the cue is visible again
  await expect(page.locator('[data-testid="onboarding-cue"]')).toBeVisible()

  // Type 'N'
  await page.keyboard.type('N')

  // Verify the document contains only 'N'
  expect(await docText(page)).toBe('N')

  // Verify the cue is no longer visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Verify no fragment of the original text remains
  const finalDoc = await docText(page)
  expect(finalDoc).not.toContain('Draft')
  expect(finalDoc).not.toContain('notes')
  expect(finalDoc).not.toContain('event')
})

test('T-FR-11-5(c): Undo restores empty document and brings cue back', async ({ page }) => {
  const initialText = 'Draft notes for the launch event'

  // Type the initial document
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type(initialText)

  // Verify the document contains the text
  expect(await docText(page)).toBe(initialText)

  // Verify the cue is not visible (document is not empty)
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Undo the entire text entry character by character
  for (let i = 0; i < initialText.length; i++) {
    await page.keyboard.press('Control+Z')
  }

  // Verify the document is now empty
  expect(await docText(page)).toBe('')

  // Verify the cue is visible again
  await expect(page.locator('[data-testid="onboarding-cue"]')).toBeVisible()

  // Type 'N'
  await page.keyboard.type('N')

  // Verify the document contains only 'N'
  expect(await docText(page)).toBe('N')

  // Verify the cue is no longer visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // Verify no fragment of the original text remains
  const finalDoc = await docText(page)
  expect(finalDoc).not.toContain('Draft')
  expect(finalDoc).not.toContain('notes')
  expect(finalDoc).not.toContain('event')
})

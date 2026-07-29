import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { waitForPersisted } from './idb'
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

test('T-FR-11-7: reloading a document with content never shows the cue', async ({
  page,
}) => {
  // Type the test content into the editor
  await page.locator('.cm-content').click()
  await page.keyboard.type('Meeting notes for Tuesday')

  // Wait for the document to persist with the exact text
  await waitForPersisted(
    page,
    (doc) => doc !== null && doc.text === 'Meeting notes for Tuesday',
  )

  // Verify the editor holds the content before reload
  expect(await docText(page)).toBe('Meeting notes for Tuesday')

  // Reload the page
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // After reload, the document should still have the content
  expect(await docText(page)).toBe('Meeting notes for Tuesday')

  // The onboarding cue should not be present at first paint
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)

  // The cue should remain absent for at least 500ms - verify it does not appear
  await page.waitForTimeout(500)
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(0)
})

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

test('T-FR-11-1: First-ever launch shows an empty document and a cue naming both actions', async ({ page }) => {
  // The document should be completely empty (zero characters)
  expect(await docText(page)).toBe('')

  // Exactly one onboarding cue element exists
  await expect(page.locator('[data-testid="onboarding-cue"]')).toHaveCount(1)

  // The cue is visible
  await expect(page.locator('[data-testid="onboarding-cue"]')).toBeVisible()

  // The cue's text names starting to write
  const cueText = await page.locator('[data-testid="onboarding-cue"]').textContent()
  expect(cueText).toMatch(/start writing/i)

  // The cue's text names the accept-continuation keystroke (matches Tab, Ctrl+Enter, or Cmd+Enter)
  expect(cueText).toMatch(/\b(Tab|Ctrl\+Enter|Cmd\+Enter)\b/)

  // No dialog is present (FR-1 modal, tour, or walkthrough should not be visible)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

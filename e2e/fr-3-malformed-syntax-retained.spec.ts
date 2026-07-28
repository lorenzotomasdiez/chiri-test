import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/**
 * Moves the caret off the construct's line so the live-preview hide pass
 * applies to it. livePreview.ts deliberately leaves markers visible on the
 * caret's own line, so nothing here can assert a hidden marker or a finished
 * render until the caret has left.
 */
async function moveCaretOffLine(page: import('@playwright/test').Page) {
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.locator('.cm-content').click()
})

test('T-FR-3-3: an unmatched fence is retained as typed and renders once closed', async ({
  page,
}) => {
  await page.keyboard.type('```')
  await page.keyboard.press('Enter')
  await page.keyboard.type('code with no closing fence')

  // Retained exactly as typed: not truncated, not auto-closed, not corrected.
  expect(await docText(page)).toBe('```\ncode with no closing fence')
  expect(await page.locator('[role="alert"]').count()).toBe(0)

  // The user can keep typing and close the construct, at which point it
  // renders as a code block region.
  await page.keyboard.press('Enter')
  await page.keyboard.type('```')
  await moveCaretOffLine(page)

  expect(await docText(page)).toBe('```\ncode with no closing fence\n```\n\n')
  expect(await page.locator('.cm-lp-codeblock').count()).toBeGreaterThan(0)
})

test('T-FR-3-3: an incomplete link is retained as plain text and renders once completed', async ({
  page,
}) => {
  await page.keyboard.type('[caption](')

  expect(await docText(page)).toBe('[caption](')
  expect(await page.locator('[role="alert"]').count()).toBe(0)
  // Plain text, not a link: no Link node exists for an unclosed target, so
  // no link decoration should have been produced.
  expect(await page.locator('.cm-lp-link').count()).toBe(0)

  await page.keyboard.type('https://example.com)')
  await moveCaretOffLine(page)

  expect(await docText(page)).toBe('[caption](https://example.com)\n\n')
  expect(await page.locator('.cm-lp-link').count()).toBe(1)
})

test('T-FR-3-3: a stray emphasis marker is retained as plain text and renders once matched', async ({
  page,
}) => {
  await page.keyboard.type('word *alone')

  expect(await docText(page)).toBe('word *alone')
  expect(await page.locator('[role="alert"]').count()).toBe(0)
  expect(await page.locator('.cm-lp-em').count()).toBe(0)

  await page.keyboard.type('*')
  await moveCaretOffLine(page)

  expect(await docText(page)).toBe('word *alone*\n\n')
  expect(await page.locator('.cm-lp-em').count()).toBe(1)
})

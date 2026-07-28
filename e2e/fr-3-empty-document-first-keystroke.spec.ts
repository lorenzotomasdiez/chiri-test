import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Get the current selection head position */
async function selectionHead(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.selection.main.head,
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-3-13: the empty document accepts the first keystroke immediately with nothing pre-rendered', async ({ page }) => {
  // Initially, the document should be empty
  expect(await docText(page)).toBe('')

  // Nothing is pre-rendered. These assert against the decoration classes
  // livePreview.ts actually emits, not against h1/ul/pre/blockquote tags:
  // CodeMirror renders div.cm-line with decorated spans and never produces
  // those tags at all, so asserting their absence would hold true of any
  // implementation, including one that rendered a whole document here.
  for (const construct of [
    '.cm-lp-heading',
    '.cm-lp-strong',
    '.cm-lp-em',
    '.cm-lp-link',
    '.cm-lp-code',
    '.cm-lp-codeblock',
    '.cm-lp-quote',
    '.cm-lp-hr',
    '.cm-lp-listitem',
  ]) {
    await expect(page.locator(construct)).toHaveCount(0)
  }

  // One empty line, and no sample or placeholder content inside it. The
  // FR-11 onboarding cue is a separate overlay outside .cm-content, so it
  // must not be what satisfies this.
  await expect(page.locator('.cm-content .cm-line')).toHaveCount(1)
  expect((await page.locator('.cm-content').innerText()).trim()).toBe('')

  // Click the editor and type the single character 'W'
  await page.locator('.cm-content').click()
  await page.keyboard.type('W')

  // After typing, the document should contain 'W'
  expect(await docText(page)).toBe('W')

  // The visible first line should read 'W'
  await expect(page.locator('.cm-content')).toContainText('W')

  // The selection head should be at offset 1 (after the character)
  expect(await selectionHead(page)).toBe(1)
})

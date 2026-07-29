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

/** Wraps one fragment of continuation text in the SSE frame OpenRouter sends for it. */
function continuationFrame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-3: Accepting the full continuation inserts it and clears the ghost text', async ({
  page,
}) => {
  const initialDoc = '- Pack the tent, the stove, and'
  const ghostContinuation = ' the pot for coffee.'
  const expectedDoc = initialDoc + ghostContinuation
  const expectedHead = 51

  // Mock the continuation API response to return the ghost continuation text
  // in SSE format, matching the OpenRouter streaming response shape.
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        continuationFrame(' the') +
        continuationFrame(' pot') +
        continuationFrame(' for') +
        continuationFrame(' coffee.') +
        'data: [DONE]\n\n',
    })
  })

  // Set up the initial document by clicking and typing
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type(initialDoc)

  // Verify initial content is correct
  expect(await docText(page)).toBe(initialDoc)

  // The caret is now at offset 31 (end of initialDoc). The scheduler debounce
  // will fire and request a continuation. Wait for the ghost-text decoration
  // to appear, indicating the continuation has been rendered.
  await page.waitForSelector('[data-testid="ghost-text"]', { timeout: 5000 })

  // Verify the ghost text decoration is visible
  await expect(page.locator('[data-testid="ghost-text"]')).toBeVisible()

  // Accept the full continuation by pressing Tab
  await page.keyboard.press('Tab')

  // Verify the document now contains the full text (initial + continuation)
  expect(await docText(page)).toBe(expectedDoc)

  // Verify the ghost text decoration has been removed after acceptance
  await expect(page.locator('[data-testid="ghost-text"]')).toHaveCount(0)

  // Verify the selection head is positioned immediately after the final '.'
  // (at offset 51, which is 31 + length of ' the pot for coffee.')
  expect(await selectionHead(page)).toBe(expectedHead)
})

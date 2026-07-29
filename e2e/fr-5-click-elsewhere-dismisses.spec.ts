import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Get the current cursor position (main selection head). */
async function cursorOffset(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.selection.main.head,
  )
}

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-8: Clicking elsewhere dismisses the continuation without changing the document', async ({
  page,
}) => {
  const fullDoc = 'The cabin sat quiet.\n\nThe road was closed all week, and'
  const continuationText = ' the woodsmoke hung low.'

  // Mock the OpenRouter API to return a continuation response as an SSE stream
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: frame(continuationText) + 'data: [DONE]\n\n',
    })
  })

  // Set up the initial document by clicking and typing
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)

  // Verify initial content
  expect(await docText(page)).toBe(fullDoc)

  // Position cursor at the end of paragraph 2 (end of document)
  const endPos = fullDoc.length
  await page.evaluate((pos) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      selection: { anchor: pos, head: pos },
    })
  }, endPos)

  // Wait for the settle time to elapse (600ms) for the continuation request to fire
  await page.waitForTimeout(700)

  // Wait for the ghost-text widget to appear in the DOM
  await page.waitForSelector('[data-testid="ghost-text"]', { timeout: 5000 })

  // Verify the ghost text is visible before clicking
  const ghostBefore = await page.locator('[data-testid="ghost-text"]').isVisible()
  expect(ghostBefore).toBe(true)

  // Click on the word "cabin" in the first paragraph (offset 4-9)
  // We click at a position that is clearly in paragraph 1
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    // "The cabin" - "cabin" starts at offset 4, click in the middle
    editor.dispatch({
      selection: { anchor: 7, head: 7 },
    })
  })

  // The ghost should be dismissed immediately on selection change
  // Wait a brief moment for any animations or state updates
  await page.waitForTimeout(100)

  // Verify no ghost widget is present
  const ghostElements = await page.locator('[data-testid="ghost-text"]').count()
  expect(ghostElements).toBe(0)

  // Verify the document text is unchanged
  expect(await docText(page)).toBe(fullDoc)

  // Verify the cursor is in paragraph one (offset < 21)
  const newOffset = await cursorOffset(page)
  expect(newOffset).toBeLessThan(21)
})

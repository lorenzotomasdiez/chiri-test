import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
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

test('T-FR-5-6: Typing a non-accept character dismisses the continuation and inserts only what was typed', async ({
  page,
}) => {
  const initialText = '- Pack the tent, the stove, and'
  const continuationText = ' the pot for coffee.'

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
  await page.keyboard.type(initialText)

  // Verify initial content
  expect(await docText(page)).toBe(initialText)

  // The caret is already at the end of the list item after typing.
  // Wait for the settle time to elapse (600ms) for the continuation request to fire.
  await page.waitForTimeout(700)

  // Wait for the ghost-text widget to appear in the DOM
  await page.waitForSelector('[data-testid="ghost-text"]', { timeout: 5000 })

  // Type a non-accept character (not Tab, not Ctrl+ArrowRight)
  await page.keyboard.type('s')

  // Verify the ghost text is no longer present
  const ghostCount = await page.locator('[data-testid="ghost-text"]').count()
  expect(ghostCount).toBe(0)

  // Verify the document contains exactly the typed character appended, with no part of the ghost continuation
  const finalDoc = await docText(page)
  expect(finalDoc).toBe('- Pack the tent, the stove, ands')
})

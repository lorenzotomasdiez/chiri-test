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
function continuationFrame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

/**
 * Mocks a continuation SSE response stream for testing ghost text.
 * The stream terminates with [DONE] as OpenRouter does for streaming requests.
 */
async function mockContinuationResponse(
  page: import('@playwright/test').Page,
  continuation: string,
): Promise<void> {
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: continuationFrame(continuation) + 'data: [DONE]\n\n',
    })
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-2: A continuation appears after the writer pauses at the end of a list item', async ({
  page,
}) => {
  const listItem = '- Pack the tent, the stove, and'
  const ghostContinuation = ' the pot for coffee.'

  // Set up the initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(listItem)

  // Verify initial content
  expect(await docText(page)).toBe(listItem)

  // Position the caret at the end of the line
  await page.keyboard.press('End')

  // Mock the OpenRouter API to return the continuation
  await mockContinuationResponse(page, ghostContinuation)

  // Wait for the pause to trigger continuation (600ms + buffer for request/response)
  await page.waitForTimeout(800)

  // The document text must remain unchanged - nothing was inserted
  expect(await docText(page)).toBe(listItem)

  // The ghost text should appear in the DOM as a widget decoration
  // The decoration will appear at the caret position with the continuation content
  const ghostElement = await page.locator('.cm-ghost-text').first()
  expect(await ghostElement.isVisible()).toBe(true)
  expect(await ghostElement.textContent()).toBe(ghostContinuation)
})

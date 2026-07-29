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

test('T-FR-5-9: A response that arrives after the caret has moved is discarded silently', async ({
  page,
}) => {
  const para1 = 'First paragraph.'
  const para2 = 'Second paragraph.'
  const fullDoc = para1 + '\n\n' + para2

  // Set up the two-paragraph document
  await page.locator('.cm-content').click()
  await page.keyboard.type(para1)
  await page.keyboard.type('\n\n')
  await page.keyboard.type(para2)
  expect(await docText(page)).toBe(fullDoc)

  // Mock the OpenRouter continuation response with a 1500ms delay
  await page.route('https://openrouter.ai/**', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 1500))
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        'data: {"choices":[{"index":0,"delta":{"content":" And"}}]}\n\n' +
        'data: {"choices":[{"index":0,"delta":{"content":" more"}}]}\n\n' +
        'data: {"choices":[{"index":0,"delta":{"content":" text."}}]}\n\n' +
        'data: [DONE]\n\n',
    })
  })

  // Position caret at the end of paragraph one and pause to trigger continuation request
  const caretPosEnd = para1.length
  await page.evaluate((pos) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.focus()
    editor.dispatch({ selection: { anchor: pos, head: pos } })
  }, caretPosEnd)

  // Wait for the Scheduler's settleMs to pass and the continuation request to be issued
  // Default settleMs is 500ms, add buffer for certainty
  await new Promise(resolve => setTimeout(resolve, 700))

  // After 200ms from when the request is issued, move the caret to paragraph two
  // This invalidates the in-flight request via onCaretMove and increments the generation counter
  await new Promise(resolve => setTimeout(resolve, 200))
  const caretPosTwo = para1.length + 2 + para2.length
  await page.evaluate((pos) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: pos, head: pos } })
  }, caretPosTwo)

  // Wait for the delayed response to complete
  // The response has a 1500ms delay from when the request was made
  // We've already waited 700ms + 200ms = 900ms, so wait the remaining time plus buffer
  await new Promise(resolve => setTimeout(resolve, 1200))

  // Assert that no ghost text widget was displayed
  // The ghost text extension should not have rendered any widget
  // because the generation counter was invalidated before the response arrived
  await expect(page.locator('[data-testid="ghost-text"]')).toHaveCount(0)

  // Verify the document remains unchanged (no ghost text was inserted)
  expect(await docText(page)).toBe(fullDoc)
})

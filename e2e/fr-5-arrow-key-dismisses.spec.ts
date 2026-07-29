import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Mocks a continuation response from OpenRouter. */
async function mockContinuationResponse(
  page: import('@playwright/test').Page,
  continuation: string,
): Promise<void> {
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: continuation } }] })}\n\ndata: [DONE]\n\n`,
    })
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-7: Moving the caret with an arrow key dismisses the continuation without changing the document', async ({
  page,
}) => {
  const documentText = 'The cabin sat quiet under the first snow of the season, and'
  const ghostContinuation = ' the branches hung heavy with white. Snow dusted the porch rails.'

  // Set up the initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(documentText)

  // Capture pre-arrow-key state
  const preArrowText = await docText(page)
  expect(preArrowText).toBe(documentText)

  // Mock the continuation API response
  await mockContinuationResponse(page, ghostContinuation)

  // Wait for the ghost continuation widget to appear
  await page.waitForSelector('[data-testid="ghost-continuation"]', { timeout: 5000 })

  // Press ArrowLeft to dismiss the ghost
  await page.keyboard.press('ArrowLeft')

  // Verify the ghost widget is gone
  await expect(page.locator('[data-testid="ghost-continuation"]')).not.toBeVisible()

  // Verify the document is byte-identical to before the arrow key press
  const postArrowText = await docText(page)
  expect(postArrowText).toBe(preArrowText)
})

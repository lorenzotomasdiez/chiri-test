import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
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

test('T-FR-11-10: The cue\'s stated accept-continuation instruction matches the actual accept keystroke', async ({
  page,
}) => {
  const initialDoc = 'Pack the tent, the stove, and'
  const ghostContinuation = ' the pot for coffee.'
  const expectedDoc = initialDoc + ghostContinuation

  // Extract the accept key from the onboarding cue text.
  // The cue currently says "press Tab to take it" - extract "Tab".
  const cueText = await page.locator('[data-testid="onboarding-cue"]').innerText()
  const keyMatch = cueText.match(/press (\w+) to/)
  if (!keyMatch || !keyMatch[1]) {
    throw new Error(`Could not extract key from cue text: "${cueText}"`)
  }
  const acceptKey = keyMatch[1]

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

  // The caret is now at end of initialDoc. The scheduler debounce
  // will fire and request a continuation. Wait for the ghost-text decoration
  // to appear, indicating the continuation has been rendered.
  await page.waitForSelector('[data-testid="ghost-text"]', { timeout: 5000 })

  // Verify the ghost text decoration is visible
  await expect(page.locator('[data-testid="ghost-text"]')).toBeVisible()

  // Accept the continuation by pressing the key mentioned in the cue.
  // This proves the key the cue names is the key that actually accepts.
  await page.keyboard.press(acceptKey)

  // Verify the document now contains the full text (initial + continuation)
  expect(await docText(page)).toBe(expectedDoc)

  // Verify the ghost text decoration has been removed after acceptance,
  // proving no separate undocumented keystroke is required.
  await expect(page.locator('[data-testid="ghost-text"]')).toHaveCount(0)
})

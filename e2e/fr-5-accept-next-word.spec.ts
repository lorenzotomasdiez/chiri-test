import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Gets the current caret offset. */
async function caretOffset(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.selection.main.head,
  )
}

/**
 * Gets the current ghost text from the ghostTextStateField, or null if none
 * is shown.
 */
async function ghostText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      (window as unknown as { ghostTextStateField?: any })?.ghostTextStateField?.getGhostText?.() ??
      null,
  )
}

/** Mocks a continuation response from OpenRouter. */
async function mockContinuationResponse(
  page: import('@playwright/test').Page,
  continuation: string,
): Promise<void> {
  function frame(content: string): string {
    return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
  }

  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: frame(continuation) + 'data: [DONE]\n\n',
    })
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-4: Accepting the next word only inserts one word and leaves the remainder shown', async ({
  page,
}) => {
  const initialDoc = '- Pack the tent, the stove, and'
  const ghostContinuation = ' the pot for coffee.'
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

  // Set up the initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  // Verify initial content
  expect(await docText(page)).toBe(initialDoc)

  // Mock the continuation response
  await mockContinuationResponse(page, ghostContinuation)

  // Move caret to the end to trigger continuation
  await page.keyboard.press('End')

  // Wait for the ghost text to appear. The Scheduler debounces, so give it time.
  // We poll until the ghost field is populated. This predicate runs entirely
  // in-browser, so it reads the exposed ghostTextStateField directly rather
  // than calling the Node-side ghostText() helper.
  await page.waitForFunction(
    () => {
      const gt = (window as unknown as { ghostTextStateField?: any })?.ghostTextStateField
      const ghost = gt?.getGhostText?.() ?? null
      return ghost !== null && ghost !== ''
    },
    { timeout: 5000 },
  )

  // Verify the ghost text is now showing
  const shownGhost = await ghostText(page)
  expect(shownGhost).toBe(ghostContinuation)

  // Press Ctrl+ArrowRight (or Cmd+ArrowRight on macOS) to accept the next word
  await page.keyboard.press(`${mod}+ArrowRight`)

  // Verify the document now includes just the word 'the' with its leading space
  const expectedDoc = '- Pack the tent, the stove, and the'
  expect(await docText(page)).toBe(expectedDoc)

  // Verify the ghost text is still shown with the remainder
  const remainingGhost = await ghostText(page)
  expect(remainingGhost).toBe(' pot for coffee.')

  // Verify the caret is at offset 35 (right after 'the' and before the space and 'pot')
  expect(await caretOffset(page)).toBe(35)
})

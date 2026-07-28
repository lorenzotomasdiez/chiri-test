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

test('T-FR-6-10: Editing inside a pending revision span invalidates it silently', async ({
  page,
}) => {
  // Type the initial document text
  await page.locator('.cm-content').click()
  await page.keyboard.type('The report was late because the team was busy.')

  // Verify initial content
  expect(await docText(page)).toBe('The report was late because the team was busy.')

  // Apply a pending revision over the span "the team was busy"
  // The span starts at position 40 (after "because ") and ends at position 57
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const doc = editor.state.doc
    const spanStart = 40
    const spanEnd = 57

    // Apply pending revision using the revision module
    editor.dispatch({
      effects: [
        (window as unknown as { setPendingRevision?: Function }).setPendingRevision?.(
          spanStart,
          spanEnd,
          'the team was busy',
          'openai/gpt-4o-mini',
        ),
      ],
    })
  })

  // Place the caret immediately after "because " (position 40, inside the pending span)
  // and type the replacement text
  await page.locator('.cm-content').click({ position: { x: 0, y: 0 } })
  await page.keyboard.press('End')
  await page.keyboard.press('Home')

  // Click to position after "because " - we'll use keyboard navigation
  // "The report was late because " is 32 chars, but we need 40 (including the space)
  const targetPos = 40
  await page.evaluate((pos) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: pos, head: pos } })
  }, targetPos)

  // Type the new text which should replace the pending span
  await page.keyboard.type('the deadline was unrealistic')

  // Assert that the pending revision decoration is gone from the DOM
  const decorations = await page.locator('[data-testid="revision-pending"]').count()
  expect(decorations).toBe(0)

  // Assert that the review surface is gone from the DOM
  const reviewSurface = await page.locator('[data-testid="review-surface"]').count()
  expect(reviewSurface).toBe(0)

  // Assert that the document contains the typed text applied as if no revision had been pending
  // The typing inside the pending span should replace it with the new text
  expect(await docText(page)).toBe('The report was late because the deadline was unrealistic.')
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Frame a fragment for SSE event stream. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-7-4: Accepting after refinements commits exactly the currently visible text', async ({
  page,
}) => {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  const fullDoc = 'Intro line.\n\nThe revenue picture over the last three months was not encouraging.\n\nClosing line.'
  const selectedText = 'The revenue picture over the last three months was not encouraging.'
  const firstRefinedText = 'Sales dipped.'
  const secondRefinedText = 'Sales dipped this quarter.'
  const expectedFinalDoc = 'Intro line.\n\nSales dipped this quarter.\n\nClosing line.'

  // Set up the initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)

  // Verify initial content
  expect(await docText(page)).toBe(fullDoc)

  // Capture pre-request state for verification
  const preRequestText = await docText(page)

  // Find the span to be replaced
  const startIdx = fullDoc.indexOf(selectedText)
  const endIdx = startIdx + selectedText.length

  // Select the text that will be revised
  await page.evaluate(({ start, end }) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      selection: {
        anchor: start,
        head: end,
      },
    })
  }, { start: startIdx, end: endIdx })

  let callCount = 0

  // Set up a route handler that serves different responses based on call sequence.
  // First call: revision with first refined text.
  // Second call: refinement response with second refined text.
  await page.route('https://openrouter.ai/**', async (route) => {
    callCount++

    if (callCount === 1) {
      // Initial revision response
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body:
          frame('reason: Better conciseness\n') +
          frame('--') +
          frame('sep') +
          frame('--') +
          frame(`\n${firstRefinedText}`) +
          'data: [DONE]\n\n',
      })
    } else if (callCount === 2) {
      // Refinement response with updated proposed text
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body:
          frame('reason: More specific timing\n') +
          frame('--') +
          frame('sep') +
          frame('--') +
          frame(`\n${secondRefinedText}`) +
          'data: [DONE]\n\n',
      })
    } else {
      await route.abort()
    }
  })

  // Click the "Improve the writing" one-tap action to create the initial pending revision
  await page.locator('button:has-text("Improve the writing")').click()

  // Wait for the revision decoration to appear
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // Verify the initial revision shows the first refined text
  const initialProposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(initialProposedText).toContain(firstRefinedText)

  // Try to refine: look for the refine input/button which will exist once FR-7 is implemented.
  // This refine button should allow entering an instruction like "make it more specific"
  const refineInput = await page.locator('[data-testid="revision-refine-input"]').isVisible()

  if (!refineInput) {
    // Refinement input does not exist yet - this is expected in the red phase.
    // The actual implementation will add this control.
    throw new Error('Refinement input not found - FR-7 refinement UI not yet implemented')
  }

  // (Once FR-7 is implemented, this section will execute:)
  // Enter a refinement instruction and submit
  await page.locator('[data-testid="revision-refine-input"]').fill('Make it more specific about timing')
  await page.locator('[data-testid="revision-refine-submit"]').click()

  // Wait for the second refinement response to arrive and update the proposed text
  await page.waitForFunction(
    (text) => document.querySelector('[data-testid="revision-proposed"]')?.textContent?.includes(text),
    secondRefinedText,
    { timeout: 5000 },
  )

  // Verify the refined proposal is now visible
  const refinedProposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(refinedProposedText).toContain(secondRefinedText)
  expect(refinedProposedText).not.toContain(firstRefinedText)

  // Click the accept button to commit the latest refined version
  await page.locator('[data-testid="revision-decoration"] button:has-text("Accept")').click()

  // Verify the document contains exactly the latest refined text
  const resultDoc = await docText(page)
  expect(resultDoc).toBe(expectedFinalDoc)

  // Verify the first refinement does not appear as a standalone paragraph
  expect(resultDoc).not.toContain(firstRefinedText)

  // Verify the original text is completely absent
  expect(resultDoc).not.toContain('The revenue picture over the last three months was not encouraging.')

  // AC-3.3: pressing undo exactly once restores the full pre-accept document in a single step
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe(preRequestText)
})

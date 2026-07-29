import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
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

test('T-FR-6-6: Accepting a pending revision commits exactly the proposed text and nothing else', async ({
  page,
}) => {
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control'
  const fullDoc = 'Intro line.\n\nThe report was late because the team was busy.\n\nClosing line.'
  const selectedText = 'was late because the team was busy'
  const proposedText = 'slipped due to competing team priorities'
  const expectedDoc = 'Intro line.\n\nThe report slipped due to competing team priorities.\n\nClosing line.'

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

  // Mock the OpenRouter API to return the proposed revision
  await mockRevisionResponse(page, {
    reason: 'Better phrasing',
    proposal: 'slipped due to competing team priorities',
  })

  // Click the "Improve the writing" one-tap action to create the pending revision
  await page.locator('button:has-text("Improve the writing")').click()

  // Wait for the revision decoration to appear
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // Click the accept button to commit the revision
  await page.locator('[data-testid="revision-decoration"] button:has-text("Accept")').click()

  // Verify the revision was committed with exactly the proposed text
  const resultDoc = await docText(page)
  expect(resultDoc).toBe(expectedDoc)

  // Verify that every character outside the span is byte-identical to the pre-request snapshot
  expect(resultDoc.substring(0, startIdx)).toBe(preRequestText.substring(0, startIdx))
  expect(resultDoc.substring(startIdx + proposedText.length)).toBe(
    preRequestText.substring(endIdx),
  )

  // AC-6.8: pressing undo exactly once restores the full pre-accept string
  // in a single step, with no intermediate state reachable.
  await page.keyboard.press(`${mod}+z`)
  expect(await docText(page)).toBe(preRequestText)

  // What a further undo does is CodeMirror's own history granularity over
  // the typing that set this document up, not FR-6's contract - the plan
  // asks only that the accept collapses to one step, which the assertion
  // above is what proves.
})

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

test('T-FR-7-1: A single refinement replaces the proposed text, keeping the original as the removal side', async ({
  page,
}) => {
  // Given the document with an initial state
  const fullDoc =
    'Intro line.\n\nThe quarterly numbers were, on the whole, somewhat disappointing to the extended leadership team.\n\nClosing line.'
  const originalSentence =
    'The quarterly numbers were, on the whole, somewhat disappointing to the extended leadership team.'
  const initialProposal = 'Quarterly numbers disappointed leadership.'
  const initialReason = 'Shortened for concision'
  const refinementInstruction = 'make it even shorter'
  const refinedProposal = 'Numbers disappointed leadership.'
  const refinedReason = 'Trimmed further'

  // Type the initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)

  // Find the middle sentence to select
  const startIdx = fullDoc.indexOf(originalSentence)
  const endIdx = startIdx + originalSentence.length

  // Select the middle sentence
  await page.evaluate(({ start, end }) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      selection: {
        anchor: start,
        head: end,
      },
    })
  }, { start: startIdx, end: endIdx })

  // Mock the initial revision response
  await mockRevisionResponse(page, {
    reason: initialReason,
    proposal: initialProposal,
  })

  // Click the "Improve the writing" one-tap action to create the pending revision
  await page.locator('button:has-text("Improve the writing")').click()

  // Wait for the revision decoration to appear
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // Verify the initial revision state before refinement
  const initialExisting = await page.locator('[data-testid="revision-existing"]').textContent()
  expect(initialExisting).toContain(originalSentence)

  const initialProposedBefore = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(initialProposedBefore).toContain(initialProposal)

  const initialReasonBefore = await page.locator('[data-testid="revision-reason"]').textContent()
  expect(initialReasonBefore).toContain(initialReason)

  // Store the document before refinement to verify the span position hasn't changed
  const docBefore = await docText(page)

  // When the user opens the refinement input and submits an instruction
  // Find and click the refinement button (this will fail if it doesn't exist)
  await page.locator('[data-testid="revision-decoration"] button:has-text("Refine")').click()

  // Wait for the refinement input to appear
  await page.waitForSelector('[data-testid="refinement-instruction-input"]', { timeout: 5000 })

  // Type the refinement instruction
  await page.locator('[data-testid="refinement-instruction-input"]').fill(refinementInstruction)

  // Set up the mock for the refinement response before submitting
  await mockRevisionResponse(page, {
    reason: refinedReason,
    proposal: refinedProposal,
  })

  // Submit the refinement (either by pressing Enter or clicking a submit button)
  const submitButton = page.locator(
    '[data-testid="revision-decoration"] button:has-text("Submit")',
  )
  if (await submitButton.isVisible()) {
    await submitButton.click()
  } else {
    await page.locator('[data-testid="refinement-instruction-input"]').press('Enter')
  }

  // Wait for the refinement to complete
  await page.waitForTimeout(500)

  // Then verify the refined state
  // [data-testid=revision-proposed] should show the refined proposal
  const refinedProposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(refinedProposedText).toContain(refinedProposal)

  // [data-testid=revision-existing] should still show the original sentence unchanged
  const existingAfterRefinement = await page.locator('[data-testid="revision-existing"]').textContent()
  expect(existingAfterRefinement).toContain(originalSentence)

  // [data-testid=revision-reason] should show the new reason
  const reasonAfterRefinement = await page.locator('[data-testid="revision-reason"]').textContent()
  expect(reasonAfterRefinement).toContain(refinedReason)

  // The revision's span from/to should be the same as before the refinement
  // (verified by checking the document is unchanged - refinement is display-only)
  const docAfter = await docText(page)
  expect(docAfter).toBe(docBefore)
})

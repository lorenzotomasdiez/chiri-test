import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'
import type { Revision } from '../src/core/revision'

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

test('T-FR-7-6: A failed refinement request (network abort) reverts to the last successful state and stays actionable', async ({
  page,
}) => {
  const fullDoc = 'Intro line.\n\nThe report was late because the team was busy.\n\nClosing line.'
  const selectedText = 'The report was late because the team was busy'
  const refinedProposal = 'The report slipped.'
  const refinedReason = 'Shortened'

  // Set up initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  expect(await docText(page)).toBe(fullDoc)

  // Find the span indices
  const startIdx = fullDoc.indexOf(selectedText)
  const endIdx = startIdx + selectedText.length

  // Set up a pending revision showing the result of a previous successful refinement
  await page.evaluate(
    ([start, end, proposed, reason]) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const pendingSpanField = (window as unknown as { pendingSpanField: any }).pendingSpanField
      if (!pendingSpanField) {
        throw new Error('pendingSpanField not found on window')
      }

      const revision: Revision = {
        id: 'pending-previous-refinement',
        from: start,
        to: end,
        proposed: proposed,
        status: 'pending',
        existing: selectedText,
        reason: reason,
        modelId: 'gpt-4',
      }

      editor.dispatch({
        effects: [pendingSpanField.setEffect.of(revision)],
      })
    },
    [startIdx, endIdx, refinedProposal, refinedReason],
  )

  // Verify revision is displayed with the refined text
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()
  expect(await page.locator('[data-testid="revision-proposed"]').textContent()).toBe(refinedProposal)
  expect(await page.locator('[data-testid="revision-reason"]').textContent()).toBe(refinedReason)

  // Mock the refinement request to fail with network abort
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.abort('failed')
  })

  // Attempt a refinement that will fail
  // This assumes the FR-7 UI provides a refine button or control
  const refineButton = page.locator('[data-testid="revision-decoration"]').locator('button:has-text("Refine")')
  await refineButton.click()

  // Type the refinement instruction in the refinement input
  const refinementInput = page.locator('[data-testid="refinement-input"]')
  await refinementInput.fill('make it friendlier')

  // Submit the refinement (press Enter or click submit button)
  await refinementInput.press('Enter')

  // Wait for failure banner to appear
  await page.waitForSelector('[data-testid="failure-message"]', { timeout: 5000 })

  // Verify the revision state is unchanged - proposed text still shows the last successful result
  expect(await page.locator('[data-testid="revision-proposed"]').textContent()).toBe(refinedProposal)
  expect(await page.locator('[data-testid="revision-reason"]').textContent()).toBe(refinedReason)

  // Verify failure banner is visible with working buttons
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible()
  await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible()

  // Dismiss the banner
  await page.locator('[data-testid="dismiss-button"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).not.toBeVisible()

  // Verify Accept and Reject buttons are still visible and operable
  const acceptButton = page.locator('[data-testid="revision-decoration"] button:has-text("Accept")')
  const rejectButton = page.locator('[data-testid="revision-decoration"] button:has-text("Reject")')
  await expect(acceptButton).toBeVisible()
  await expect(rejectButton).toBeVisible()

  // Accept should commit exactly the refined proposed text
  await acceptButton.click()
  const finalDoc = await docText(page)
  expect(finalDoc).toContain(refinedProposal)
  expect(finalDoc).toBe(`Intro line.\n\nThe report slipped.\n\nClosing line.`)
})

test('T-FR-7-6: A failed refinement request (truncated stream) reverts to the last successful state and stays actionable', async ({
  page,
}) => {
  const fullDoc = 'Intro line.\n\nThe report was late because the team was busy.\n\nClosing line.'
  const selectedText = 'The report was late because the team was busy'
  const refinedProposal = 'The report slipped.'
  const refinedReason = 'Shortened'

  // Set up initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  expect(await docText(page)).toBe(fullDoc)

  // Find the span indices
  const startIdx = fullDoc.indexOf(selectedText)
  const endIdx = startIdx + selectedText.length

  // Set up a pending revision showing the result of a previous successful refinement
  await page.evaluate(
    ([start, end, proposed, reason]) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const pendingSpanField = (window as unknown as { pendingSpanField: any }).pendingSpanField
      if (!pendingSpanField) {
        throw new Error('pendingSpanField not found on window')
      }

      const revision: Revision = {
        id: 'pending-previous-refinement-2',
        from: start,
        to: end,
        proposed: proposed,
        status: 'pending',
        existing: selectedText,
        reason: reason,
        modelId: 'gpt-4',
      }

      editor.dispatch({
        effects: [pendingSpanField.setEffect.of(revision)],
      })
    },
    [startIdx, endIdx, refinedProposal, refinedReason],
  )

  // Verify revision is displayed with the refined text
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()
  expect(await page.locator('[data-testid="revision-proposed"]').textContent()).toBe(refinedProposal)
  expect(await page.locator('[data-testid="revision-reason"]').textContent()).toBe(refinedReason)

  // Mock the refinement request to return truncated stream (no sentinel)
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: 'data: {"choices": [{"index": 0, "delta": {"content": "Some incomplete"}}]}\n\n',
    })
  })

  // Attempt a refinement that will fail
  const refineButton = page.locator('[data-testid="revision-decoration"]').locator('button:has-text("Refine")')
  await refineButton.click()

  // Type the refinement instruction
  const refinementInput = page.locator('[data-testid="refinement-input"]')
  await refinementInput.fill('make it friendlier')

  // Submit the refinement
  await refinementInput.press('Enter')

  // Wait for failure banner to appear
  await page.waitForSelector('[data-testid="failure-message"]', { timeout: 5000 })

  // Verify the revision state is unchanged
  expect(await page.locator('[data-testid="revision-proposed"]').textContent()).toBe(refinedProposal)
  expect(await page.locator('[data-testid="revision-reason"]').textContent()).toBe(refinedReason)

  // Verify failure banner is visible with working buttons
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible()
  await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible()

  // Dismiss the banner
  await page.locator('[data-testid="dismiss-button"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).not.toBeVisible()

  // Verify Accept and Reject buttons are still visible and operable
  const acceptButton = page.locator('[data-testid="revision-decoration"] button:has-text("Accept")')
  const rejectButton = page.locator('[data-testid="revision-decoration"] button:has-text("Reject")')
  await expect(acceptButton).toBeVisible()
  await expect(rejectButton).toBeVisible()

  // Accept should commit exactly the refined proposed text
  await acceptButton.click()
  const finalDoc = await docText(page)
  expect(finalDoc).toContain(refinedProposal)
  expect(finalDoc).toBe(`Intro line.\n\nThe report slipped.\n\nClosing line.`)
})

test('T-FR-7-6: A failed refinement request (HTTP 429) reverts to the last successful state and stays actionable', async ({
  page,
}) => {
  const fullDoc = 'Intro line.\n\nThe report was late because the team was busy.\n\nClosing line.'
  const selectedText = 'The report was late because the team was busy'
  const refinedProposal = 'The report slipped.'
  const refinedReason = 'Shortened'

  // Set up initial document
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  expect(await docText(page)).toBe(fullDoc)

  // Find the span indices
  const startIdx = fullDoc.indexOf(selectedText)
  const endIdx = startIdx + selectedText.length

  // Set up a pending revision showing the result of a previous successful refinement
  await page.evaluate(
    ([start, end, proposed, reason]) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const pendingSpanField = (window as unknown as { pendingSpanField: any }).pendingSpanField
      if (!pendingSpanField) {
        throw new Error('pendingSpanField not found on window')
      }

      const revision: Revision = {
        id: 'pending-previous-refinement-3',
        from: start,
        to: end,
        proposed: proposed,
        status: 'pending',
        existing: selectedText,
        reason: reason,
        modelId: 'gpt-4',
      }

      editor.dispatch({
        effects: [pendingSpanField.setEffect.of(revision)],
      })
    },
    [startIdx, endIdx, refinedProposal, refinedReason],
  )

  // Verify revision is displayed with the refined text
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()
  expect(await page.locator('[data-testid="revision-proposed"]').textContent()).toBe(refinedProposal)
  expect(await page.locator('[data-testid="revision-reason"]').textContent()).toBe(refinedReason)

  // Mock the refinement request to return HTTP 429 (rate limited)
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 429,
      headers: { 'content-type': 'application/json' },
    })
  })

  // Attempt a refinement that will fail
  const refineButton = page.locator('[data-testid="revision-decoration"]').locator('button:has-text("Refine")')
  await refineButton.click()

  // Type the refinement instruction
  const refinementInput = page.locator('[data-testid="refinement-input"]')
  await refinementInput.fill('make it friendlier')

  // Submit the refinement
  await refinementInput.press('Enter')

  // Wait for failure banner to appear
  await page.waitForSelector('[data-testid="failure-message"]', { timeout: 5000 })

  // Verify the revision state is unchanged
  expect(await page.locator('[data-testid="revision-proposed"]').textContent()).toBe(refinedProposal)
  expect(await page.locator('[data-testid="revision-reason"]').textContent()).toBe(refinedReason)

  // Verify failure banner is visible with working buttons
  await expect(page.locator('[data-testid="failure-message"]')).toBeVisible()
  await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
  await expect(page.locator('[data-testid="dismiss-button"]')).toBeVisible()

  // Dismiss the banner
  await page.locator('[data-testid="dismiss-button"]').click()
  await expect(page.locator('[data-testid="failure-message"]')).not.toBeVisible()

  // Verify Accept and Reject buttons are still visible and operable
  const acceptButton = page.locator('[data-testid="revision-decoration"] button:has-text("Accept")')
  const rejectButton = page.locator('[data-testid="revision-decoration"] button:has-text("Reject")')
  await expect(acceptButton).toBeVisible()
  await expect(rejectButton).toBeVisible()

  // Accept should commit exactly the refined proposed text
  await acceptButton.click()
  const finalDoc = await docText(page)
  expect(finalDoc).toContain(refinedProposal)
  expect(finalDoc).toBe(`Intro line.\n\nThe report slipped.\n\nClosing line.`)
})

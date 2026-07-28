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

test('T-FR-6-7: Rejecting a pending revision leaves the document byte-identical', async ({
  page,
}) => {
  // Type the initial three-paragraph document
  await page.locator('.cm-content').click()
  await page.keyboard.type(
    'First paragraph with some content.\n\nThe report was late because the team was busy.\n\nThird paragraph with more content.',
  )

  // Capture the document text before the request
  const preRequestText = await docText(page)
  expect(preRequestText).toBe(
    'First paragraph with some content.\n\nThe report was late because the team was busy.\n\nThird paragraph with more content.',
  )

  // Select all the text so the action bar appears
  await page.keyboard.press('Meta+a')

  // Mock the OpenRouter API to return a revision
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
      body: `reason: Improved clarity
--sep--
The report slipped because the team had competing priorities.`,
    })
  })

  // Track whether a new request is made after reject
  let requestMadeAfterReject = false
  await page.on('request', (request) => {
    if (request.url().includes('openrouter.ai')) {
      requestMadeAfterReject = true
    }
  })

  // Click the "Improve the writing" one-tap action to create the revision
  await page.locator('button:has-text("Improve the writing")').click()

  // Wait for the revision decoration to appear
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // Verify the revision surface is in the DOM
  const revisionDecoration = await page.locator('[data-testid="revision-decoration"]')
  await expect(revisionDecoration).toBeVisible()

  // Reset the request tracker before clicking reject
  requestMadeAfterReject = false

  // Click the reject button
  await page.locator('[data-testid="revision-decoration"] button:has-text("Reject")').click()

  // Assert the revision decoration and review surface leave the DOM
  await expect(page.locator('[data-testid="revision-decoration"]')).not.toBeVisible()

  // Assert the document is byte-identical to pre-request text
  expect(await docText(page)).toBe(preRequestText)

  // Assert no further request was issued at the intercepted OpenRouter route
  expect(requestMadeAfterReject).toBe(false)
})

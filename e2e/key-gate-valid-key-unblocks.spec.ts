import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test('T-FR-1-3: A valid key unblocks the editor', async ({ page }) => {
  // Navigate to the app first so localStorage is scoped to the app's origin,
  // not the opaque about:blank origin.
  await page.goto('/')

  // Clear localStorage to ensure no stored key, then reload so the app boots fresh.
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()

  // Track intercepted requests
  const interceptedRequests: { headers: Record<string, string> }[] = []

  // Intercept OpenRouter API calls and return a 200 authenticated success.
  // This must fulfil, not abort: an aborted request is a network failure, which
  // is AC-1.5's incomplete-check case and leaves the gate up by design.
  await page.route('https://openrouter.ai/**', async (route) => {
    interceptedRequests.push({
      headers: await route.request().allHeaders(),
    })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    })
  })

  const submitStartTime = Date.now()

  // Wait for the key input field to be visible (part of the modal)
  await page.waitForSelector('input[type="password"]', { timeout: 5000 })

  // Type the API key into the key field
  const keyInput = page.locator('input[type="password"]')
  await keyInput.fill('sk-or-v1-valid-example-key')

  // Find and click the submit button
  const submitButton = page.getByRole('button', { name: /connect|submit|save|continue/i })
  await submitButton.click()

  // Wait for the modal to disappear (max 10 seconds)
  await page.waitForSelector('[data-testid="editor"] .cm-content', { timeout: 10000 })

  const submitEndTime = Date.now()
  const elapsedMs = submitEndTime - submitStartTime

  // Click on the editor to focus it
  await page.locator('.cm-content').click()

  // Type text into the editor
  await page.keyboard.type('The first paragraph.')

  // Verify the text is in the document
  expect(await docText(page)).toBe('The first paragraph.')

  // Verify exactly one intercepted request was made
  expect(interceptedRequests).toHaveLength(1)

  // Verify the Authorization header contains the correct key
  const authHeader = interceptedRequests[0].headers.authorization
  expect(authHeader).toBe('Bearer sk-or-v1-valid-example-key')

  // Verify the elapsed time is under 10000ms
  expect(elapsedMs).toBeLessThan(10000)
})

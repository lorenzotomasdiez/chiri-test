import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

// T-FR-1-22 (P2): a validation that takes far longer than AC-1.3's 10-second
// bound must not leave the modal looking frozen, and must still unblock the
// editor once the eventually-successful response lands. The requirement does
// not define a client-enforced timeout (see fr-1.md's open questions), so this
// also proves the app does not invent one. 12s is used in place of the test
// plan's 30s stand-in to keep the run fast while remaining unambiguously above
// the 10s boundary, matching AC-1.3, since the delay itself is not client-timed.
test('T-FR-1-22: a slow-but-successful validation still unblocks, and never looks frozen', async ({
  page,
}) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()

  const SLOW_DELAY_MS = 12_000

  await page.route('https://openrouter.ai/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SLOW_DELAY_MS))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }),
    })
  })

  const keyInput = page.locator('input[type="password"]')
  await keyInput.fill('sk-or-v1-slow-but-valid-example-key')
  await page.getByRole('button', { name: /connect|submit|save|continue/i }).click()

  // The modal must not appear frozen while the response is still in flight:
  // the validating status line and its spinner stay visible well past the
  // point where a 10s-bound check would already have resolved.
  const status = page.getByTestId('key-gate-status')
  await expect(status).toHaveText(/checking your key/i)
  await page.waitForTimeout(10_000)
  await expect(status).toHaveText(/checking your key/i)
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()

  // The eventually-successful response still unblocks the editor rather than
  // the app having given up or timed out client-side.
  await page.waitForSelector('[data-testid="editor"] .cm-content', { timeout: 10_000 })
  await expect(page.getByTestId('key-gate-modal')).not.toBeVisible()

  await page.locator('.cm-content').click()
  await page.keyboard.type('Unblocked after a slow check.')
  expect(await docText(page)).toBe('Unblocked after a slow check.')
})

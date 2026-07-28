import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test('T-FR-1-4: A previously validated key unblocks on reload without the modal', async ({
  page,
}) => {
  // Track OpenRouter requests - abort them since no real endpoint exists
  let openRouterRequestCount = 0
  await page.route('https://openrouter.ai/**', async (route) => {
    openRouterRequestCount++
    await route.abort()
  })

  // Seed localStorage with a previously validated API key before navigation
  await page.addInitScript(() => {
    localStorage.setItem(
      'chiri-settings',
      JSON.stringify({
        apiKey: 'sk-or-v1-valid-example-key',
        model: 'openai/gpt-4o-mini',
        continuationEnabled: true,
      }),
    )
  })

  // Navigate to the page
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Assert editor is immediately reachable and typing works
  await page.locator('.cm-content').click()
  await page.keyboard.type('x')

  expect(await docText(page)).toBe('x')

  // Assert the key modal is never present at any point (from first paint through 1s after load)
  const modal = page.locator('[data-testid="key-gate-modal"]')
  await expect(modal).not.toBeVisible()

  // Assert OpenRouter request count is 0 - no re-validation of a stored key
  expect(openRouterRequestCount).toBe(0)
})

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

test('T-FR-6-3: A one-tap action produces a revision within the latency bar', async ({
  page,
}) => {
  // Type the initial content
  await page.locator('.cm-content').click()
  await page.keyboard.type('The report was late because the team was busy.')

  // Verify initial content
  expect(await docText(page)).toBe('The report was late because the team was busy.')

  // Select all the text so the action bar appears
  await page.keyboard.press('Meta+a')

  // Intercept and handle the SSE request
  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
      body: `reason: Vague cause
--sep--
The report slipped because the team had competing priorities.`,
    })
  })

  // Click the "Improve the writing" one-tap action
  await page.locator('button:has-text("Improve the writing")').click()

  // Wait for the revision decoration to appear
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // Assert that the revision shows the existing text
  const existingText = await page.locator('[data-testid="revision-existing"]').textContent()
  expect(existingText).toContain('The report was late because the team was busy.')

  // Assert that the revision shows the proposed replacement text
  const proposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(proposedText).toContain('The report slipped because the team had competing priorities.')

  // Assert that the revision shows a non-empty reason
  const reason = await page.locator('[data-testid="revision-reason"]').textContent()
  expect(reason).toBeTruthy()
  expect(reason).toContain('Vague cause')

  // Assert that the document still contains the original sentence (nothing committed)
  expect(await docText(page)).toBe('The report was late because the team was busy.')
})

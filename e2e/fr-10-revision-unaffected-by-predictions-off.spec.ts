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

test('T-FR-10-8: Turning continuation off leaves FR-6 revisions unaffected', async ({
  page,
}) => {
  const fullDoc = 'The report was late because the team was busy.'

  // AC-10.6: turn continuation prediction off before touching FR-6 at all.
  const toggleButton = page.getByRole('button', { name: /Predictions/ })
  await expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
  await toggleButton.click()
  await expect(toggleButton).toHaveAttribute('aria-pressed', 'false')

  // Type the initial content
  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)
  expect(await docText(page)).toBe(fullDoc)

  // Select all the text so the action bar appears
  await page.keyboard.press('Meta+a')

  // Intercept the revision request with a real-shaped completion envelope
  await mockRevisionResponse(page, {
    reason: 'Vague cause',
    proposal: 'The report slipped because the team had competing priorities.',
  })

  // Click the "Improve the writing" one-tap action
  await page.locator('button:has-text("Improve the writing")').click()

  // The revision request is sent and a result is returned exactly as it
  // would be with continuation on.
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  const existingText = await page.locator('[data-testid="revision-existing"]').textContent()
  expect(existingText).toContain(fullDoc)

  const proposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(proposedText).toContain('The report slipped because the team had competing priorities.')

  const reason = await page.locator('[data-testid="revision-reason"]').textContent()
  expect(reason).toContain('Vague cause')

  // The toggle itself is untouched by the revision flow.
  await expect(toggleButton).toHaveAttribute('aria-pressed', 'false')

  // The revision can be accepted normally.
  await page.locator('[data-testid="revision-decoration"] button:has-text("Accept")').click()
  expect(await docText(page)).toBe('The report slipped because the team had competing priorities.')
})

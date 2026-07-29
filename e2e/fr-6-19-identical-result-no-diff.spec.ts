import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import type { EditorView } from '@codemirror/view'

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

test('T-FR-6-19: A result identical to the selected text is not shown, and the user is told nothing needed changing', async ({
  page,
}) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('Revenue grew steadily last quarter.')
  await page.keyboard.press('Meta+a')

  // The scripted model response is byte-identical to the current selection.
  await mockRevisionResponse(page, {
    reason: 'Already well written',
    proposal: 'Revenue grew steadily last quarter.',
  })

  await page.locator('button:has-text("Improve the writing")').click()

  // The message should appear rather than a pending revision decoration.
  await expect(page.locator('[data-testid="action-message"]')).toHaveText(
    'Nothing needed to change.',
  )

  // No diff is ever rendered for this response.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)

  // The lifecycle returned to Idle, not Pending: selecting a fresh span and
  // asking again is not refused, which the FR-6-12 "already pending" guard
  // would otherwise trigger.
  await page.keyboard.press('Meta+a')
  await mockRevisionResponse(page, {
    reason: 'Softened tone',
    proposal: 'Revenue climbed steadily last quarter.',
  })
  await page.locator('button:has-text("Improve the writing")').click()
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  expect(await docText(page)).toBe('Revenue grew steadily last quarter.')
})

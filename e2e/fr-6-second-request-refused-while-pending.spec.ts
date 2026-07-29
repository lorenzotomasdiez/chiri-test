import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { seedPendingRevision, docText } from './pendingRevision'
import type { EditorView } from '@codemirror/view'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/**
 * T-FR-6-12 (AC-6.13): while one revision is pending, selecting a different
 * span and asking for a second one must not send a request - the user is
 * told the pending revision has to be resolved first, and the original
 * pending revision stays exactly as it was.
 */
test('T-FR-6-12: A second request while one is pending is refused with an explanation', async ({
  page,
}) => {
  const doc = 'The report was late because the team was busy. Another unrelated sentence here.'

  await seedPendingRevision(page, {
    doc,
    span: 'The report was late because the team was busy.',
    proposed: 'The report slipped because the team had competing priorities.',
    reason: 'Vague cause',
  })

  // Fail the test loudly if a second request is actually sent.
  let secondRequestSent = false
  await page.route('https://openrouter.ai/**', async (route) => {
    secondRequestSent = true
    await route.abort('failed')
  })

  // Select the other, unrelated span in the document.
  const from = doc.indexOf('Another unrelated sentence here.')
  const to = from + 'Another unrelated sentence here.'.length
  await page.evaluate(
    ({ start, end }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      editor.dispatch({ selection: { anchor: start, head: end } })
    },
    { start: from, end: to },
  )

  // The action bar must still appear over the new selection...
  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  // ...but asking for a revision over it is refused.
  await page.locator('[data-testid="action-ask-ai"]').click()

  const message = page.locator('[data-testid="action-message"]')
  await expect(message).toBeVisible()
  await expect(message).toContainText(/already pending/i)
  await expect(message).toContainText(/resolve/i)

  expect(secondRequestSent).toBe(false)

  // The original pending revision is untouched.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="revision-proposed"]')).toContainText(
    'The report slipped because the team had competing priorities.',
  )
  expect(await docText(page)).toBe(doc)
})

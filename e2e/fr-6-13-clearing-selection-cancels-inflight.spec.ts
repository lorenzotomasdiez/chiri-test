/**
 * T-FR-6-13 (fr-6.md, P0, AC-6.14): clearing the selection while a revision
 * request is in flight cancels it. Nothing renders even if the scripted
 * response arrives afterward, and the action bar is gone.
 */

import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'
import { seedValidatedKey, seedContinuationDisabled } from './seed'
import { revisionTranscript } from './openrouter-mock'
import { docText } from './pendingRevision'

const DOC = 'The onboarding flow needs a rewrite before launch.'
const RESPONSE_DELAY_MS = 1_500

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await seedContinuationDisabled(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-13: clearing the selection mid-flight cancels the request and nothing ever renders', async ({
  page,
}) => {
  // Given the model's response is delayed long enough to clear the selection first
  await page.route('https://openrouter.ai/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS))
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: revisionTranscript({ reason: 'tightened the phrasing', proposal: 'A rewrite.' }),
    })
  })

  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  await page.keyboard.press('ControlOrMeta+a')
  await expect(page.locator('[data-testid="selection-action-bar"]')).toBeVisible()

  // When the user requests a revision, then clears the selection before the response arrives
  await page.locator('[data-testid="action-make-shorter"]').click()
  await expect(page.locator('[data-testid="action-progress"]')).toBeVisible()

  // Collapsing the selection directly on the CM6 view, the same way a click
  // elsewhere in the document would, rather than a keypress that would only
  // land on whatever element currently holds focus (the button just clicked).
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 0, head: 0 } })
  })
  await expect(page.locator('[data-testid="selection-action-bar"]')).toHaveCount(0)

  // Then even once the scripted response would have arrived, nothing renders
  await page.waitForTimeout(RESPONSE_DELAY_MS + 500)
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="selection-action-bar"]')).toHaveCount(0)
  expect(await docText(page)).toBe(DOC)
})

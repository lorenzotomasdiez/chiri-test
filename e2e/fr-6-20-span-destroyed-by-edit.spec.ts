/**
 * T-FR-6-20: The target span disappearing before the response arrives is
 * treated as a failed request.
 *
 * Distinct from T-FR-6-5/T-FR-6-13 (the user deliberately clearing the
 * selection, which cancels the request silently): here an edit removes the
 * exact text the in-flight request was reading - a paste over the whole
 * span - and the requirement is the opposite of silent: a visible failure
 * message, consistent with FR-12's general failure surface, and nothing
 * ever rendered as a pending revision even if the scripted response later
 * arrives.
 */

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { revisionTranscript } from './openrouter-mock'
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

test('T-FR-6-20: an edit that removes the target span while a revision is in flight surfaces a visible failure, never a revision', async ({
  page,
}) => {
  const text = 'The report was late because the team was busy.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(text)
  expect(await docText(page)).toBe(text)

  // Select "the team was busy." (offsets 28-46) - the action bar appears.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 28, head: 46 } })
  })

  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  // The scripted response is held back until the test explicitly releases
  // it, so it can be shown to arrive strictly after the span is destroyed.
  let releaseResponse: () => void = () => {}
  const canDeliver = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('https://openrouter.ai/**', async (route) => {
    await canDeliver
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: revisionTranscript({
        reason: 'Clarity',
        proposal: 'the team was overwhelmed.',
      }),
    })
  })

  await page.locator('[data-testid="action-improve-writing"]').click()

  // Give the request a moment to actually dispatch and register itself as
  // in flight before the span underneath it is destroyed.
  await page.waitForTimeout(200)

  // Paste over the exact span the in-flight request is reading - the
  // T-FR-6-20 trigger, distinct from a bare deselect (T-FR-6-13).
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ changes: { from: 28, to: 46, insert: '' } })
  })

  const expectedAfterEdit = 'The report was late because '

  // A visible, surfaced failure - not silence, and not a local message
  // inside an action bar that has already unmounted.
  const failureMessage = page.locator('[data-testid="failure-message"]')
  await expect(failureMessage).toBeVisible()
  await expect(failureMessage).toContainText('selected text changed')

  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  expect(await docText(page)).toBe(expectedAfterEdit)

  // The scripted response arrives late; it must still render nothing.
  releaseResponse()
  await page.waitForTimeout(300)
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  expect(await docText(page)).toBe(expectedAfterEdit)
})

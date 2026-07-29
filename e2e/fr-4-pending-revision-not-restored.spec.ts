import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import { readPersistedDoc, waitForPersisted } from './idb'
import type { EditorView } from '@codemirror/view'

/**
 * T-FR-4-4: A pending revision diff is never restored (AC-4.3).
 *
 * FR-4's promise is not only that the user's own text comes back, but that
 * nothing the AI merely proposed comes back with it. A pending revision is
 * painted as a `Decoration.widget` (src/editor/pendingRevision.ts) precisely
 * so it never enters the document, and this spec is what holds that design
 * to account: if the proposal ever leaks into the doc - or into the persisted
 * record - a reload would resurrect model output as the user's own writing.
 *
 * The check that matters most is the one against storage, not the one against
 * the reloaded editor. Asserting only on what comes back after a reload would
 * also pass if the proposal had been written to disk and then discarded on
 * load for some unrelated reason. Reading the record while the revision is
 * still pending is what pins the guarantee to the write path itself.
 */

const ORIGINAL =
  'First paragraph with some content.\n\nThe report was late because the team was busy.\n\nThird paragraph with more content.'

const PROPOSAL = 'The report slipped because the team had competing priorities.'
const REASON = 'Improved clarity'

async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-4-4: a pending revision is not restored, and never reaches storage', async ({
  page,
}) => {
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type(ORIGINAL)
  expect(await docText(page)).toBe(ORIGINAL)

  // The original has to be genuinely on disk before the revision is staged,
  // so that "the reload shows the original" is a statement about what was
  // saved rather than about an empty database.
  await waitForPersisted(page, (d) => d?.text === ORIGINAL)

  // Select the second paragraph only - the scenario is a revision pending
  // over one span, not over the whole document.
  await page.locator('[data-testid="editor"] .cm-content').getByText('The report was late').click()
  await page.keyboard.press('Home')
  await page.keyboard.press('Shift+End')
  const selected = await page.evaluate(() => {
    const s = (window as unknown as { __editor: EditorView }).__editor.state
    return s.doc.sliceString(s.selection.main.from, s.selection.main.to)
  })
  expect(selected).toBe('The report was late because the team was busy.')

  await mockRevisionResponse(page, { reason: REASON, proposal: PROPOSAL })
  await page.locator('button:has-text("Improve the writing")').click()
  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()

  // Pending means pending: the proposal is on screen but not in the document.
  expect(await docText(page)).toBe(ORIGINAL)

  // Give any write the pending state might have triggered every chance to
  // land before looking at storage. A leak that only shows up after the
  // debounce is exactly the bug this spec exists to catch.
  await page.waitForTimeout(2100)
  const persistedWhilePending = await readPersistedDoc(page)
  expect(persistedWhilePending?.text).toBe(ORIGINAL)
  expect(persistedWhilePending?.text).not.toContain(PROPOSAL)

  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // The document comes back as the user left it, with the original text of
  // the revised paragraph intact.
  const afterReload = await docText(page)
  expect(afterReload).toBe(ORIGINAL)
  expect(afterReload).toContain('The report was late because the team was busy.')
  expect(afterReload).not.toContain(PROPOSAL)

  // And no proposal, reason line, or diff markup is anywhere on the page -
  // there was nothing pending to restore.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  const bodyText = await page.locator('body').innerText()
  expect(bodyText).not.toContain(PROPOSAL)
  expect(bodyText).not.toContain(REASON)
})

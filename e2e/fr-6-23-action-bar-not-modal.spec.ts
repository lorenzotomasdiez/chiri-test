import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/**
 * T-FR-6-23: The action bar is never modal and never blocks continued typing
 * (fr-6.md, P2, "Beyond the stated criteria").
 *
 * Given the action bar is visible over a selection, when the user ignores it
 * and keeps typing elsewhere in the document instead of choosing an action,
 * the bar disappears as the selection is superseded, and the typing is
 * applied normally with no dialog, focus trap, or blocking overlay at any
 * point.
 */

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

test('T-FR-6-23: ignoring the action bar and typing elsewhere applies the keystrokes with no modal', async ({
  page,
}) => {
  const paragraph = 'The report was late because the team was busy.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(paragraph)
  expect(await docText(page)).toBe(paragraph)

  // Select "the team was busy" (offsets 28-45) to raise the bar.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 28, head: 45 } })
  })
  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  await expect(actionBar).toBeVisible()

  // No modal, dialog role, or focus-trapping overlay is ever present - the
  // bar is an inline affordance, not a blocking one.
  await expect(page.locator('[role="dialog"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="modal-overlay"]')).toHaveCount(0)

  // Move the caret to the end of the document (collapsing the selection)
  // and keep typing, ignoring the bar entirely instead of choosing an action.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const end = editor.state.doc.length
    editor.dispatch({ selection: { anchor: end, head: end } })
  })

  const appended = ' Even so, the deadline held.'
  await page.keyboard.type(appended)

  // The bar disappears once the selection is superseded by the collapsed
  // caret, and the typed text landed exactly as if the bar had never been
  // raised - no keystroke was intercepted, delayed, or dropped.
  await expect(actionBar).toHaveCount(0)
  expect(await docText(page)).toBe(paragraph + appended)

  // Nothing was ever rendered as a pending revision - the bar was ignored,
  // not acted on.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
})

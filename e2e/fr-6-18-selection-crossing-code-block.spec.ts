import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import type { EditorView } from '@codemirror/view'

/**
 * T-FR-6-18: A selection crossing into a fenced code block still produces a
 * revision over exactly that selection (AC-6.5).
 *
 * `src/core/revision.ts`'s span guards (`checkParagraphCount`,
 * `validateResponseSpan`) and the CM6 pending-span field
 * (`src/editor/pendingRevision.ts`) both work purely off document offsets -
 * neither one special-cases the markdown language mode, so a selection that
 * starts in prose and ends partway into a fenced code block's contents
 * should be tracked no differently from any other span. This spec pins that:
 * a coverage gap, not a fix, since nothing in the source reads the syntax
 * tree to decide where a revision may start or end.
 */

const FENCE = '```'
const DOC = [
  'Intro paragraph before the code.',
  '',
  `${FENCE}js`,
  'const value = compute();',
  'return value;',
  FENCE,
  '',
].join('\n')

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Reads the live pending-span field value straight out of CM6 state. */
async function getPendingRevision(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    return editor.state.field(
      (window as unknown as { pendingSpanField: any }).pendingSpanField,
      false,
    )
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test("T-FR-6-18: A selection crossing into a fenced code block still produces a revision over exactly that selection", async ({
  page,
}) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type(DOC)
  expect(await docText(page)).toBe(DOC)

  // Starts mid-paragraph, crosses the blank line and the whole fence-open
  // line, and ends partway into the code block's first line of contents -
  // stopping before "= compute();" so the selection is genuinely partial,
  // not the whole code line.
  const startIdx = DOC.indexOf('before the code.')
  const endIdx = DOC.indexOf('= compute')
  const selectedText = DOC.slice(startIdx, endIdx)
  expect(selectedText).toContain(FENCE)
  expect(selectedText).toContain('const value')

  await page.evaluate(
    ({ start, end }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      editor.dispatch({ selection: { anchor: start, head: end } })
    },
    { start: startIdx, end: endIdx },
  )

  await expect(page.locator('[data-testid="selection-action-bar"]')).toBeVisible()

  const proposal = 'const total = computeTotal();'
  await mockRevisionResponse(page, { reason: 'Clearer naming', proposal })

  await page.locator('[data-testid="action-custom-instruction"]').fill('make this clearer')
  await page.keyboard.press('Enter')

  await page.waitForSelector('[data-testid="revision-decoration"]', { timeout: 5000 })

  // The pending span is exactly the user's selection - including the part
  // that lives inside the code block - not narrowed to stop at the fence.
  const pending = await getPendingRevision(page)
  expect(pending).toBeTruthy()
  expect(pending.from).toBe(startIdx)
  expect(pending.to).toBe(endIdx)
  expect(pending.existing).toBe(selectedText)

  // Nothing has been committed yet: the document is untouched.
  expect(await docText(page)).toBe(DOC)

  // The proposed text is shown as the review surface's replacement...
  const proposedText = await page.locator('[data-testid="revision-proposed"]').textContent()
  expect(proposedText).toContain(proposal)

  // ...and accepting it replaces exactly the selected span, leaving the rest
  // of the code block (the unselected tail of that line, and every line
  // after it) and the paragraph's own untouched prefix exactly as they were.
  await page.locator('[data-testid="revision-decoration"] button:has-text("Accept")').click()
  const expectedDoc = DOC.slice(0, startIdx) + proposal + DOC.slice(endIdx)
  expect(await docText(page)).toBe(expectedDoc)
  // The rest of the code block after the selected span, and the paragraph's
  // own unselected prefix, are exactly as they were.
  expect(await docText(page)).toContain('return value;')
  expect(await docText(page)).toContain('Intro paragraph')
})

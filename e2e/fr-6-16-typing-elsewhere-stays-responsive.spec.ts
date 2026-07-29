import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'
import type { Revision } from '../src/core/revision'

/**
 * T-FR-6-16: Typing elsewhere in the document stays responsive while a
 * revision is pending (AC-6.17).
 *
 * The blueprint itself says a p95 latency assertion in a headless browser
 * is not reliable, so - as its own "How you would run this" note says -
 * this spec instead proves the Playwright-checkable half: every keystroke
 * typed in an unrelated part of the document while a revision is pending
 * lands in the document (none dropped or reordered) and the pending
 * revision keeps rendering, undisturbed, throughout.
 */

async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

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

test('T-FR-6-16: continuous typing away from a pending revision is never blocked or dropped', async ({
  page,
}) => {
  const initialDoc = 'First paragraph.\n\nThe report was late because the team was busy.'

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)
  expect(await docText(page)).toBe(initialDoc)

  // Raise a pending revision over "the team was busy", in the second
  // paragraph, exactly as fr-6-out-of-span-edit-tracks.spec.ts does.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const docStr = editor.state.doc.toString()
    const targetText = 'the team was busy'
    const from = docStr.indexOf(targetText)
    const to = from + targetText.length

    const revision: Revision = {
      id: 'test-revision-responsive',
      from,
      to,
      proposed: 'priorities collided',
      status: 'pending',
    }

    const pendingSpanField = (window as unknown as { pendingSpanField: any }).pendingSpanField
    editor.dispatch({ effects: [pendingSpanField.setEffect.of(revision)] })
  })

  const revisionWidget = page.locator('[data-testid="revision-accept"]')
  await expect(revisionWidget).toBeVisible()

  // Move the caret to the very start of the unrelated first paragraph and
  // type a long, fast burst there - well away from the pending span.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({ selection: { anchor: 0, head: 0 } })
  })

  const typedBurst = 'Quick brown fox jumps over the lazy dog! '
  await page.keyboard.type(typedBurst, { delay: 5 })

  // Every character landed, in order, at the front of the document - typing
  // was never blocked, dropped, or reordered by the pending revision.
  expect(await docText(page)).toBe(typedBurst + initialDoc)

  // The pending revision itself was never disturbed by the unrelated typing.
  const revision = await getPendingRevision(page)
  expect(revision).toBeDefined()
  expect(revision.status).toBe('pending')
  expect(revision.proposed).toBe('priorities collided')
  const currentDoc = await docText(page)
  expect(currentDoc.substring(revision.from, revision.to)).toBe('the team was busy')
  await expect(revisionWidget).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'
import type { Revision } from '../src/core/revision'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/** Get the pending revision state from the editor */
async function getPendingRevision(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const revisionState = editor.state.field(
      (window as unknown as { pendingSpanField: any }).pendingSpanField,
      false,
    )
    return revisionState
  })
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-11: Editing outside a pending revision span leaves it pending and its target unchanged', async ({
  page,
}) => {
  const initialDoc =
    'First paragraph.\n\nSecond paragraph.\n\nThe report was late because the team was busy.'

  // Set the initial document content
  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  // Verify initial content
  expect(await docText(page)).toBe(initialDoc)

  // The revision should span "the team was busy" (positions 66-83 in the initial doc)
  // Apply a pending revision through the editor state
  await page.evaluate(
    ([docText, proposedText]) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const doc = editor.state.doc

      // Find the position of "the team was busy"
      const targetText = 'the team was busy'
      const docStr = doc.toString()
      const from = docStr.indexOf(targetText)
      const to = from + targetText.length

      if (from === -1) {
        throw new Error('Could not find "the team was busy" in document')
      }

      // Create a pending revision without applying the change yet
      // This would normally be done by src/core/revision.ts
      const revision: Revision = {
        id: 'test-revision-1',
        from,
        to,
        proposed: proposedText,
        status: 'pending',
      }

      // Apply the pending revision to the editor state via pendingSpanField
      const pendingSpanField = (window as unknown as { pendingSpanField: any }).pendingSpanField
      if (!pendingSpanField) {
        throw new Error('pendingSpanField not found on window')
      }

      editor.dispatch({
        effects: [pendingSpanField.setEffect.of(revision)],
      })
    },
    [initialDoc, 'priorities collided'],
  )

  // Place cursor at end of first paragraph (position 16, right after "First paragraph.")
  // and type " An added sentence."
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.dispatch({
      selection: { anchor: 16, head: 16 },
    })
  })

  await page.keyboard.type(' An added sentence.')

  // After the insertion of 18 chars at position 16,
  // "the team was busy" should now be at positions 84-101 instead of 66-83
  expect(await docText(page)).toBe(
    'First paragraph. An added sentence.\n\nSecond paragraph.\n\nThe report was late because the team was busy.',
  )

  // Verify the revision is still pending and its mapped range still covers "the team was busy"
  const revision = await getPendingRevision(page)
  expect(revision).toBeDefined()
  expect(revision.status).toBe('pending')
  // The range should have shifted by 18 (the length of " An added sentence.")
  expect(revision.from).toBe(84) // 66 + 18
  expect(revision.to).toBe(101) // 83 + 18

  // Verify that the mapped range still points to exactly "the team was busy"
  const currentDoc = await docText(page)
  const mappedText = currentDoc.substring(revision.from, revision.to)
  expect(mappedText).toBe('the team was busy')

  // Accept the revision and verify the result
  await page.evaluate(
    ([revision]) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      // Call the accept function (from src/core/revision.ts or similar)
      const acceptRevision = (window as unknown as { acceptRevision: Function }).acceptRevision
      if (!acceptRevision) {
        throw new Error('acceptRevision function not found on window')
      }
      acceptRevision(revision)
    },
    [revision],
  )

  // Verify the final document has the accepted change applied
  expect(await docText(page)).toBe(
    'First paragraph. An added sentence.\n\nSecond paragraph.\n\nThe report was late because priorities collided.',
  )
})

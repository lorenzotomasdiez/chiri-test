import type { Page } from '@playwright/test'
import type { EditorView } from '@codemirror/view'
import type { Revision } from '../src/core/revision'

/**
 * FR-7's entry state, established directly rather than re-driven through the
 * FR-6 UI.
 *
 * Every FR-7 scenario opens on "a revision is already pending over a
 * selection", and how it got there is FR-6's plan, not this one's. Driving
 * the one-tap action path again in each spec would mean each FR-7 test also
 * silently depends on FR-6's request flow, so a regression there would fail
 * every FR-7 spec too and point at the wrong requirement. Dispatching the
 * pending-span effect states the precondition instead of re-testing it.
 */
export async function seedPendingRevision(
  page: Page,
  {
    doc,
    span,
    proposed,
    reason,
    instructionHistory,
  }: {
    doc: string
    /** The exact substring of `doc` the revision covers. */
    span: string
    proposed: string
    reason: string
    /** Prior refinement instructions, for scenarios that open mid-chain. */
    instructionHistory?: string[]
  },
): Promise<{ from: number; to: number }> {
  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  const from = doc.indexOf(span)
  if (from === -1) throw new Error(`span not found in doc: ${span}`)
  const to = from + span.length

  await page.evaluate(
    ({ start, end, proposedText, reasonText, existing, history }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const field = (
        window as unknown as {
          pendingSpanField?: { setEffect: { of: (value: Revision) => unknown } }
        }
      ).pendingSpanField
      if (!field) throw new Error('pendingSpanField not found on window')

      const revision: Revision = {
        id: `seeded-${start}-${end}`,
        from: start,
        to: end,
        proposed: proposedText,
        status: 'pending',
        existing,
        reason: reasonText,
        modelId: 'test-model',
        instructionHistory: history,
      }

      editor.dispatch({ effects: [field.setEffect.of(revision)] })
    },
    {
      start: from,
      end: to,
      proposedText: proposed,
      reasonText: reason,
      existing: span,
      history: instructionHistory,
    },
  )

  await page.waitForSelector('[data-testid="revision-decoration"]')
  return { from, to }
}

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
export async function docText(page: Page): Promise<string> {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

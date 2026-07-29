import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

const DOCUMENT = 'The report was late because the team was busy.'
const SPAN = 'the team was busy'
const TYPED = 'the deadline was unrealistic'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-10: Editing inside a pending revision span invalidates it silently', async ({
  page,
}) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type(DOCUMENT)
  expect(await docText(page)).toBe(DOCUMENT)

  // Offsets are derived from the document rather than hand-counted, so the
  // span is the real "the team was busy" and not whatever a literal number
  // happens to point at.
  const spanStart = DOCUMENT.indexOf(SPAN)
  const spanEnd = spanStart + SPAN.length

  await page.evaluate(
    ({ from, to }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      const setPending = (
        window as unknown as {
          setPendingRevision: (
            from: number,
            to: number,
            existing: string,
            modelId: string,
            proposed?: string,
            reason?: string,
          ) => unknown
        }
      ).setPendingRevision
      editor.dispatch({
        effects: [
          setPending(
            from,
            to,
            editor.state.sliceDoc(from, to),
            'openai/gpt-4o-mini',
            'the team was stretched thin',
            'Softens the blame.',
          ),
        ] as never,
      })
    },
    { from: spanStart, to: spanEnd },
  )

  // The revision must actually be pending before the edit, or everything
  // below would pass against an editor that never showed one.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(1)

  // Place the caret strictly inside the span, at the start of "team".
  const caret = spanStart + 'the '.length
  await page.evaluate((pos) => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    editor.focus()
    editor.dispatch({ selection: { anchor: pos, head: pos } })
  }, caret)

  await page.keyboard.type(TYPED)

  // AC-6.11: the pending revision is gone, with no message and no prompt.
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)

  // AC-6.11's other half: the typed edit is applied "exactly as if no
  // revision had been pending". A collapsed caret inserts - it does not
  // replace the span - so the expectation is built by doing that insertion
  // to the original string rather than by asserting a replacement the
  // editor was never asked to perform.
  const expected = DOCUMENT.slice(0, caret) + TYPED + DOCUMENT.slice(caret)
  expect(await docText(page)).toBe(expected)
})

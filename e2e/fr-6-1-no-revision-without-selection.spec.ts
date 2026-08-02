/**
 * T-FR-6-1: No revision is ever proposed without a selection, across a full
 * editing session.
 *
 * FR-6 revisions only ever originate from a real text selection through the
 * SelectionActionBar - this spec guards the inverse: a session that types,
 * pauses long enough for FR-10's Scheduler to settle (which is allowed to
 * fire an FR-5 continuation request), and idles, but never selects anything,
 * must never raise the action bar, never paint a revision decoration, and
 * never send a revision-shaped request to OpenRouter. Every other FR-6 spec
 * starts from an existing selection; none of them cover the session that
 * never makes one.
 */

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, moveCaret, docText } from './continuation'
import type { EditorView } from '@codemirror/view'

/** The exact system-message text `buildRevisionRequest` sends in src/core/prompt.ts. */
const REVISION_MARKER = 'Rewrite only the marked span.'
/** The exact system-message text `buildContinuationRequest` sends in src/core/prompt.ts. */
const CONTINUATION_MARKER = 'Continue the text with at most two sentences'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-6-1: a session with no selection never proposes a revision', async ({ page }) => {
  const paragraphOne = 'The cabin sat quiet under the first snow of the season.'
  const paragraphTwo = 'Nothing moved on the road below, and the fire had gone out hours ago.'
  const paragraphThree = 'By evening the light had gone entirely, and still nobody came.'

  let revisionCount = 0
  let continuationCount = 0

  await page.route('https://openrouter.ai/**', async (route) => {
    const body = route.request().postData() ?? ''

    if (body.includes(REVISION_MARKER)) {
      revisionCount += 1
      await route.fulfill({ status: 500, body: '' })
      return
    }

    if (body.includes(CONTINUATION_MARKER)) {
      continuationCount += 1
      // Answered as a real continuation so the app's normal FR-5/FR-10
      // background traffic behaves as it would for an idle writer - this
      // spec must not accidentally suppress the allowed request class while
      // proving the forbidden one never fires.
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body:
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: ' and settled in for the night.' } }] })}\n\n` +
          'data: [DONE]\n\n',
      })
      return
    }

    // Key validation or anything else unrelated to either request family.
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' })
  })

  const actionBar = page.locator('[data-testid="selection-action-bar"]')
  const revisionDecoration = page.locator('[data-testid="revision-decoration"]')

  const assertNoRevisionSurface = async () => {
    await expect(actionBar).toHaveCount(0)
    await expect(revisionDecoration).toHaveCount(0)
    const pendingRaised = await page.evaluate(() => {
      const w = window as unknown as {
        __editor: { state: { field: (f: unknown, req: boolean) => unknown } }
        pendingSpanField: unknown
      }
      return w.__editor.state.field(w.pendingSpanField, false) != null
    })
    expect(pendingRaised, 'no selection was ever made, so no revision should ever be pending').toBe(false)
  }

  // Type the first paragraph, then pause well past the Scheduler's settle
  // window while idle - long enough for a continuation to be offered, never
  // long enough (nor caused by anything) that would raise a revision.
  await page.locator('.cm-content').click()
  await page.keyboard.type(paragraphOne)
  await assertNoRevisionSurface()

  await page.waitForTimeout(PAST_SETTLE_MS)
  await assertNoRevisionSurface()

  // Move the caret around mid-document without ever selecting a range -
  // collapsed selections stay at anchor === head throughout.
  await moveCaret(page, paragraphOne.indexOf('quiet'))
  await assertNoRevisionSurface()

  // Type more, forming a new paragraph, still without selecting.
  await page.keyboard.press('End')
  await page.keyboard.type(`\n\n${paragraphTwo}`)
  await assertNoRevisionSurface()

  // Let the app sit idle again, comfortably past settle, at the end of the
  // document this time.
  await page.waitForTimeout(PAST_SETTLE_MS)
  await assertNoRevisionSurface()

  // Finish a third section, again with no selection anywhere in the session.
  await page.keyboard.type(`\n\n${paragraphThree}`)
  await assertNoRevisionSurface()

  await page.waitForTimeout(PAST_SETTLE_MS)
  await assertNoRevisionSurface()

  // Confirm the selection genuinely never left a collapsed range at any
  // point this spec touched the editor.
  const selectionIsCollapsed = await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const sel = editor.state.selection.main
    return sel.anchor === sel.head
  })
  expect(selectionIsCollapsed).toBe(true)

  // The only thing that ever hit OpenRouter in a revision shape is nothing -
  // continuation traffic, if any fired, is a different and allowed request
  // family and is not being asserted against here.
  expect(revisionCount, 'no revision-shaped request should ever be sent without a selection').toBe(0)

  // The final document is exactly what was typed - nothing else touched it.
  // Read off CodeMirror's own state (the canonical Markdown), the same
  // seam every other FR-5/FR-6 spec in this suite uses, rather than the
  // rendered DOM - `.cm-content`'s text content collapses the blank lines
  // between paragraphs into a shape that never matches the source Markdown.
  const expectedDoc = `${paragraphOne}\n\n${paragraphTwo}\n\n${paragraphThree}`
  expect(await docText(page)).toBe(expectedDoc)
})

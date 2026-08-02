import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'
import { seedValidatedKey } from './seed'
import { seedPendingRevision, docText } from './pendingRevision'

const DOC = 'Intro line.\n\nThe launch date is unclear.\n\nClosing line.'
const SPAN = 'The launch date is unclear.'
const PROPOSED = 'The launch date is not yet set.'
const REASON = 'Clarified'
const STALE_RESULT = 'No launch date is set.'

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('A refinement response that resolves after its revision was already invalidated is discarded, not resurrected', async ({
  page,
}) => {
  // Given a pending revision with a refinement in flight
  await seedPendingRevision(page, { doc: DOC, span: SPAN, proposed: PROPOSED, reason: REASON })
  const docBefore = await docText(page)

  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  await page.route('https://openrouter.ai/**', async (route) => {
    await held
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        frame('reason: Shortened\n') +
        frame('--') +
        frame('sep') +
        frame('--') +
        frame(`\n${STALE_RESULT}`) +
        'data: [DONE]\n\n',
    })
  })

  await page.locator('[data-testid="revision-refine"]').click()
  const input = page.locator('[data-testid="refinement-instruction-input"]')
  await input.fill('make it shorter')
  await page.locator('[data-testid="revision-refine-submit"]').click()
  await expect(page.locator('[data-testid="revision-refine-progress"]')).toBeVisible()

  // When the pending revision is invalidated (e.g. by an edit touching its
  // span, or by Reject - both clear the field through the same effect) while
  // that request is still open. Dispatched directly rather than through the
  // (disabled, mid-turn) Reject button, which real edits don't go through
  // either.
  await page.evaluate(() => {
    const editor = (window as unknown as { __editor: EditorView }).__editor
    const field = (
      window as unknown as { pendingSpanField: { setEffect: { of: (v: null) => unknown } } }
    ).pendingSpanField
    editor.dispatch({ effects: [field.setEffect.of(null)] })
  })
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)

  // And the held response finally resolves
  const responseArrived = page.waitForResponse((res) => res.url().includes('openrouter.ai'))
  release()
  await responseArrived
  // Give the client's stream-decode and dispatch microtasks a moment to run
  // before asserting the negative outcome below - unlike a positive
  // assertion, "still absent" can't rely on Playwright's own auto-retry to
  // wait out an async change that hasn't landed yet.
  await page.waitForTimeout(300)

  // Then the stale turn never resurrects the dismissed revision, and the
  // document is exactly as it was left
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(0)
  expect(await docText(page)).toBe(docBefore)
})

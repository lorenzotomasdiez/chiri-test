import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { seedPendingRevision, docText } from './pendingRevision'

const DOC = 'Intro line.\n\nThe launch date is unclear.\n\nClosing line.'
const SPAN = 'The launch date is unclear.'
const PROPOSED = 'The launch date is not yet set.'
const REASON = 'Clarified'

/** The complete refined text - the only string that may ever reach the document. */
const COMPLETE = 'No launch date has been fixed, and none is expected this quarter.'
/** A prefix of it, which is what a mid-stream snapshot would commit. */
const PARTIAL = 'No launch date has been fixed'

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-7-12: Accept commits the fully-streamed refinement, never a partial render', async ({
  page,
}) => {
  // Given a pending revision
  await seedPendingRevision(page, { doc: DOC, span: SPAN, proposed: PROPOSED, reason: REASON })

  // And a refinement response that is held open, standing in for a stream
  // still arriving chunk by chunk
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
        frame(`reason: Expanded\n`) +
        frame('--') +
        frame('sep') +
        frame('--') +
        frame(`\n${PARTIAL}`) +
        frame(', and none is expected this quarter.') +
        'data: [DONE]\n\n',
    })
  })

  // When the user submits a refinement and the response has not finished
  await page.locator('[data-testid="revision-refine"]').click()
  await page.locator('[data-testid="refinement-instruction-input"]').fill('say more')
  await page.locator('[data-testid="revision-refine-submit"]').click()

  // Then the accept control is not active while the result is incomplete, so
  // no partial text can be committed
  await expect(page.locator('[data-testid="revision-accept"]')).toBeDisabled()
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(PROPOSED)

  // When the stream completes
  release()

  // Then accept becomes available and the fully-streamed text is what shows
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(COMPLETE)
  await expect(page.locator('[data-testid="revision-accept"]')).toBeEnabled()

  // And accepting the instant it completes commits the complete text, not the
  // mid-stream snapshot
  await page.locator('[data-testid="revision-accept"]').click()
  const finalDoc = await docText(page)
  expect(finalDoc).toBe(`Intro line.\n\n${COMPLETE}\n\nClosing line.`)
  expect(finalDoc).not.toContain(`${PARTIAL}\n`)
})

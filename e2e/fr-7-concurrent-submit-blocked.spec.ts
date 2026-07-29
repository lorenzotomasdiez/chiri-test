import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { seedPendingRevision, docText } from './pendingRevision'

const DOC = 'Intro line.\n\nThe launch date is unclear.\n\nClosing line.'
const SPAN = 'The launch date is unclear.'
const PROPOSED = 'The launch date is not yet set.'
const REASON = 'Clarified'
const FIRST_RESULT = 'No launch date is set.'

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-7-9: A second refinement submitted while the first is in flight is blocked, with the in-progress state visible', async ({
  page,
}) => {
  // Given a pending revision and a refinement response held open
  await seedPendingRevision(page, { doc: DOC, span: SPAN, proposed: PROPOSED, reason: REASON })
  const docBefore = await docText(page)

  let requestCount = 0
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  await page.route('https://openrouter.ai/**', async (route) => {
    requestCount += 1
    await held
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        frame('reason: Shortened\n') +
        frame('--') +
        frame('sep') +
        frame('--') +
        frame(`\n${FIRST_RESULT}`) +
        'data: [DONE]\n\n',
    })
  })

  // When the user submits a first instruction
  await page.locator('[data-testid="revision-refine"]').click()
  const input = page.locator('[data-testid="refinement-instruction-input"]')
  await input.fill('make it shorter')
  await page.locator('[data-testid="revision-refine-submit"]').click()

  // Then the in-progress state is visible while that turn is open
  await expect(page.locator('[data-testid="revision-refine-progress"]')).toBeVisible()
  await expect(page.locator('[data-testid="revision-refine-submit"]')).toBeDisabled()

  // When a second instruction is submitted before the first resolves, by
  // Enter - the path the disabled submit button does not cover
  await input.fill('less formal')
  await input.press('Enter')
  await page.locator('[data-testid="revision-refine-submit"]').click({ force: true })

  // Then no second request is issued, and the document is untouched
  expect(requestCount).toBe(1)
  expect(await docText(page)).toBe(docBefore)

  // And at most one proposed text is rendered: the pre-turn one still stands
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(PROPOSED)

  // When the first turn resolves
  release()

  // Then its result lands alone, and the in-progress state clears
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(FIRST_RESULT)
  await expect(page.locator('[data-testid="revision-refine-progress"]')).toHaveCount(0)
  expect(requestCount).toBe(1)
  expect(await docText(page)).toBe(docBefore)
})

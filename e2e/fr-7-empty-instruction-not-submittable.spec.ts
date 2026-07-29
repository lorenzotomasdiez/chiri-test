import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { seedPendingRevision, docText } from './pendingRevision'

const DOC = 'Intro line.\n\nThe launch date is unclear.\n\nClosing line.'
const SPAN = 'The launch date is unclear.'
const PROPOSED = 'The launch date is not yet set.'
const REASON = 'Clarified'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

for (const { label, value } of [
  { label: 'empty', value: '' },
  { label: 'whitespace-only', value: '   ' },
]) {
  test(`T-FR-7-8: An ${label} refinement instruction cannot be submitted`, async ({ page }) => {
    // Given a pending revision with its refinement input open and empty
    await seedPendingRevision(page, { doc: DOC, span: SPAN, proposed: PROPOSED, reason: REASON })
    const docBefore = await docText(page)

    // Count every request that reaches OpenRouter
    let requestCount = 0
    await page.route('https://openrouter.ai/**', async (route) => {
      requestCount += 1
      await route.abort('failed')
    })

    await page.locator('[data-testid="revision-refine"]').click()
    const input = page.locator('[data-testid="refinement-instruction-input"]')
    if (value) await input.fill(value)

    // When the user submits, by button and by Enter
    await page.locator('[data-testid="revision-refine-submit"]').click()
    await input.press('Enter')

    // Then no refinement request is issued
    await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
    expect(requestCount).toBe(0)

    // And the revision remains pending in its current, unrefined state
    await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(PROPOSED)
    await expect(page.locator('[data-testid="revision-reason"]')).toHaveText(REASON)
    expect(await docText(page)).toBe(docBefore)

    // And the refinement input remains available for a real instruction
    await expect(input).toBeVisible()
    await expect(input).toBeEditable()
  })
}

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

test('T-FR-7-5: Dismissing the refinement input with Escape leaves the revision pending and unchanged', async ({
  page,
}) => {
  // Given a pending revision with its refinement input open and an instruction typed but not submitted
  await seedPendingRevision(page, { doc: DOC, span: SPAN, proposed: PROPOSED, reason: REASON })
  const docBefore = await docText(page)

  // No refinement request may be issued by anything this test does
  let requestCount = 0
  await page.route('https://openrouter.ai/**', async (route) => {
    requestCount += 1
    await route.abort('failed')
  })

  await page.locator('[data-testid="revision-refine"]').click()
  const input = page.locator('[data-testid="refinement-instruction-input"]')
  await expect(input).toBeFocused()
  await input.fill('try a different angle')

  // When the user dismisses the refinement input with Escape
  await input.press('Escape')

  // Then the revision remains pending with the same proposed text, reason, and span
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(PROPOSED)
  await expect(page.locator('[data-testid="revision-reason"]')).toHaveText(REASON)
  await expect(page.locator('[data-testid="revision-existing"]')).toHaveText(SPAN)

  // And the typed but unsubmitted instruction is discarded
  await expect(input).toHaveValue('')

  // And the underlying revision is neither rejected nor accepted - the
  // document is untouched and both terminal actions are still available
  expect(await docText(page)).toBe(docBefore)
  await expect(page.locator('[data-testid="revision-accept"]')).toBeVisible()
  await expect(page.locator('[data-testid="revision-reject"]')).toBeVisible()
  expect(requestCount).toBe(0)
})

test('T-FR-7-5: Dismissing by clicking away leaves the revision pending and unchanged', async ({
  page,
}) => {
  // Given the same pending revision with an unsubmitted instruction typed
  await seedPendingRevision(page, { doc: DOC, span: SPAN, proposed: PROPOSED, reason: REASON })
  const docBefore = await docText(page)

  let requestCount = 0
  await page.route('https://openrouter.ai/**', async (route) => {
    requestCount += 1
    await route.abort('failed')
  })

  await page.locator('[data-testid="revision-refine"]').click()
  const input = page.locator('[data-testid="refinement-instruction-input"]')
  await input.fill('try a different angle')

  // When the user clicks away from the refinement input, into the document
  await page.locator('.cm-content').click({ position: { x: 5, y: 5 } })

  // Then the revision is still pending, unchanged, with the instruction discarded
  await expect(page.locator('[data-testid="revision-decoration"]')).toBeVisible()
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(PROPOSED)
  await expect(page.locator('[data-testid="revision-reason"]')).toHaveText(REASON)
  await expect(page.locator('[data-testid="refinement-instruction-input"]')).toHaveValue('')
  expect(await docText(page)).toBe(docBefore)
  expect(requestCount).toBe(0)
})

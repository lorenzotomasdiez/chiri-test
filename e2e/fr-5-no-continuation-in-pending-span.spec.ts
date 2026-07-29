import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import {
  PAST_SETTLE_MS,
  mockOpenRouter,
  moveCaret,
  raisePendingRevision,
  snapshot,
} from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-23: No continuation is requested within the span of a pending revision', async ({
  page,
}) => {
  // The span deliberately ends where the paragraph ends. A span that stopped
  // mid-line would be refused by the end-of-paragraph rule alone, and this
  // test would then pass just as happily with the pending-span check deleted.
  const span = 'the first snow of the season'
  const doc = `The cabin sat quiet under ${span}`

  const mock = await mockOpenRouter(page, { continuation: ' and the road was gone.' })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  const spanStart = doc.indexOf(span)
  const spanEnd = spanStart + span.length
  expect(spanEnd, 'the span must end at the end of the paragraph').toBe(doc.length)

  await raisePendingRevision(page, spanStart, spanEnd)

  await page.waitForTimeout(PAST_SETTLE_MS)
  const before = mock.continuationCount()

  // Put the caret at the end of the pending span - an otherwise perfectly
  // eligible position, refused only because a revision is open over it.
  await moveCaret(page, spanEnd)
  await page.waitForTimeout(PAST_SETTLE_MS)

  expect(mock.continuationCount(), 'continuation requests issued inside a pending span').toBe(
    before,
  )

  const state = await snapshot(page)
  expect(state.ghost).toBeNull()
  expect(state.ghostWidgets).toBe(0)
  expect(state.doc).toBe(doc)
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import {
  docText,
  ghostText,
  mockOpenRouter,
  moveCaret,
  raisePendingRevision,
  waitForGhost,
} from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-24: Continuation remains available elsewhere while a revision is pending', async ({
  page,
}) => {
  const span = 'the first snow of the season'
  const paragraphOne = `The cabin sat quiet under ${span}`
  const paragraphTwo = 'Nothing moved on the road below.'
  const paragraphThree = 'By evening the writer had stopped and'
  const doc = `${paragraphOne}\n\n${paragraphTwo}\n\n${paragraphThree}`
  const continuation = ' put the kettle on.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  const spanStart = doc.indexOf(span)
  await raisePendingRevision(page, spanStart, spanStart + span.length)

  // A pending revision suppresses continuation over its own span, not over
  // the document. The writer who has moved on to another paragraph is still
  // writing, and is still owed a continuation there.
  await moveCaret(page, doc.length)

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)
  await expect(page.locator('[data-testid="ghost-text"]')).toBeVisible()

  // The pending revision is untouched by any of this, and nothing was
  // committed to the document.
  expect(await docText(page)).toBe(doc)
  const stillPending = await page.evaluate(() => {
    const w = window as unknown as {
      __editor: { state: { field: (f: unknown, req: boolean) => unknown } }
      pendingSpanField: unknown
    }
    return w.__editor.state.field(w.pendingSpanField, false) !== null
  })
  expect(stillPending, 'the revision should still be pending').toBe(true)
})

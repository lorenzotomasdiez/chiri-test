import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { PAST_SETTLE_MS, mockOpenRouter, moveCaret, snapshot } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-29: Nothing shown while idle alters, replaces, or annotates already-written text', async ({
  page,
}) => {
  const paragraphOne = 'The cabin sat quiet under the first snow of the season.'
  const paragraphTwo = 'Nothing moved on the road below, and'
  const paragraphThree = 'By evening the light had gone entirely.'
  const doc = `${paragraphOne}\n\n${paragraphTwo}\n\n${paragraphThree}`

  await mockOpenRouter(page, { continuation: ' the kettle went on.' })

  await page.locator('.cm-content').click()
  await page.keyboard.type(doc)

  const before = (await snapshot(page)).doc
  expect(before).toBe(doc)

  // Pause in three different places: mid-document with nothing offered, at
  // the end of a paragraph where something is offered, and at the very end.
  const pausePoints = [
    paragraphOne.indexOf('quiet'),
    `${paragraphOne}\n\n${paragraphTwo}`.length,
    doc.length,
  ]

  for (const offset of pausePoints) {
    await moveCaret(page, offset)
    await page.waitForTimeout(PAST_SETTLE_MS)

    // Whether or not a continuation appeared at this position, every
    // character that existed before the pause is still there, unchanged and
    // in the same order.
    const state = await snapshot(page)
    expect(state.doc, `document after pausing at ${offset}`).toBe(before)
  }

  // Nothing was painted over already-written text either: no pending-revision
  // review surface was raised, and no annotation, strikethrough, or comment
  // decoration exists anywhere in the editor.
  const pendingRaised = await page.evaluate(() => {
    const w = window as unknown as {
      __editor: { state: { field: (f: unknown, req: boolean) => unknown } }
      pendingSpanField: unknown
    }
    return w.__editor.state.field(w.pendingSpanField, false) !== null
  })
  expect(pendingRaised, 'idling must never raise a revision over written text').toBe(false)

  await expect(page.locator('[data-testid="pending-revision"]')).toHaveCount(0)
  await expect(page.locator('.cm-content del, .cm-content ins')).toHaveCount(0)

  expect((await snapshot(page)).doc).toBe(doc)
})

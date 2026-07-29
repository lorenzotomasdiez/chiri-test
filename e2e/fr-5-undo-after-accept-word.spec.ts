import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { docText, ghostText, mockOpenRouter, snapshot, waitForGhost } from './continuation'

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-15: Undo after a partial acceptance removes only what was committed, as one unit', async ({
  page,
}) => {
  const initialDoc = '- Pack the tent, the stove, and'
  const continuation = ' the pot for coffee.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)

  await page.keyboard.press(`${MOD}+ArrowRight`)
  expect(await docText(page)).toBe(`${initialDoc} the`)

  await page.keyboard.press('Control+Z')

  const state = await snapshot(page)
  // Only the one committed word comes back off - and it comes off whole,
  // rather than a character at a time.
  expect(state.doc, 'one undo should remove exactly the accepted word').toBe(initialDoc)
  expect(state.caret).toBe(initialDoc.length)
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { readPersistedDoc, waitForPersisted } from './idb'

/**
 * T-FR-4-2: A character survives the durability floor (AC-4.2, NFR-5).
 *
 * NFR-5 promises that an interruption loses no more than a couple of seconds
 * of the most recent typing. That is a wall-clock promise about the whole
 * write path - the 800ms debounce plus the real IndexedDB round trip - so it
 * is measured here, against real storage, rather than against fake timers and
 * an in-memory object where the only number available is the debounce
 * constant the test itself supplied.
 *
 * The assertion is deliberately one-sided, matching the plan: at 2.0s the
 * character must be durable. Below the floor nothing is asserted either way,
 * because losing input that recent is inside the allowance, and pinning it
 * down would freeze the debounce timing into a contract it is not.
 */

const DURABILITY_FLOOR_MS = 2000

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-4-2: a character typed into a saved document is durable within the floor', async ({
  page,
}) => {
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('Draft intro paragraph.')

  // Establish the "given": the base document is already on disk, so the next
  // keystroke is the only thing whose durability is under test.
  await waitForPersisted(page, (d) => d?.text === 'Draft intro paragraph.')

  // The keystroke, and the clock starting at the moment it lands.
  const typedAt = Date.now()
  await page.keyboard.type('x')

  const persisted = await waitForPersisted(
    page,
    (d) => d?.text === 'Draft intro paragraph.x',
    DURABILITY_FLOOR_MS,
  )
  const elapsed = Date.now() - typedAt

  expect(persisted?.text).toBe('Draft intro paragraph.x')
  expect(elapsed).toBeLessThan(DURABILITY_FLOOR_MS)

  // The caret travels with the text. A record that saved the character but
  // not the caret restores the document with the cursor in the wrong place.
  expect(persisted?.caretOffset).toBe('Draft intro paragraph.x'.length)

  // And it is genuinely durable, not just briefly present: a reload past the
  // floor brings it back.
  await page.waitForTimeout(200)
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  const afterReload = await page.evaluate(() =>
    (window as unknown as { __editor: { state: { doc: { toString(): string } } } }).__editor.state.doc.toString(),
  )
  expect(afterReload).toBe('Draft intro paragraph.x')
})

test('T-FR-4-2: the character is still there after the floor has passed', async ({ page }) => {
  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('Draft intro paragraph.')
  await waitForPersisted(page, (d) => d?.text === 'Draft intro paragraph.')

  await page.keyboard.type('x')
  await page.waitForTimeout(DURABILITY_FLOOR_MS + 100)

  // Nothing later overwrites it - no stale debounce firing after the fact
  // with the pre-keystroke text.
  const persisted = await readPersistedDoc(page)
  expect(persisted?.text).toBe('Draft intro paragraph.x')
})

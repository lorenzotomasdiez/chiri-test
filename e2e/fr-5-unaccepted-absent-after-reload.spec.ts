import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { waitForPersisted } from './idb'
import { docText, ghostText, mockOpenRouter, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-5-11: An unaccepted continuation leaves no trace after reload', async ({ page }) => {
  const written = 'The cabin sat quiet under the first snow of the season, and'
  const continuation = ' the road out had already vanished.'

  await mockOpenRouter(page, { continuation })

  await page.locator('.cm-content').click()
  await page.keyboard.type(written)

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(continuation)

  // Wait for FR-4 to actually commit the record, so the reload below restores
  // from a write that happened while the continuation was on screen - which is
  // the only version of this test that can catch a ghost leaking into the
  // persisted document.
  const persisted = await waitForPersisted(page, (doc) => doc?.text === written)
  expect(persisted?.text).toBe(written)

  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  expect(await docText(page)).toBe(written)
  expect(await docText(page)).not.toContain('the road out')
  expect(await docText(page)).not.toContain('vanished')
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { waitForPersisted } from './idb'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
  await page.evaluate(() => document.fonts.ready)
})

test('T-FR-4-8: A document emptied by deleting all content persists as empty', async ({ page }) => {
  const editorContent = page.locator('[data-testid="editor"] .cm-content')
  await editorContent.click()
  await page.keyboard.type('Temporary notes to be discarded.')

  // The "given" has to be real before the deletion means anything. Without
  // this, a completely dead write path would leave storage empty, the reload
  // would show an empty document, and the assertions below would all pass
  // while proving nothing. Failing here says "persistence is broken"; failing
  // later says "the empty state was not saved" - two different bugs that this
  // spec must not conflate.
  await waitForPersisted(page, (d) => d?.text === 'Temporary notes to be discarded.')

  await editorContent.click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Backspace')
  expect(await page.evaluate(() => window.__editor.state.doc.toString())).toBe('')

  // The empty state is a value to save, not an absence of one. Waiting on the
  // record rather than sleeping is what catches an implementation that treats
  // '' as "nothing to write" and silently leaves the old text on disk.
  await waitForPersisted(page, (d) => d?.text === '')

  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  const docState = await page.evaluate(() => window.__editor.state.doc.toString())
  expect(docState).toBe('')
  expect(docState).not.toContain('Temporary notes to be discarded.')

  const onboardingCue = page.locator('[data-testid="onboarding-cue"]')
  await expect(onboardingCue).toBeVisible()
})

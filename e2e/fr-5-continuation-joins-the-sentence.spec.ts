import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockOpenRouter, docText, ghostText, waitForGhost } from './continuation'

/**
 * A continuation is offered as the next stretch of the writer's own sentence,
 * so it has to land against the text before the caret the way a human typing
 * on would land it: with a word gap where one is needed, and without a
 * doubled gap where the document already ends in one.
 *
 * Both halves failed in the real app. A model that answers "I'm doing well"
 * to a document ending "hello how you doing?" was rendered glued to the
 * question mark - "doing?I'm doing well" - because nothing ever inspected the
 * character before the caret.
 */
test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
})

test('a continuation after a closed sentence is offered with the word gap it needs', async ({
  page,
}) => {
  await mockOpenRouter(page, { continuation: ['I', "'m doing well, thank you."] })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('hello how you doing?')

  await waitForGhost(page)
  expect(await ghostText(page)).toBe(" I'm doing well, thank you.")

  await page.keyboard.press('Tab')
  expect(await docText(page)).toBe("hello how you doing? I'm doing well, thank you.")
})

test('a continuation after a trailing space is not offered with a second one', async ({ page }) => {
  await mockOpenRouter(page, { continuation: [' just', ' a note to check in.'] })
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  await page.locator('[data-testid="editor"] .cm-content').click()
  await page.keyboard.type('This message is ')

  await waitForGhost(page)
  expect(await ghostText(page)).toBe('just a note to check in.')

  await page.keyboard.press('Tab')
  expect(await docText(page)).toBe('This message is just a note to check in.')
})

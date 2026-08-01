import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import type { EditorView } from '@codemirror/view'

/** Wraps one fragment of assistant prose in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/**
 * Shared with the two FR-5/FR-6 states below, and with the main test's own
 * three states.
 */
async function assertNoNavigationChrome(page: import('@playwright/test').Page) {
  // Assert count 0 for role='tree'
  expect(await page.locator('[role="tree"]').count()).toBe(0)

  // Assert count 0 for role='tablist'
  expect(await page.locator('[role="tablist"]').count()).toBe(0)

  // Assert count 0 for role='tab'
  expect(await page.locator('[role="tab"]').count()).toBe(0)

  // Assert count 0 for role='navigation'
  expect(await page.locator('[role="navigation"]').count()).toBe(0)

  // Assert count 0 for role='complementary'
  expect(await page.locator('[role="complementary"]').count()).toBe(0)

  // Assert count 0 for <aside>
  expect(await page.locator('aside').count()).toBe(0)

  // Assert count 0 for data-testid matching file-tree
  expect(await page.locator('[data-testid*="file-tree"]').count()).toBe(0)

  // Assert count 0 for data-testid matching document-list
  expect(await page.locator('[data-testid*="document-list"]').count()).toBe(0)

  // Assert count 0 for data-testid matching document-switcher
  expect(await page.locator('[data-testid*="document-switcher"]').count()).toBe(0)

  // Assert count 0 for data-testid matching tabs
  expect(await page.locator('[data-testid*="tabs"]').count()).toBe(0)

  // Assert count 0 for data-testid matching chat-panel
  expect(await page.locator('[data-testid*="chat-panel"]').count()).toBe(0)

  // Assert exactly one [data-testid="editor"] surface is present
  expect(await page.locator('[data-testid="editor"]').count()).toBe(1)

  // Assert exactly one role='banner' top bar is present
  expect(await page.locator('[role="banner"]').count()).toBe(1)
}

test('T-FR-3-7: no navigation chrome while a continuation is shown in grey', async ({ page }) => {
  const initialText = 'The cabin sat quiet under the first snow of the season, and'
  const continuationText = ' the woodsmoke hung low over the valley.'

  await page.route('https://openrouter.ai/**', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: frame(continuationText) + 'data: [DONE]\n\n',
    })
  })

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialText)
  await page.waitForTimeout(700)
  await page.waitForSelector('[data-testid="ghost-continuation"]')

  await assertNoNavigationChrome(page)
})

test('T-FR-3-7: no navigation chrome while a tracked-change diff is pending', async ({
  page,
}) => {
  const fullDoc = 'The report was late because the team was busy.'
  const selectedText = 'was late because the team was busy'

  await page.locator('.cm-content').click()
  await page.keyboard.type(fullDoc)

  const startIdx = fullDoc.indexOf(selectedText)
  const endIdx = startIdx + selectedText.length
  await page.evaluate(
    ({ start, end }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      editor.dispatch({ selection: { anchor: start, head: end } })
    },
    { start: startIdx, end: endIdx },
  )

  await mockRevisionResponse(page, {
    reason: 'Better phrasing',
    proposal: 'slipped due to competing team priorities',
  })

  await page.locator('button:has-text("Improve the writing")').click()
  await page.waitForSelector('[data-testid="revision-decoration"]')

  await assertNoNavigationChrome(page)
})

test('T-FR-3-7: No navigation chrome is present after the key gate in all editor states', async ({
  page,
}) => {
  // (a) Fresh editor immediately after load
  await assertNoNavigationChrome(page)

  // (b) After typing mid-paragraph
  await page.locator('.cm-content').click()
  await page.keyboard.type('The shift to remote work was')
  await assertNoNavigationChrome(page)

  // (c) With FR-8 model selector open, after clicking the top bar button named 'GPT-4o mini'
  const modelTrigger = page.locator('[data-testid="model-selector-trigger"]')
  await modelTrigger.click()
  await assertNoNavigationChrome(page)
})

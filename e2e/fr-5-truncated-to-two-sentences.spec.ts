import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { ghostText, mockOpenRouter, snapshot, waitForGhost } from './continuation'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/**
 * The display half of T-FR-5-16. The truncation rule itself is settled by the
 * unit tests in src/core/continuation.truncation.test.ts; what this adds is
 * that the third sentence never reaches the screen, including part-way
 * through a streamed response.
 */
test('T-FR-5-16: a response of more than two sentences never shows its third', async ({ page }) => {
  const initialDoc = 'The map showed a fork in the trail.'
  const firstTwo = ' The trail climbs steeply here. Bring extra water for the ridge.'
  const third = ' You will not regret the view.'

  // Streamed fragment by fragment, the way a real model sends it - a spec
  // that posts the whole response in one frame cannot catch a third sentence
  // that flickers on screen before being cut.
  await mockOpenRouter(page, {
    continuation: [
      ' The trail climbs',
      ' steeply here.',
      ' Bring extra water',
      ' for the ridge.',
      ' You will not regret',
      ' the view.',
    ],
  })

  const seenGhosts: string[] = []

  await page.locator('.cm-content').click()
  await page.keyboard.type(initialDoc)

  // Sample the ghost repeatedly while the response arrives, so a third
  // sentence that appears and is then removed is still caught.
  const sampling = (async () => {
    for (let i = 0; i < 30; i++) {
      const current = await ghostText(page)
      if (current) seenGhosts.push(current)
      await page.waitForTimeout(50)
    }
  })()

  await waitForGhost(page)
  await sampling

  expect(await ghostText(page)).toBe(firstTwo)
  for (const sample of seenGhosts) {
    expect(sample, 'the third sentence must never be shown, even mid-stream').not.toContain(
      'regret the view',
    )
  }

  // And accepting takes only the two sentences that were on offer.
  await page.keyboard.press('Tab')
  const state = await snapshot(page)
  expect(state.doc).toBe(initialDoc + firstTwo)
  expect(state.doc).not.toContain(third.trim())
})

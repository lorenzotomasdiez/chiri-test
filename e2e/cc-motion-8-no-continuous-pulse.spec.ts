import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

/**
 * CC-MOTION.8: nothing in the product loops, breathes, pulses, or animates
 * continuously, with the single narrow exception of the validation spinner
 * while a key check is genuinely in flight (KeyGateModal's `animate-spin`).
 *
 * The revision-in-flight indicator in SelectionActionBar is not that
 * exception - streaming a revision is an arbitrarily long, ordinary
 * operation, not a one-shot key check - so nothing inside the
 * `action-progress` region may carry a continuous/infinite CSS animation
 * while a revision streams. The character count already on screen
 * ("Writing... N characters") is the proof that something is arriving.
 */

function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-CC-MOTION-8-1: no element in the busy revision-progress region animates continuously while streaming', async ({
  page,
}) => {
  await page.locator('.cm-content').click()
  await page.keyboard.type('The report was late because the team was busy.')
  await page.keyboard.press('Meta+a')

  // Hold the response open so the component stays in its busy/streaming
  // state long enough to inspect - a stream still arriving chunk by chunk,
  // not a completed one.
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  await page.route('https://openrouter.ai/**', async (route) => {
    await held
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        frame('reason: Vague cause\n') +
        frame('--') +
        frame('sep') +
        frame('--') +
        frame('\nThe report slipped because the team had competing priorities.') +
        'data: [DONE]\n\n',
    })
  })

  await page.locator('button:has-text("Improve the writing")').click()

  const progress = page.locator('[data-testid="action-progress"]')
  await expect(progress).toBeVisible()

  // Every element inside the busy region - the container and any children -
  // must not carry an infinite/continuous CSS animation while busy is true.
  const offenders = await progress.evaluate((el) => {
    const nodes = [el, ...el.querySelectorAll('*')]
    return nodes
      .filter((node) => {
        const style = getComputedStyle(node)
        return (
          style.animationName !== 'none' &&
          style.animationIterationCount === 'infinite'
        )
      })
      .map((node) => node.outerHTML)
  })
  expect(offenders).toEqual([])

  release()
})

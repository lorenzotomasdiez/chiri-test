import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test('T-CC-SPLASH-1: the launch screen is the paper background, the mark, and nothing else (CC-SPLASH.1, CC-SPLASH.3, CC-SPLASH.4, CC-PRE.1, CC-PRE.2)', async ({
  page,
}) => {
  await seedValidatedKey(page)
  // Below the md breakpoint, where CC-SPLASH.2's base 192px applies.
  await page.setViewportSize({ width: 700, height: 800 })
  await page.goto('/')

  const splash = page.getByTestId('launch-splash')
  await expect(splash).toBeVisible()

  // CC-PRE.1: no top bar and no document column behind it. Read in a single
  // evaluate so all three facts describe the same instant - the launch state
  // is deliberately short-lived, and separate awaits would let the dwell
  // elapse between them and report on two different screens.
  const duringLaunch = await page.evaluate(() => ({
    splash: !!document.querySelector('[data-testid="launch-splash"]'),
    banner: document.querySelectorAll('[role="banner"]').length,
    editor: document.querySelectorAll('.cm-content').length,
  }))
  expect(duringLaunch).toEqual({ splash: true, banner: 0, editor: 0 })

  // CC-SPLASH.3: no product name, tagline, spinner, progress bar, or version
  // string. The screen carries no text at all.
  expect((await splash.textContent())?.trim()).toBe('')

  // CC-SPLASH.1 / CC-PRE.2: fills the window on the paper colour.
  const box = await splash.boundingBox()
  const viewport = page.viewportSize()!
  expect(box!.width).toBe(viewport.width)
  expect(box!.height).toBe(viewport.height)
  const styles = await splash.evaluate((el) => {
    const s = window.getComputedStyle(el)
    return { bg: s.backgroundColor, border: s.borderWidth, overflow: s.overflow, pointer: s.pointerEvents }
  })
  expect(styles.bg).toBe('rgb(253, 248, 248)')
  // CC-SPLASH.4: no inset hairline frame around the window.
  expect(styles.border).toBe('0px')
  // CC-PRE.2: prevents scrolling.
  expect(styles.overflow).toBe('hidden')
  // CC-SPLASH.5 / AC-2.4: entirely non-interactive.
  expect(styles.pointer).toBe('none')

  // CC-SPLASH.2: the mark is square, and 192px at this viewport. Measured as
  // layout size, not boundingBox: CC-MOTION.1 scales the mark from 0.98, and a
  // boundingBox taken mid-animation reports 0.98 of the real box.
  const mark = await page
    .getByTestId('launch-mark')
    .evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
  expect(mark.w).toBe(mark.h)
  expect(mark.w).toBe(192)
})

test('T-CC-SPLASH-2: the mark steps up to 256px at larger viewports (CC-SPLASH.2)', async ({
  page,
}) => {
  await seedValidatedKey(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const mark = await page
    .getByTestId('launch-mark')
    .evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }))
  expect(mark.w).toBe(256)
  expect(mark.h).toBe(256)
})

test('T-CC-SPLASH-3: clicks and keystrokes on the launch screen dismiss nothing and lose no input (AC-2.4, CC-SPLASH.5)', async ({
  page,
}) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  await page.mouse.click(400, 300)
  await page.keyboard.type('hello')

  // Still on the launch screen: no dismissal affordance exists, so neither the
  // click nor the typing may skip ahead.
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // ...and once the dwell elapses, the typing that happened during it has not
  // leaked into the document.
  await expect(page.locator('.cm-content')).toBeVisible()
  const doc = await page.evaluate(
    () => (window as unknown as { __editor?: { state: { doc: { toString(): string } } } }).__editor?.state.doc.toString(),
  )
  expect(doc).toBe('')
})

test('T-CC-SPLASH-4: the launch state ends in exactly one transition, to the editor when a key is stored (AC-2.2, AC-2.3, CC-MOTION.2)', async ({
  page,
}) => {
  await seedValidatedKey(page)
  await page.goto('/')

  await expect(page.getByTestId('launch-splash')).toBeVisible()
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)
  // AC-2.3: a stored valid key means the editor is next, not the gate.
  await expect(page.getByRole('banner')).toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()

  // CC-MOTION.2: it does not come back - one transition, no second one.
  await page.waitForTimeout(600)
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)
})

test('T-CC-SPLASH-5: with no stored key the launch screen hands off to the key gate (AC-2.3)', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByTestId('launch-splash')).toBeVisible()
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()
  await expect(page.getByRole('banner')).toHaveCount(0)
})

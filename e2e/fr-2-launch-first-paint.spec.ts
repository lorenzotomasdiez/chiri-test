import { test, expect } from '@playwright/test'

test('T-FR-2-1: The logo is the first thing on screen on a cold load (AC-2.1)', async ({
  page,
}) => {
  // Fresh browser context with no chiri-settings in localStorage. Do not seed
  // a key so the app boots into the launch state with no pre-existing state.
  await page.goto('/')

  // Snapshot state in one evaluate so all facts describe the same instant.
  // The launch state is 1200ms long by design (CC-MOTION.1 / AC-2.2), and
  // separate awaits would let the dwell elapse between them, reporting on
  // different screens. Read launch-splash presence, key-gate-modal count,
  // banner count, and editor count all at once.
  const atFirstPaint = await page.evaluate(() => ({
    splash: !!document.querySelector('[data-testid="launch-splash"]'),
    keyGate: document.querySelectorAll('[data-testid="key-gate-modal"]').length,
    banner: document.querySelectorAll('[role="banner"]').length,
    editor: document.querySelectorAll('.cm-content').length,
  }))

  expect(atFirstPaint).toEqual({ splash: true, keyGate: 0, banner: 0, editor: 0 })
})

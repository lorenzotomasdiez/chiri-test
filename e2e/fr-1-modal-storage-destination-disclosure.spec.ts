import { test, expect } from '@playwright/test'

test('T-FR-1-2: the modal states where the key is stored and sent before submission (AC-1.2)', async ({
  page,
}) => {
  // No stored key in localStorage, so the gate blocks on first launch.
  await page.goto('/')
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)

  const modal = page.getByTestId('key-gate-modal')
  await expect(modal).toBeVisible()

  // Read the modal's content before submitting anything.
  const modalText = await modal.innerText()

  // AC-1.2: the key is stored on this device...
  expect(modalText).toMatch(/stored only on this (machine|device)/i)
  // ...and sent only to OpenRouter.
  expect(modalText).toMatch(/sent only to OpenRouter/i)

  // Nothing has been typed or submitted - this is purely a static-content check.
  await expect(page.getByLabel('OpenRouter API key')).toHaveValue('')
})

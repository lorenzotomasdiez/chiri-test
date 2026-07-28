import { test, expect } from '@playwright/test'

test('T-FR-2-5: Readiness without a stored valid key transitions to the key gate (AC-2.3)', async ({
  page,
}) => {
  // Do NOT call seedValidatedKey - we want no stored key in localStorage
  // This ensures keyGateState will be 'blocked', not 'unblocked'
  await page.goto('/')

  // Launch state should initially show the splash
  await expect(page.getByTestId('launch-splash')).toBeVisible()

  // Then the launch state completes and the splash disappears
  await expect(page.getByTestId('launch-splash')).toHaveCount(0)

  // Key gate modal should appear instead (AC-2.3: gate is next when no key stored)
  await expect(page.getByTestId('key-gate-modal')).toBeVisible()

  // No top bar should be visible - it only exists when unblocked (AC-2.3, CC-NAV.12)
  await expect(page.getByRole('banner')).toHaveCount(0)

  // Editor content should not be editable when the gate is displayed (AC-2.4)
  const editableState = await page.evaluate(() =>
    document.querySelector('.cm-content')?.getAttribute('contenteditable'),
  )
  expect(editableState).not.toBe('true')
})

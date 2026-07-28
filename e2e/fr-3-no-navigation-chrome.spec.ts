import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/**
 * The plan lists five application states for this scenario. Three are
 * reachable today; the two below need fixtures from FR-5 (ghost text) and
 * FR-6 (a pending revision diff), neither of which is implemented. They are
 * declared here rather than omitted so the run reports this scenario as
 * partially covered instead of as a clean pass over five states. Remove the
 * fixme and fold each into assertNoNavigationChrome once its suite lands.
 */
test.fixme(
  'T-FR-3-7: no navigation chrome while a continuation is shown in grey (needs FR-5)',
  async () => {},
)

test.fixme(
  'T-FR-3-7: no navigation chrome while a tracked-change diff is pending (needs FR-6)',
  async () => {},
)

test('T-FR-3-7: No navigation chrome is present after the key gate in all editor states', async ({
  page,
}) => {
  // Helper function to assert no navigation chrome is present
  async function assertNoNavigationChrome() {
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

  // (a) Fresh editor immediately after load
  await assertNoNavigationChrome()

  // (b) After typing mid-paragraph
  await page.locator('.cm-content').click()
  await page.keyboard.type('The shift to remote work was')
  await assertNoNavigationChrome()

  // (c) With FR-8 model selector open, after clicking the top bar button named 'GPT-4o mini'
  const modelTrigger = page.locator('[data-testid="model-selector-trigger"]')
  await modelTrigger.click()
  await assertNoNavigationChrome()
})

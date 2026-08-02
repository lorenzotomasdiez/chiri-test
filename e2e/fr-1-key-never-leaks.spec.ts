import { test, expect } from '@playwright/test'

/**
 * T-FR-1-15 (AC-1.11): the key reaches only OpenRouter, carried solely by the
 * Authorization header, and never appears anywhere else - not the request
 * URL, not a console message, not a page error, not the rejection banner's
 * text. Nothing in src/core or src/net ever logs the key today, so this is a
 * coverage gap rather than a regression test: it exists to catch a future
 * `console.error(err)` around the probe call, which would serialize the
 * whole request (Authorization header included) the moment someone adds one.
 */

const CANARY_KEY = 'sk-or-v1-leak-canary-9182736450'

test('T-FR-1-15: the key never appears in the URL, console, or error text', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()

  const consoleMessages: string[] = []
  page.on('console', (msg) => consoleMessages.push(msg.text()))
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  const interceptedRequests: { url: string; headers: Record<string, string>; postData: string }[] =
    []
  await page.route('https://openrouter.ai/**', async (route) => {
    interceptedRequests.push({
      url: route.request().url(),
      headers: await route.request().allHeaders(),
      postData: route.request().postData() ?? '',
    })
    // A 401 exercises the error-message path (AC-1.5), the likelier place a
    // careless `console.error(err)` or "here is what we sent" debug string
    // would embed the raw key.
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: { message: 'Invalid API key' } }),
    })
  })

  await page.waitForSelector('input[type="password"]', { timeout: 5000 })
  await page.locator('input[type="password"]').fill(CANARY_KEY)
  await page.getByRole('button', { name: /connect|submit|save|continue/i }).click()

  await expect(page.locator('[data-testid="key-gate-error"]')).toBeVisible({ timeout: 10_000 })

  expect(interceptedRequests).toHaveLength(1)
  const request = interceptedRequests[0]

  // The key travels exactly once, in the header the app puts it in on
  // purpose - never folded into the URL or the request body.
  expect(request.url).not.toContain(CANARY_KEY)
  expect(request.postData).not.toContain(CANARY_KEY)
  expect(request.headers.authorization).toBe(`Bearer ${CANARY_KEY}`)

  // The rejection message is the generic, canned line - never an echo of
  // the key or the raw provider error.
  await expect(page.locator('[data-testid="key-gate-error"]')).toHaveText(
    'That key was rejected by OpenRouter.',
  )

  for (const text of [...consoleMessages, ...pageErrors]) {
    expect(text).not.toContain(CANARY_KEY)
  }
})

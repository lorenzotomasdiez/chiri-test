/**
 * T-FR-12-1, T-FR-12-5, T-FR-12-9, T-FR-12-10: the silent half of FR-12.
 *
 * The user never asked for a continuation, so nothing about one failing is
 * theirs to deal with. Every failure in this class resolves to the same
 * observable state as no failure at all - no message, no ghost, no lost
 * keystroke - and the app recovers on its own when the condition clears.
 */

import { test, expect, type Page, type Route } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { fulfillFailure, type FailureVariant } from './openrouter-mock'
import { docText, ghostText, PAST_SETTLE_MS, waitForGhost } from './continuation'

/** The first words of the continuation system message in src/core/prompt.ts. */
const CONTINUATION_MARKER = 'Continue the text with at most two sentences'

function isContinuation(route: Route): boolean {
  return (route.request().postData() ?? '').includes(CONTINUATION_MARKER)
}

const PARAGRAPH = 'The deployment pipeline now runs on every'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

/** Types `text` in bursts, pausing past the settle window between them. */
async function typeWithPauses(page: Page, text: string, bursts = 4) {
  const size = Math.ceil(text.length / bursts)
  for (let i = 0; i < text.length; i += size) {
    await page.keyboard.type(text.slice(i, i + size))
    await page.waitForTimeout(PAST_SETTLE_MS)
  }
}

/** Every failure that must leave the interface completely quiet. */
const SILENT_VARIANTS: Array<{ name: string; variant: FailureVariant }> = [
  { name: 'T-FR-12-1: network unreachable', variant: 'offline' },
  { name: 'T-FR-12-9: insufficient credit', variant: 'credit' },
  { name: 'T-FR-12-10: empty body', variant: 'empty-body' },
  // Not the revision suite's `malformed-body`: that shape is prose with no
  // sentinel, which is a perfectly well-formed continuation. A continuation is
  // malformed only when the body is not the wire format at all.
  { name: 'T-FR-12-10: malformed body', variant: 'not-sse' },
  { name: 'T-FR-12-10: stream cut mid-response', variant: 'stream-cut' },
]

for (const { name, variant } of SILENT_VARIANTS) {
  test(`${name} shows no message, no continuation, and loses no keystroke`, async ({ page }) => {
    let continuationCount = 0
    await page.route('https://openrouter.ai/**', async (route) => {
      if (!isContinuation(route)) return route.fulfill({ status: 200, body: '{}' })
      continuationCount += 1
      return fulfillFailure(route, variant)
    })

    await page.locator('.cm-content').click()
    await typeWithPauses(page, PARAGRAPH)

    // The requests really were issued and really did fail - without this the
    // assertions below would pass just as well against a build that never
    // asked for a continuation at all.
    expect(continuationCount).toBeGreaterThan(0)

    // Nothing anywhere in the interface
    await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
    await expect(page.locator('[role="alert"]')).toHaveCount(0)
    // No grey continuation, at any point - including no half-arrived one
    await expect(page.locator('[data-testid="ghost-text"]')).toHaveCount(0)
    expect(await ghostText(page)).toBeNull()
    // And every character is exactly where the user typed it
    expect(await docText(page)).toBe(PARAGRAPH)
  })
}

test('T-FR-12-5: A rate-limited continuation resumes on its own once the condition clears', async ({
  page,
}) => {
  // Given the provider is rate limiting continuation requests
  let rateLimited = true
  let continuationCount = 0

  await page.route('https://openrouter.ai/**', async (route) => {
    if (!isContinuation(route)) return route.fulfill({ status: 200, body: '{}' })
    continuationCount += 1
    if (rateLimited) return fulfillFailure(route, 'rate-limit')
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body:
        `data: ${JSON.stringify({ choices: [{ delta: { content: ' commit to main.' } }] })}\n\n` +
        'data: [DONE]\n\n',
    })
  })

  await page.locator('.cm-content').click()

  // When the user pauses twice while the limit is in effect
  await page.keyboard.type('The deployment pipeline')
  await page.waitForTimeout(PAST_SETTLE_MS)
  await page.keyboard.type(' now runs on every')
  await page.waitForTimeout(PAST_SETTLE_MS)

  // Then nothing appeared and nothing was said, for either attempt
  expect(continuationCount).toBeGreaterThanOrEqual(2)
  await expect(page.locator('[data-testid="failure-message"]')).toHaveCount(0)
  expect(await ghostText(page)).toBeNull()

  // When the rate limit clears and the user pauses again
  rateLimited = false
  await page.keyboard.type(' single')

  // Then a continuation appears with no reload and no recovery action - the
  // scheduler simply asks again on the next pause, so there is no latched
  // failure state to clear.
  await waitForGhost(page)
  expect(await ghostText(page)).toBeTruthy()
})

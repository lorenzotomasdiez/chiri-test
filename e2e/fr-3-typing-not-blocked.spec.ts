import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: import('@playwright/test').Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/**
 * How long the continuous-typing run lasts. The plan's boundary table names
 * 60 seconds, which at three browsers is three minutes of wall clock for one
 * scenario, so the default here is shorter and the full-duration run is
 * opt-in: FR3_TYPING_MS=60000 npx playwright test fr-3-typing-not-blocked
 *
 * The shortened default is a real gap against the plan, not a substitute for
 * it. What it does still prove is the functional half - no keystroke dropped,
 * reordered, or duplicated with a request outstanding - which is the half the
 * plan calls automatable. The 50ms p95 latency bar (NFR-2) is the manual half
 * and is not asserted here at any duration.
 */
const TYPING_DURATION_MS = Number(process.env.FR3_TYPING_MS ?? 6000)

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
})

test('T-FR-3-8: Typing is never blocked, dropped, reordered, or duplicated while an AI request is in flight', async ({
  page,
}) => {
  // Hold any OpenRouter call open for the whole test: the handler neither
  // fulfills nor aborts, so the request stays genuinely in flight rather
  // than resolving the moment it is made.
  await page.route('https://openrouter.ai/**', async () => {
    // intentionally never settled
  })

  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // FR-5 is what will dispatch this for real. Until it exists, nothing in
  // the app issues an OpenRouter request, so the scenario's precondition has
  // to be established directly - otherwise this spec types into an idle app
  // and proves only that typing works. Re-point this at the FR-5 dispatch
  // once that lands; the assertions below do not change.
  const requestIssued = page.waitForRequest('https://openrouter.ai/**')
  await page.evaluate(() => {
    const w = window as unknown as { __inflightSettled?: boolean }
    w.__inflightSettled = false
    void fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      body: '{}',
    }).finally(() => {
      w.__inflightSettled = true
    })
  })
  await requestIssued

  const inFlight = async () =>
    !(await page.evaluate(
      () => (window as unknown as { __inflightSettled: boolean }).__inflightSettled,
    ))
  expect(await inFlight()).toBe(true)

  await page.locator('.cm-content').click()

  // A non-repeating sequence, so a reordering or a duplicated run shows up
  // as a mismatch rather than hiding inside identical neighbours.
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let expected = ''
  const started = Date.now()
  let i = 0
  while (Date.now() - started < TYPING_DURATION_MS) {
    const ch = alphabet[i % alphabet.length]
    await page.keyboard.type(ch, { delay: 5 })
    expected += ch
    i++
  }

  // Same characters, same order, same count - nothing dropped, reordered,
  // or duplicated across the whole run.
  expect(await docText(page)).toBe(expected)

  // The request never settled, so every keystroke above landed while it was
  // outstanding rather than after it quietly completed.
  expect(await inFlight()).toBe(true)

  // The surface is still accepting input at the end, not merely intact.
  await page.keyboard.type('!')
  expect(await docText(page)).toBe(expected + '!')
})

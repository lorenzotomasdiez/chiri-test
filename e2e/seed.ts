import type { Page } from '@playwright/test'

/**
 * Puts a validated key on file before the app boots, so the FR-1 gate is
 * already passed and the shell exists.
 *
 * Every spec that exercises the top bar, the document column, or the editor
 * needs this: per AC-1.1 there is no editor before a key is on file, and per
 * CC-NAV.12 there is no top bar either. The gate is a genuine precondition of
 * the shell, not an obstacle to route around, so these specs state it rather
 * than assuming a shell that only exists afterwards.
 *
 * The key never leaves the browser - no spec here makes a real OpenRouter
 * request. A stored key is trusted at boot without re-validation (AC-1.8), so
 * no network interception is needed to satisfy the precondition.
 */
export const SEEDED_API_KEY = 'sk-or-v1-e2e-seeded-key'

/** The single localStorage entry the app persists (src/storage/settings.ts). */
const STORAGE_KEY = 'chiri-settings'

/**
 * Turns FR-5's continuation off before boot, for specs that script a sequence
 * of provider responses.
 *
 * Continuation and revision share one endpoint, so a background continuation
 * request can consume a response scripted for the revision under test and
 * make a passing spec a coincidence. Turning it off is not routing around
 * FR-5 - it is stating that the scenario is about a requested failure, and
 * removing the only source of unrequested requests that could be mistaken for
 * one.
 */
export async function seedContinuationDisabled(page: Page) {
  await page.addInitScript((storageKey) => {
    let existing: Record<string, unknown> = {}
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') existing = parsed as Record<string, unknown>
      }
    } catch {
      existing = {}
    }
    localStorage.setItem(storageKey, JSON.stringify({ ...existing, continuationEnabled: false }))
  }, STORAGE_KEY)
}

export async function seedValidatedKey(page: Page) {
  // The seeded key is not a real one, so any request that actually reaches
  // OpenRouter comes back 401 - and FR-12 answers a rejected key by raising
  // the key gate over the editor (AC-12.4), which would break any spec that
  // merely types. Typing is enough to trigger it: FR-5 issues a continuation
  // request on every settled pause.
  //
  // So the claim above - that no spec here makes a real OpenRouter request -
  // is enforced rather than assumed. Registered first, so a spec's own route
  // still takes precedence: Playwright matches the most recently added handler.
  await page.route('https://openrouter.ai/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )

  await page.addInitScript(
    ([storageKey, apiKey]) => {
      // Merge rather than overwrite. This init script re-runs on every
      // navigation, including page.reload(), so writing `{ apiKey }` whole
      // would erase every other persisted field - model, continuationEnabled -
      // before the app boots and reads them back. A spec that reloads to prove
      // something persisted would then be proving only that this helper
      // rewrote it.
      let existing: Record<string, unknown> = {}
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (parsed && typeof parsed === 'object') existing = parsed as Record<string, unknown>
        }
      } catch {
        existing = {}
      }
      localStorage.setItem(storageKey, JSON.stringify({ ...existing, apiKey }))
    },
    [STORAGE_KEY, SEEDED_API_KEY] as const,
  )
}

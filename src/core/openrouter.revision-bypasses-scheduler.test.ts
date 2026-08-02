import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler } from './schedule'
import type { Transport } from './schedule'
import type { RequestBody } from './prompt'
import { requestRevisionCompletion } from '../net/openrouter'

/**
 * T-FR-10-10: the PRD says revision and refinement requests are "not
 * debounced or dropped" - full exemption from every FR-10 mechanism, per
 * fr-10.md's own stated interpretation. The risk the test plan names by name
 * is a token bucket wired as a single limiter shared across continuation and
 * revision traffic, which would be easy to get wrong since debounce-only
 * exemption is the more obvious partial implementation.
 *
 * `requestRevisionCompletion` never references a `Scheduler` at all - this
 * proves that architecturally, not just by inspection: a continuation
 * scheduler whose per-minute ceiling is already exhausted has no way to
 * affect a concurrent revision request, because nothing connects them.
 */

function stream(fragments: string[]): string {
  const frames = fragments.map(
    (content) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`,
  )
  return `${frames.join('')}data: [DONE]\n\n`
}

const REVISION_BODY: RequestBody = {
  model: 'test-model',
  max_tokens: 256,
  temperature: 0.7,
  stream: true,
  messages: [{ role: 'user', content: 'Make it shorter.' }],
}

describe('revision requests bypass the continuation scheduler entirely', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('still completes a revision while the continuation per-minute ceiling is exhausted', async () => {
    // Exhaust a one-per-minute continuation ceiling first (AC-10.4).
    const continuationTransport: Transport = () => new Promise(() => {})
    const dispatched: unknown[] = []
    const scheduler = new Scheduler({
      settleMs: 0,
      maxPerMinute: 1,
      transport: (req, signal) => {
        dispatched.push(req)
        return continuationTransport(req, signal)
      },
    })

    scheduler.onInput({ docVersion: 1, cursor: 5 })
    await vi.advanceTimersByTimeAsync(0)
    scheduler.onCaretMove()
    scheduler.onInput({ docVersion: 2, cursor: 6 })
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatched).toHaveLength(1) // second continuation silently dropped

    // A revision fires while that ceiling sits exhausted - nothing shared
    // between the two, so it is not blocked, debounced, or delayed by it.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: null,
      text: async () => stream(['reason: Trims filler.\n', '--sep--\n', 'the team moved fast']),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const completion = await requestRevisionCompletion(REVISION_BODY, 'test-key')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(completion).toContain('the team moved fast')

    // The scheduler's own ceiling is untouched by the revision call.
    scheduler.onInput({ docVersion: 3, cursor: 7 })
    await vi.advanceTimersByTimeAsync(0)
    expect(dispatched).toHaveLength(1)
  })
})

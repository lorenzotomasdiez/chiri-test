/**
 * T-FR-12-1 and T-FR-12-18 at the scheduler, which is where the continuation
 * class's silence is decided.
 *
 * The scheduler is pure with the clock and transport injected, so a network
 * that is down for a whole session, and a request the user typed past, are
 * both reproducible with nothing running.
 */

import { describe, expect, it, vi } from 'vitest'
import { Scheduler } from './schedule'

/** Drives the injected clock and the injected setTimeout together. */
function fakeClock() {
  let now = 0
  const pending: Array<{ at: number; fn: () => void; handle: number }> = []
  let nextHandle = 1

  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => {
      const handle = nextHandle++
      pending.push({ at: now + ms, fn, handle })
      return handle as unknown as ReturnType<typeof setTimeout>
    },
    clearTimeout: (handle: ReturnType<typeof setTimeout>) => {
      const index = pending.findIndex((p) => p.handle === (handle as unknown as number))
      if (index !== -1) pending.splice(index, 1)
    },
    advance(ms: number) {
      now += ms
      const due = pending.filter((p) => p.at <= now)
      for (const entry of due) pending.splice(pending.indexOf(entry), 1)
      for (const entry of due) entry.fn()
    },
  }
}

describe('continuation failures are silent (AC-12.1)', () => {
  it('shows nothing when every request fails with the network unreachable', async () => {
    const clock = fakeClock()
    const onResult = vi.fn()
    const onChunk = vi.fn()

    const scheduler = new Scheduler({
      settleMs: 600,
      transport: () => Promise.reject(new TypeError('Failed to fetch')),
      onResult,
      onChunk,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    })

    // Sixty seconds of writing, pausing long enough to trigger a request each
    // time - the shape of T-FR-12-1's "keeps typing for 60 seconds total".
    for (let i = 0; i < 60; i++) {
      scheduler.onInput({ docVersion: i, cursor: i })
      clock.advance(1000)
      await Promise.resolve()
      await Promise.resolve()
    }

    expect(onResult).not.toHaveBeenCalled()
    expect(onChunk).not.toHaveBeenCalled()
  })

  it('still reports the failure to onFailure, so a rejected key can reach the gate (AC-12.4)', async () => {
    const clock = fakeClock()
    const onFailure = vi.fn()

    const scheduler = new Scheduler({
      settleMs: 600,
      transport: () => Promise.reject({ status: 401 }),
      onFailure,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    clock.advance(600)
    await Promise.resolve()
    await Promise.resolve()

    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure.mock.calls[0][0]).toEqual({ status: 401 })
  })
})

describe('a superseded request is not a failure (T-FR-12-18)', () => {
  it('reports nothing when the user types again before the request resolves', async () => {
    const clock = fakeClock()
    const onFailure = vi.fn()
    const onResult = vi.fn()

    // A transport that rejects the way `fetch` does for an aborted request -
    // the case that is indistinguishable from a real network failure unless
    // cancellation is checked first.
    const transport = (_req: unknown, signal: AbortSignal) =>
      new Promise<AsyncIterable<string>>((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(new DOMException('The operation was aborted.', 'AbortError')),
        )
      })

    const scheduler = new Scheduler({
      settleMs: 600,
      transport,
      onFailure,
      onResult,
      now: clock.now,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
    })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    clock.advance(600)
    await Promise.resolve()

    // The user types again while that request is still in flight.
    scheduler.onInput({ docVersion: 2, cursor: 11 })
    await Promise.resolve()
    await Promise.resolve()

    expect(onFailure).not.toHaveBeenCalled()
    expect(onResult).not.toHaveBeenCalled()
  })
})

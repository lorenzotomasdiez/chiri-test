import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler } from './schedule'
import type { Transport } from './schedule'

/** A transport that never resolves, so a request stays in flight until aborted. */
function neverResolving() {
  const signals: AbortSignal[] = []
  const transport: Transport = (_req, signal) => {
    signals.push(signal)
    return new Promise(() => {}) as ReturnType<Transport>
  }
  return { transport, signals }
}

describe('Scheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // The first failing test named in testing.md. This is AC-10.2.
  it('cancels an in-flight continuation when input resumes and never has two in flight', () => {
    const { transport, signals } = neverResolving()
    const scheduler = new Scheduler({ settleMs: 600, transport })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(1)

    scheduler.onInput({ docVersion: 2, cursor: 11 })
    // Cancellation is immediate, not deferred to when the new request fires:
    // a suggestion for a position the user has left is worse than none.
    expect(signals[0].aborted).toBe(true)
    expect(signals).toHaveLength(1)

    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    expect(signals[1].aborted).toBe(false)
  })

  // AC-10.1: typing continuously never reaches the settle threshold.
  it('issues no request while input keeps arriving inside the settle window', () => {
    const { transport, signals } = neverResolving()
    const scheduler = new Scheduler({ settleMs: 600, transport })

    for (let i = 0; i < 100; i++) {
      scheduler.onInput({ docVersion: i, cursor: i })
      vi.advanceTimersByTime(590)
    }
    expect(signals).toHaveLength(0)

    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(1)
  })

  // AC-10.4: the per-minute ceiling drops requests silently.
  it('stops issuing requests once the per-minute ceiling is reached, without erroring', () => {
    const { transport, signals } = neverResolving()
    const scheduler = new Scheduler({ settleMs: 600, maxPerMinute: 3, transport })

    for (let i = 0; i < 10; i++) {
      scheduler.onInput({ docVersion: i, cursor: i })
      vi.advanceTimersByTime(600)
    }
    expect(signals).toHaveLength(3)

    // The bucket refills on a sliding minute.
    vi.advanceTimersByTime(60_000)
    scheduler.onInput({ docVersion: 99, cursor: 99 })
    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(4)
  })

  // AC-10.3 / AC-5.5: a result for a position the caret has left is discarded.
  // The caret moves without an edit, so nothing new is scheduled - which is
  // what isolates the staleness guard from the cancel-on-input path above.
  it('discards a result whose caret generation is stale', async () => {
    const delivered: string[] = []
    const transport: Transport = async function* () {
      await new Promise((resolve) => setTimeout(resolve, 100))
      yield 'the rest of the sentence'
    }
    const scheduler = new Scheduler({
      settleMs: 600,
      transport,
      onResult: (text) => delivered.push(text),
    })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    await vi.advanceTimersByTimeAsync(600)
    scheduler.onCaretMove()
    await vi.runAllTimersAsync()

    expect(delivered).toHaveLength(0)
  })

  it('delivers a result that is still current when it arrives', async () => {
    const delivered: string[] = []
    const transport: Transport = async function* () {
      yield ' the rest'
      yield ' of the sentence'
    }
    const scheduler = new Scheduler({
      settleMs: 600,
      transport,
      onResult: (text) => delivered.push(text),
    })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    await vi.runAllTimersAsync()

    expect(delivered).toEqual([' the rest of the sentence'])
  })

  it('is off when disabled and issues nothing', () => {
    const { transport, signals } = neverResolving()
    const scheduler = new Scheduler({ settleMs: 600, transport, enabled: false })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    vi.advanceTimersByTime(60_000)
    expect(signals).toHaveLength(0)
  })
})

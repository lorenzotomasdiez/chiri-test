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

// T-FR-10-5: rapid caret movement without typing still cancels cleanly.
describe('Scheduler - rapid caret movement', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cancels the in-flight request on each of three quick successive caret moves, never having two in flight', () => {
    const { transport, signals } = neverResolving()
    const scheduler = new Scheduler({ settleMs: 600, transport })

    // A request goes in flight for the first position.
    scheduler.onInput({ docVersion: 1, cursor: 10 })
    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)

    // Three clicks in quick succession, each less than 300ms apart, no typing.
    scheduler.onCaretMove()
    vi.advanceTimersByTime(100)
    expect(signals[0].aborted).toBe(true)
    expect(signals).toHaveLength(1)

    scheduler.onCaretMove()
    vi.advanceTimersByTime(100)
    expect(signals).toHaveLength(1)

    scheduler.onCaretMove()
    vi.advanceTimersByTime(100)
    expect(signals).toHaveLength(1)

    // None of the three caret moves themselves issued a new request: a caret
    // move alone never schedules one, only input does (per onCaretMove's
    // contract of invalidating without restarting the settle window).
    expect(signals).toHaveLength(1)

    // The final resting position only gets its own request once it has
    // settled for the full threshold, driven by a fresh input signal.
    scheduler.onInput({ docVersion: 1, cursor: 42 })
    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(2)
    expect(signals[1].aborted).toBe(false)
  })
})

/**
 * T-FR-10-9 (the settle-threshold boundary) and the ceiling-drop half of
 * T-FR-10-11 (a request dropped for being over the per-minute ceiling never
 * reports through onFailure). The cancelled half of T-FR-10-11 is already
 * covered by "a superseded request is not a failure" in
 * schedule.continuation-failure-silent.test.ts; this file is the ceiling
 * counterpart, so both ways a continuation can go silent are each pinned
 * down on their own.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler } from './schedule'
import type { Transport } from './schedule'

function neverResolving() {
  const signals: AbortSignal[] = []
  const transport: Transport = (_req, signal) => {
    signals.push(signal)
    return new Promise(() => {}) as ReturnType<Transport>
  }
  return { transport, signals }
}

describe('T-FR-10-9: the settle-threshold boundary', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not fire just below the threshold, but does fire at and just above it', () => {
    const { transport, signals } = neverResolving()
    const scheduler = new Scheduler({ settleMs: 600, transport })

    // Just below threshold: input resumes before the settle window closes,
    // so the pending settle is cancelled and nothing is dispatched for it.
    scheduler.onInput({ docVersion: 1, cursor: 1 })
    vi.advanceTimersByTime(550)
    expect(signals).toHaveLength(0)
    scheduler.onInput({ docVersion: 2, cursor: 2 })
    vi.advanceTimersByTime(550)
    expect(signals).toHaveLength(0)

    // At the threshold: exactly settleMs of silence fires the request.
    vi.advanceTimersByTime(50)
    expect(signals).toHaveLength(1)

    // Just above the threshold: settling further past the mark still fires
    // exactly once for the pause, not again.
    scheduler.onInput({ docVersion: 3, cursor: 3 })
    vi.advanceTimersByTime(650)
    expect(signals).toHaveLength(2)
  })
})

describe('T-FR-10-11: a ceiling-dropped continuation never surfaces as a failure', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reports nothing through onFailure or onResult when the per-minute ceiling blocks a request', () => {
    const { transport, signals } = neverResolving()
    const onFailure = vi.fn()
    const onResult = vi.fn()
    const scheduler = new Scheduler({
      settleMs: 600,
      maxPerMinute: 1,
      transport,
      onFailure,
      onResult,
    })

    scheduler.onInput({ docVersion: 1, cursor: 1 })
    vi.advanceTimersByTime(600)
    expect(signals).toHaveLength(1)

    // The ceiling is already spent, so this pause is dropped before the
    // transport is ever called - no request, no error, no result.
    scheduler.onInput({ docVersion: 2, cursor: 2 })
    vi.advanceTimersByTime(600)

    expect(signals).toHaveLength(1)
    expect(onFailure).not.toHaveBeenCalled()
    expect(onResult).not.toHaveBeenCalled()
  })
})

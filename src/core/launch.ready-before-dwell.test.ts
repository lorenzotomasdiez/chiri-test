import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Launch } from './launch'

describe('Launch state machine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // AC-2.2: ready fires before the dwell. The launch state is held for the full
  // minimum dwell duration even if the app signals readiness early. The state
  // ends at max(dwellDeadline, readyTime) and completes exactly once.
  it('T-FR-2-2: The logo is held for the full minimum dwell when the app is ready early (AC-2.2)', () => {
    const completionSpy = vi.fn()
    const launch = new Launch({
      minDwellMs: 1200,
      now: () => Date.now(),
      setTimeout: vi.fn(globalThis.setTimeout),
      onComplete: completionSpy,
    })

    // At t=120ms (one tenth of the dwell), the app signals readiness
    vi.advanceTimersByTime(120)
    launch.onReady()

    // AC-2.2: launch state is still active at t=120, before dwell expires
    expect(launch.isActive()).toBe(true)
    expect(completionSpy).not.toHaveBeenCalled()

    // AC-2.2: launch state is still active at t=1199, still before dwell expires
    vi.advanceTimersByTime(1079)
    expect(launch.isActive()).toBe(true)
    expect(completionSpy).not.toHaveBeenCalled()

    // AC-2.2: launch completes exactly once at t=1200 when dwell minimum expires
    vi.advanceTimersByTime(1)
    expect(completionSpy).toHaveBeenCalledTimes(1)
    expect(launch.isActive()).toBe(false)

    // AC-2.2: completion never fires again (exactly once, ever)
    vi.advanceTimersByTime(5000)
    expect(completionSpy).toHaveBeenCalledTimes(1)
  })
})

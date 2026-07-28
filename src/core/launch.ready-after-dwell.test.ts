import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Launch } from './launch'

describe('Launch state machine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // AC-2.2: the launch state is not artificially extended if readiness arrives
  // after the dwell has passed. The state ends at max(dwellDeadline, readyTime).
  it('T-FR-2-4: A slow-to-ready app is not held on the logo any longer than necessary', () => {
    const completionSpy = vi.fn()
    const launch = new Launch({
      minDwellMs: 1200,
      now: () => Date.now(),
      setTimeout: vi.fn(globalThis.setTimeout),
      onComplete: completionSpy,
    })

    // At t=1200, the dwell deadline has passed, but readiness has not yet arrived.
    // Launch should still be active.
    vi.advanceTimersByTime(1200)
    expect(launch.isActive()).toBe(true)
    expect(completionSpy).not.toHaveBeenCalled()

    // At t=4199, we are 1ms away from when readiness will arrive (t=4200).
    // Launch should still be active.
    vi.advanceTimersByTime(4199 - 1200)
    expect(launch.isActive()).toBe(true)
    expect(completionSpy).not.toHaveBeenCalled()

    // Readiness arrives at t=4200. Trigger it now.
    vi.advanceTimersByTime(1)
    launch.onReady()

    // Launch should now be complete, not active.
    expect(launch.isActive()).toBe(false)
    expect(completionSpy).toHaveBeenCalledOnce()
  })
})

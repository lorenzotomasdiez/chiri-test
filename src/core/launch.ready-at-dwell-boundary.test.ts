import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Launch } from './launch'

describe('Launch state machine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // AC-2.2: the launch state ends at max(dwellDeadline, readyTime). When readiness
  // arrives exactly at the dwell boundary, completion fires exactly once.
  it('T-FR-2-3: Readiness landing exactly at the minimum dwell transitions once (AC-2.2)', () => {
    const completionSpy = vi.fn()
    const launch = new Launch({
      minDwellMs: 1200,
      now: () => Date.now(),
      setTimeout: vi.fn(globalThis.setTimeout),
      onComplete: completionSpy,
    })

    // At t=1199, the launch state is still active
    vi.advanceTimersByTime(1199)
    expect(launch.isActive()).toBe(true)
    expect(completionSpy.mock.calls.length).toBe(0)

    // At t=1200, the dwell timeout fires and ready signal is delivered in the same tick
    vi.advanceTimersByTime(1)
    launch.onReady()

    // AC-2.2: completion is called exactly once
    expect(completionSpy.mock.calls.length).toBe(1)
    expect(launch.isActive()).toBe(false)

    // Advancing further produces no second completion call
    vi.advanceTimersByTime(5000)
    expect(completionSpy.mock.calls.length).toBe(1)
  })
})

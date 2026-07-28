import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler } from './schedule'
import type { Transport, DispatchedRequest } from './schedule'

/** A transport that never resolves, capturing both requests and signals. */
function neverResolvingWithCapture() {
  // DispatchedRequest, not InputSignal: the model id snapshotted at dispatch
  // time is exactly what this spec asserts on, and InputSignal does not carry it.
  const captured: Array<{ req: DispatchedRequest; signal: AbortSignal }> = []
  const transport: Transport = (req, signal) => {
    captured.push({ req, signal })
    return new Promise(() => {}) as ReturnType<Transport>
  }
  return { transport, captured }
}

describe('Scheduler model snapshots', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('T-FR-8-5: A model change does not retarget or restart an in-flight continuation', () => {
    const { transport, captured } = neverResolvingWithCapture()

    let currentModel = 'openai/gpt-4o-mini'

    const scheduler = new Scheduler({
      settleMs: 600,
      transport,
      modelSource: () => currentModel,
    })

    scheduler.onInput({ docVersion: 1, cursor: 10 })
    vi.advanceTimersByTime(600)

    // One request dispatched with the model id in effect at dispatch time
    expect(captured).toHaveLength(1)
    expect(captured[0].req.modelId).toBe('openai/gpt-4o-mini')

    const firstSignal = captured[0].signal
    expect(firstSignal.aborted).toBe(false)

    // Change the selected model
    currentModel = 'openai/gpt-4.1'

    // Model change alone does not trigger a new dispatch or abort the in-flight request
    expect(captured).toHaveLength(1)
    expect(firstSignal.aborted).toBe(false)

    // Advance time further (well beyond any settling window)
    vi.advanceTimersByTime(5000)

    // Transport still called exactly once, signal still not aborted
    expect(captured).toHaveLength(1)
    expect(firstSignal.aborted).toBe(false)
  })
})

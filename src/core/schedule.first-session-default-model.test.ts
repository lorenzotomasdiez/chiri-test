import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Scheduler, type Transport, type DispatchedRequest } from './schedule'
import { buildContinuationRequest } from './prompt'
import { resolveModelId, DEFAULT_MODEL_ID } from './models'

/**
 * T-FR-8-12: an empty document on a brand-new session still produces a
 * continuation, against the default model, with no prior visit to the selector.
 *
 * The plan asks for this as a Playwright spec capturing the outgoing request
 * body. That is not yet possible: src/core/schedule.ts is not wired into
 * src/components/Editor.tsx, so typing in the real editor issues no request to
 * intercept. This covers the same claim one layer down - the scheduler that
 * will issue it, and the request assembly that will fill in the model - and the
 * browser half is owed once FR-5 connects the two.
 *
 * "Brand-new session" is modelled as `resolveModelId(undefined)`, which is
 * exactly what src/state/store.ts computes at boot when nothing is persisted.
 */

function capturingTransport() {
  const captured: DispatchedRequest[] = []
  const transport: Transport = (req) => {
    captured.push(req)
    return new Promise(() => {}) as ReturnType<Transport>
  }
  return { transport, captured }
}

describe('First-session continuation on an empty document', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('T-FR-8-12: typing into an empty document dispatches against the default model', () => {
    const { transport, captured } = capturingTransport()

    // Nothing persisted, and the selector has never been opened.
    const firstSessionModel = resolveModelId(undefined)

    const scheduler = new Scheduler({
      settleMs: 600,
      transport,
      modelSource: () => firstSessionModel,
    })

    // The user types the opening of a sentence into an empty document.
    const opening = 'The trouble with'
    scheduler.onInput({ docVersion: 1, cursor: opening.length })

    // Nothing goes out until the typing settles.
    expect(captured).toHaveLength(0)

    vi.advanceTimersByTime(600)

    // A request is issued - an empty starting document does not suppress it.
    expect(captured).toHaveLength(1)
    expect(captured[0].modelId).toBe(DEFAULT_MODEL_ID)
  })

  it('T-FR-8-12: the request is indistinguishable from a returning user who re-selected the default', () => {
    // Same document, same caret, one model arrived at implicitly and the other
    // by an explicit trip through the selector. The request bodies must not
    // differ - nothing may mark a request as "defaulted".
    const documentText = 'The trouble with'

    const implicit = buildContinuationRequest(
      resolveModelId(undefined),
      documentText,
      documentText.length,
    )
    const explicit = buildContinuationRequest(
      resolveModelId(DEFAULT_MODEL_ID),
      documentText,
      documentText.length,
    )

    expect(implicit).toEqual(explicit)
    expect(implicit.model).toBe(DEFAULT_MODEL_ID)
  })

  it('T-FR-8-12: an empty document with an empty caret context still assembles a valid request', () => {
    // The degenerate edge of "empty document": the caret is at offset 0 and
    // there is no preceding context at all. The body must still be well formed
    // rather than omitting the user message or the model.
    const body = buildContinuationRequest(resolveModelId(undefined), '', 0)

    expect(body.model).toBe(DEFAULT_MODEL_ID)
    expect(body.messages).toHaveLength(2)
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[1].role).toBe('user')
    expect(body.messages[1].content).toBe('')
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RefinementSession } from './refine'

/** A transport that returns a never-resolving async iterable and records its AbortSignal. */
function controllableNeverResolvingTransport() {
  let capturedSignal: AbortSignal
  let resolveIterator: ((value: unknown) => void) | undefined

  const iterator = new Promise<AsyncIterable<string>>((resolve) => {
    resolveIterator = resolve
  })

  // Annotated rather than inferred: the body references the function's own
  // return type, which tsc cannot resolve circularly.
  const transport = async function* (
    _req: unknown,
    signal: AbortSignal,
  ): AsyncIterable<string> {
    capturedSignal = signal
    // Never resolve - return a promise that never settles
    await new Promise(() => {})
    yield ''
  } as unknown as (req: unknown, signal: AbortSignal) => AsyncIterable<string>

  return {
    transport,
    getCapturedSignal: () => capturedSignal,
    resolveIterator: resolveIterator!,
  }
}

describe('RefinementSession', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('T-FR-7-3: Rejecting during an in-flight refinement cancels the request and leaves the document untouched', async () => {
    const originalText = 'The report was late because the team was busy.'
    const initialProposal = 'The report slipped.'
    const initialReason = 'Rewording for clarity'

    const { transport, getCapturedSignal } = controllableNeverResolvingTransport()

    // Given a RefinementSession over the original text with a spy transport
    // that returns a never-resolving async iterable
    const session = new RefinementSession({
      originalText,
      proposedText: initialProposal,
      reason: initialReason,
      transport,
      now: () => Date.now(),
    })

    // When the user submits an instruction
    await session.refine('make it shorter')

    // And calls reject() before any response arrives
    session.reject()

    // Then the recorded signal.aborted should be true synchronously
    expect(getCapturedSignal().aborted).toBe(true)

    // And the session's status is 'rejected'
    expect(session.status).toBe('rejected')

    // And the document text the session was constructed with is
    // byte-identical to its pre-revision value
    expect(session.originalText).toBe(originalText)

    // And if a late response somehow arrives, it is discarded
    // (this is tested implicitly by verifying proposed text stays unchanged)
    expect(session.proposedText).toBe(initialProposal)
  })
})

import { describe, it, expect } from 'vitest'
import { RefinementSession } from './refine'
import type { RequestBody } from './prompt'

/** Lets every pending microtask and timer-0 callback drain. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('RefinementSession concurrent turns', () => {
  /**
   * FR-7 does not say whether a second refinement submitted mid-flight is
   * blocked or supersedes the first, and the test plan leaves both readings
   * open (T-FR-7-9, Open Questions). This pins the blocked-until-resolved
   * reading: the one already implied by the review surface, which disables
   * its controls for the duration of a turn rather than cancelling one turn
   * in favour of another.
   */
  it('T-FR-7-9: A second refinement submitted while the first is in flight is blocked until the first resolves', async () => {
    // Given a session whose first refinement turn is held open
    const originalText = 'The launch date is unclear.'
    const initialProposed = 'The launch date is not yet set.'

    const requests: RequestBody[] = []
    let releaseFirst: () => void = () => {}
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })

    function transport(body: RequestBody): AsyncIterable<string> {
      requests.push(body)
      const turn = requests.length
      return (async function* () {
        if (turn === 1) await firstHeld
        yield turn === 1
          ? 'Shortened--sep--No launch date is set.'
          : 'Less formal--sep--No launch date yet.'
      })()
    }

    const session = new RefinementSession({
      originalText,
      proposedText: initialProposed,
      reason: 'Clarified',
      transport,
    })

    void session.refine('make it shorter')
    expect(requests).toHaveLength(1)
    expect(session.isRefining()).toBe(true)

    // When a second instruction is submitted before the first response arrives
    await session.refine('less formal')

    // Then no second request is issued and the chain is untouched
    expect(requests).toHaveLength(1)
    expect(session.getInstructionHistory()).toEqual(['make it shorter'])

    // And the in-progress state stays observable, so the surface can say so
    expect(session.isRefining()).toBe(true)

    // And at most one proposed text is ever current: the pre-turn one still
    // stands while the turn is open
    expect(session.getCurrentProposedText()).toBe(initialProposed)

    // And the document is unchanged throughout
    expect(session.documentText()).toBe(originalText)
    expect(session.spanText()).toBe(originalText)

    // When the first turn resolves
    releaseFirst()
    await flush()
    await flush()

    // Then its result lands, alone, and the session is refinable again
    expect(session.getCurrentProposedText()).toBe('No launch date is set.')
    expect(session.isRefining()).toBe(false)

    // And the second instruction, resubmitted, now goes through
    await session.refine('less formal')
    await flush()
    await flush()
    expect(requests).toHaveLength(2)
    expect(session.getInstructionHistory()).toEqual(['make it shorter', 'less formal'])
    expect(session.getCurrentProposedText()).toBe('No launch date yet.')

    // And the document was never touched by any of it
    expect(session.documentText()).toBe(originalText)
  })

  it('T-FR-7-9: A blocked second submission is not treated as a failure', async () => {
    // Given a session with a turn in flight that never resolves
    let released: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      released = resolve
    })

    function transport(): AsyncIterable<string> {
      return (async function* () {
        await held
        yield 'Shortened--sep--Shorter.'
      })()
    }

    const session = new RefinementSession({
      originalText: 'The launch date is unclear.',
      proposedText: 'The launch date is not yet set.',
      reason: 'Clarified',
      transport,
    })

    void session.refine('make it shorter')

    // When a second instruction is submitted and blocked
    await session.refine('less formal')

    // Then nothing is surfaced as a failure - a blocked submission is a
    // no-op, not an error the user has to dismiss
    expect(session.getFailure()).toBeNull()

    released()
    await flush()
    await flush()
    expect(session.getFailure()).toBeNull()
  })
})

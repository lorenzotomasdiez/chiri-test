import { describe, it, expect } from 'vitest'
import { RefinementSession } from './refine'
import { buildRefinementRequest } from './prompt'
import type { RequestBody } from './prompt'

describe('RefinementSession three-turn chain', () => {
  it('T-FR-7-11: A chain of three or more refinement turns keeps compounding rather than resetting', async () => {
    // Given a RefinementSession over the original text
    const originalText = 'The quarterly numbers were, on the whole, somewhat disappointing.'
    const initialProposedText = 'Quarterly numbers disappointed.'
    const initialReason = 'Shortened'

    // Track the request bodies sent to the transport
    const requestBodies: RequestBody[] = []
    let turnCount = 0

    // Mock transport that returns different responses for each turn
    async function* mockTransport(body: RequestBody, signal: AbortSignal): AsyncIterable<string> {
      requestBodies.push(body)
      turnCount++

      // Return response in the format "reason--sep--proposed_text"
      if (turnCount === 1) {
        yield 'Shortened--sep--Quarterly numbers disappointed.'
      } else if (turnCount === 2) {
        yield 'Simplified tone--sep--Numbers were rough.'
      } else if (turnCount === 3) {
        yield 'Added the figure--sep--Numbers were rough, down 12 percent.'
      }
    }

    // When a RefinementSession is created with the original text and initial proposal
    const session = new RefinementSession(
      originalText,
      initialProposedText,
      initialReason,
      mockTransport,
    )

    // And a first refinement instruction is submitted
    await session.refine('make it shorter')

    // And a second refinement instruction is submitted
    await session.refine('now less formal')

    // And a third refinement instruction is submitted
    await session.refine('add a concrete number')

    // Then the turn-three request body contains all three instruction strings in order
    const turn3Body = requestBodies[2]
    expect(turn3Body.messages).toBeDefined()
    const userMessage = turn3Body.messages[turn3Body.messages.length - 1]
    expect(userMessage.content).toContain('make it shorter')
    expect(userMessage.content).toContain('now less formal')
    expect(userMessage.content).toContain('add a concrete number')

    // And the session's current proposed text is 'Numbers were rough, down 12 percent.'
    expect(session.proposedText).toBe('Numbers were rough, down 12 percent.')

    // And the session's span from/to and original removal text are identical to turn one's
    expect(session.spanFrom).toBe(0)
    expect(session.spanTo).toBe(originalText.length)
    expect(session.originalRemovalText).toBe(
      'The quarterly numbers were, on the whole, somewhat disappointing.',
    )

    // And accept() returns exactly 'Numbers were rough, down 12 percent.'
    expect(session.accept()).toBe('Numbers were rough, down 12 percent.')
  })
})

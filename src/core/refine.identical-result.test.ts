import { describe, it, expect } from 'vitest'
import { RefinementSession } from './refine'
import type { RequestBody } from './prompt'

describe('RefinementSession identical result', () => {
  it('T-FR-7-14: A refinement returning the currently visible text updates the reason and stays pending', async () => {
    // Given a pending revision whose proposed text is already "Revenue grew steadily."
    const originalText = 'Revenue, broadly speaking, grew in a steady fashion.'
    const proposedText = 'Revenue grew steadily.'

    // And a model that returns that same text back, unchanged
    function transport(_body: RequestBody): AsyncIterable<string> {
      return (async function* () {
        yield 'Nothing needed changing--sep--Revenue grew steadily.'
      })()
    }

    const session = new RefinementSession(
      originalText,
      proposedText,
      'Shortened for concision',
      transport,
    )

    // When a refinement instruction is submitted
    await session.refine('tighten it further')

    // Then the proposed text is the same as before
    expect(session.getCurrentProposedText()).toBe('Revenue grew steadily.')

    // And the reason updates to say nothing needed changing
    expect(session.getCurrentReason()).toBe('Nothing needed changing')

    // And this is not treated as a failure
    expect(session.getFailure()).toBeNull()

    // And the revision remains pending and actionable exactly as before
    expect(session.status()).toBe('pending')
    expect(session.originalRemovalText).toBe(originalText)
    expect(session.spanFrom).toBe(0)
    expect(session.spanTo).toBe(originalText.length)

    // And accepting commits exactly that text
    expect(session.accept()).toBe('Revenue grew steadily.')
  })

  it('T-FR-7-14: An identical result does not disturb the instruction chain', async () => {
    const originalText = 'Revenue, broadly speaking, grew in a steady fashion.'

    function transport(): AsyncIterable<string> {
      return (async function* () {
        yield 'Nothing needed changing--sep--Revenue grew steadily.'
      })()
    }

    const session = new RefinementSession(
      originalText,
      'Revenue grew steadily.',
      'Shortened for concision',
      transport,
    )

    await session.refine('tighten it further')
    await session.refine('tighten it again')

    // A turn that changed nothing is still a turn the next request must see
    expect(session.getInstructionHistory()).toEqual(['tighten it further', 'tighten it again'])
    expect(session.getCurrentProposedText()).toBe('Revenue grew steadily.')
  })
})

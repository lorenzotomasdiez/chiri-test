/**
 * T-FR-12-4: a refinement turn that fails leaves the revision showing its
 * last successful state - not blank, and not the failed attempt - and leaves
 * it still acceptable and still rejectable.
 */

import { describe, expect, it } from 'vitest'
import { RefinementSession } from './refine'

function stream(text: string): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      yield text
    },
  }
}

const ORIGINAL = 'The onboarding flow needs a rewrite before launch.'

describe('a failed refinement turn reverts to the last successful state', () => {
  it('keeps the first turn on screen when the second turn fails', async () => {
    let call = 0
    const session = new RefinementSession(ORIGINAL, ORIGINAL, '', (_request, _signal) => {
      call += 1
      if (call === 1) return stream('reason: shorter\n--sep--\nOnboarding needs a rewrite.')
      return Promise.reject(new TypeError('Failed to fetch'))
    })

    await session.refine('make it shorter')
    expect(session.getCurrentProposedText()).toBe('Onboarding needs a rewrite.')

    await session.refine('make it a question')

    // The visible proposal is the last successful turn, and the pre-revision
    // original is still the reject target.
    expect(session.getCurrentProposedText()).toBe('Onboarding needs a rewrite.')
    expect(session.originalRemovalText).toBe(ORIGINAL)
    expect(session.getFailure()).toBeInstanceOf(TypeError)

    // Still acceptable and still rejectable: the failure did not end the
    // revision's life, it only ended that turn.
    expect(session.status()).toBe('pending')
    expect(session.accept()).toBe('Onboarding needs a rewrite.')
  })

  it('reverts a malformed response the same way a network failure reverts', async () => {
    let call = 0
    const session = new RefinementSession(ORIGINAL, ORIGINAL, '', () => {
      call += 1
      if (call === 1) return stream('reason: shorter\n--sep--\nOnboarding needs a rewrite.')
      // Arrived, but with no sentinel - unusable, and never guessed at.
      return stream('Here is a rewrite for you, hope it helps!')
    })

    await session.refine('make it shorter')
    await session.refine('make it a question')

    expect(session.getCurrentProposedText()).toBe('Onboarding needs a rewrite.')
    expect(session.status()).toBe('pending')
  })

  it('leaves the document untouched when the very first turn fails (AC-12.6)', async () => {
    const session = new RefinementSession(ORIGINAL, 'A shorter line.', '', () =>
      Promise.reject({ status: 429 }),
    )

    await session.refine('less formal')

    expect(session.getCurrentProposedText()).toBe('A shorter line.')
    expect(session.documentText()).toBe(ORIGINAL)
    expect(session.spanText()).toBe(ORIGINAL)
  })
})

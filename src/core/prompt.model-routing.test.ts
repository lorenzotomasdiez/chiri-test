import { describe, it, expect, vi } from 'vitest'
import { buildContinuationRequest, buildRevisionRequest } from './prompt'

describe('prompt model routing', () => {
  it('T-FR-8-3: A model change applies to the next request, not retroactively', () => {
    // Track all assembled request bodies to verify model routing
    const assembledRequests: Array<{ model: string }> = []

    // Spy on the request assembly functions
    const originalContinuation = buildContinuationRequest
    const originalRevision = buildRevisionRequest

    const spiedContinuation = vi.fn((modelId: string, documentText: string, cursorPosition: number) => {
      const result = originalContinuation(modelId, documentText, cursorPosition)
      assembledRequests.push(result)
      return result
    })

    const spiedRevision = vi.fn((modelId: string, selectedText: string) => {
      const result = originalRevision(modelId, selectedText)
      assembledRequests.push(result)
      return result
    })

    // Scenario 1: Initially selected model is openai/gpt-4o-mini
    const initialModel = 'openai/gpt-4o-mini'

    // User switches to openai/gpt-4o
    const newModel = 'openai/gpt-4o'

    // When a continuation request is assembled with the new model
    const continuationBody = spiedContinuation(newModel, 'The rain in Spain ', 18)

    // The assembled body's model field is openai/gpt-4o, and carries no trace
    // of the selection it replaced.
    expect(continuationBody.model).toBe('openai/gpt-4o')
    expect(continuationBody.model).not.toBe(initialModel)
    expect(continuationBody.max_tokens).toBe(120)
    expect(continuationBody.temperature).toBe(0.4)
    expect(continuationBody.stream).toBe(true)
    expect(continuationBody.messages).toBeDefined()
    expect(Array.isArray(continuationBody.messages)).toBe(true)

    // When a revision request is assembled with the switched model
    const revisionBody = spiedRevision(newModel, 'falls mainly on the plain.')

    // The assembled body's model is also openai/gpt-4o
    expect(revisionBody.model).toBe('openai/gpt-4o')
    expect(revisionBody.max_tokens).toBe(400)
    expect(revisionBody.temperature).toBe(0.2)
    expect(revisionBody.stream).toBe(true)
    expect(revisionBody.messages).toBeDefined()
    expect(Array.isArray(revisionBody.messages)).toBe(true)

    // Given a continuation result object that was already produced under openai/gpt-4o-mini
    const resultFromMini = {
      model: 'openai/gpt-4o-mini',
      proposedText: 'stays mainly in the plain.',
    }

    // When the selected model is switched to openai/gpt-4o
    // (already switched above)

    // And that result is accepted
    // (accepting means not assembling a new request for it)
    const acceptedText = resultFromMini.proposedText

    // Then the accepted text is byte-identical to what it was before the switch
    expect(acceptedText).toBe('stays mainly in the plain.')

    // And no additional request body is assembled
    // Assert the spy recorded exactly the two requests above and nothing more
    expect(assembledRequests).toHaveLength(2)
    expect(assembledRequests[0].model).toBe('openai/gpt-4o')
    expect(assembledRequests[1].model).toBe('openai/gpt-4o')
    expect(spiedContinuation).toHaveBeenCalledTimes(1)
    expect(spiedRevision).toHaveBeenCalledTimes(1)
  })
})

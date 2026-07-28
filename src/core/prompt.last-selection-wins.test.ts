import { describe, it, expect } from 'vitest'
import { DEFAULT_MODEL_ID } from './models'
import { assembleContinuationRequest } from './prompt'

describe('T-FR-8-10: Multiple model selections before request', () => {
  it('T-FR-8-10: only the last model selection is included in the dispatched request', () => {
    const continuationText = 'The user has typed some text and the caret is pausing here'

    // Start from the default, then switch three times with no request in
    // between. The run ends on a non-default model deliberately: if the final
    // selection were the default, this assertion would also pass for an
    // implementation that ignored every selection and fell back to the default,
    // and the test could not tell the two apart.
    let currentModelId: string = DEFAULT_MODEL_ID
    currentModelId = 'openai/gpt-4o' // A
    currentModelId = 'openai/gpt-4o-mini' // B
    currentModelId = 'openai/gpt-4.1' // C

    const requestBody = assembleContinuationRequest(continuationText, currentModelId)

    // C is what goes out.
    expect(requestBody.model).toBe('openai/gpt-4.1')

    // A and B leave no trace. Compared field-wise rather than by substring:
    // 'openai/gpt-4o' is a prefix of 'openai/gpt-4o-mini', so a containment
    // check could never distinguish them.
    expect(requestBody.model).not.toBe('openai/gpt-4o')
    expect(requestBody.model).not.toBe('openai/gpt-4o-mini')
    expect(requestBody.model).not.toBe(DEFAULT_MODEL_ID)

    // The rest of the continuation contract is unaffected by the switching.
    expect(requestBody.max_tokens).toBe(120)
    expect(requestBody.temperature).toBe(0.4)
    expect(requestBody.stream).toBe(true)
  })
})

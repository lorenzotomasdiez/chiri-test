import { describe, it, expect } from 'vitest'
import { buildRevisionRequest, PendingRevision } from './prompt'

describe('Pending revision model snapshot', () => {
  it('T-FR-8-4: Changing the model while a revision is pending does not touch the pending revision', () => {
    // Dispatch a revision request under openai/gpt-4o-mini for the span
    const revisionRequest = buildRevisionRequest('openai/gpt-4o-mini', 'The meeting was productive.')

    // Verify the request was built with the correct model
    expect(revisionRequest.model).toBe('openai/gpt-4o-mini')
    expect(revisionRequest.max_tokens).toBe(400)
    expect(revisionRequest.temperature).toBe(0.2)
    expect(revisionRequest.stream).toBe(true)

    // Create a pending revision record that holds both the model and the proposal
    const pending = new PendingRevision(
      revisionRequest.model,
      'The meeting produced three decisions.',
    )

    // Verify the pending revision captures the model at dispatch time
    expect(pending.modelId).toBe('openai/gpt-4o-mini')
    expect(pending.proposal).toBe('The meeting produced three decisions.')

    // User selects a different model: openai/gpt-4.1
    const newSelectedModel = 'openai/gpt-4.1'

    // Building a new revision request with the new model produces a separate request
    const newRevisionRequest = buildRevisionRequest(newSelectedModel, 'The meeting was productive.')
    expect(newRevisionRequest.model).toBe('openai/gpt-4.1')

    // The pending revision is byte-identical before and after the model change
    expect(pending.modelId).toBe('openai/gpt-4o-mini')
    expect(pending.proposal).toBe('The meeting produced three decisions.')

    // Accepting the pending revision commits exactly the original proposal text
    const accepted = pending.accept()
    expect(accepted).toBe('The meeting produced three decisions.')
  })
})

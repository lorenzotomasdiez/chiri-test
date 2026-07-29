import { describe, it, expect } from 'vitest'
import { resolveRefinementModelId } from './revision'

describe('T-FR-8-4: Changing the model while a revision is pending does not touch the pending revision', () => {
  it('resolves the snapshotted model id, not whatever is currently selected', () => {
    const revision = { modelId: 'openai/gpt-4o-mini' }

    // The model in effect when the revision was dispatched is what a
    // refinement turn must use.
    expect(resolveRefinementModelId(revision, 'openai/gpt-4o-mini')).toBe('openai/gpt-4o-mini')

    // The user then switches models. The snapshot on the revision itself
    // must still win over the newly selected model.
    expect(resolveRefinementModelId(revision, 'openai/gpt-4.1')).toBe('openai/gpt-4o-mini')
  })

  it('falls back to the currently selected model only when the revision never snapshotted one', () => {
    const revision = { modelId: undefined }

    expect(resolveRefinementModelId(revision, 'openai/gpt-4.1')).toBe('openai/gpt-4.1')
  })
})

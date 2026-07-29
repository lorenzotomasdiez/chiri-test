import { describe, it, expect, vi } from 'vitest'
import { RefinementSession } from './refine'
import type { RequestBody } from './prompt'

describe('RefinementSession instruction chain', () => {
  it('T-FR-7-2: A second refinement reflects both instructions in sequence, not just the latest one', async () => {
    // Given a RefinementSession over original text, already refined once with
    // 'make it shorter' (turn one returned 'Quarterly numbers disappointed.')
    const original = 'The quarterly numbers were, on the whole, somewhat disappointing.'
    const proposedAfterTurn1 = 'Quarterly numbers disappointed.'
    const reasonAfterTurn1 = 'Shortened'
    const instructionHistoryFromTurn1 = ['make it shorter']

    // Set up spy transport to capture the request body for turn two
    const capturedBodies: RequestBody[] = []
    const transport = vi.fn(async function* (body: RequestBody) {
      capturedBodies.push(body)
      // Simulate turn two response: reason 'Shorter and more casual' with body 'Numbers were rough.'
      yield 'reason: Shorter and more casual\n'
      yield '--sep--\n'
      yield 'Numbers were rough.'
    })

    const session = new RefinementSession(
      original,
      proposedAfterTurn1,
      reasonAfterTurn1,
      instructionHistoryFromTurn1,
      transport as any,
    )

    // When the user submits the second instruction 'now less formal'
    await session.refine('now less formal')

    // Then the request body captured by the spy for turn two contains BOTH strings
    expect(capturedBodies).toHaveLength(1)
    const requestBody = capturedBodies[0]
    expect(requestBody).toBeDefined()

    // Both instructions in order in its messages
    const messagesText = requestBody.messages.map((m) => m.content).join('\n')
    expect(messagesText).toContain('make it shorter')
    expect(messagesText).toContain('now less formal')

    // make it shorter comes before now less formal
    const idx1 = messagesText.indexOf('make it shorter')
    const idx2 = messagesText.indexOf('now less formal')
    expect(idx1).toBeGreaterThanOrEqual(0)
    expect(idx2).toBeGreaterThanOrEqual(0)
    expect(idx1).toBeLessThan(idx2)

    // And also carries turn one's current proposed text 'Quarterly numbers disappointed.'
    expect(messagesText).toContain('Quarterly numbers disappointed.')

    // When the transport returns reason 'Shorter and more casual' with body 'Numbers were rough.'
    // the session's current proposed text becomes 'Numbers were rough.'
    expect(session.getCurrentProposedText()).toBe('Numbers were rough.')

    // And its reason becomes 'Shorter and more casual'
    expect(session.getCurrentReason()).toBe('Shorter and more casual')
  })
})

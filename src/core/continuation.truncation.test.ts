import { describe, expect, it } from 'vitest'
import { sanitizeContinuation, truncateToTwoSentences } from './continuation'

/**
 * AC-5.10's two-sentence ceiling, checked at the boundary the test plan names:
 * one sentence (inside the limit), exactly two (at it), and three (over it).
 */
describe('T-FR-5-16: a response of more than two sentences is truncated before display', () => {
  const threeSentences =
    'The trail climbs steeply here. Bring extra water for the ridge. You will not regret the view.'

  it('shows only the first two sentences', () => {
    expect(truncateToTwoSentences(threeSentences)).toBe(
      'The trail climbs steeply here. Bring extra water for the ridge.',
    )
  })

  it('never lets the third sentence through the full shaping pipeline', () => {
    expect(sanitizeContinuation(threeSentences)).not.toContain('You will not regret the view')
  })

  it('leaves a response that is already exactly two sentences untouched', () => {
    const two = 'The trail climbs steeply here. Bring extra water for the ridge.'
    expect(truncateToTwoSentences(two)).toBe(two)
  })

  it('leaves a single-sentence response untouched', () => {
    const one = ' the pot for coffee.'
    expect(truncateToTwoSentences(one)).toBe(one)
  })

  it('preserves the leading space a continuation arrives with', () => {
    // The leading space is what lets the continuation be appended straight
    // onto the document with nothing missing. Trimming it here would silently
    // glue the continuation onto the last word already written.
    expect(truncateToTwoSentences(' One. Two. Three.')).toBe(' One. Two.')
  })

  it('counts ! and ? as sentence boundaries, not just .', () => {
    expect(truncateToTwoSentences('What now? Head north! Then rest.')).toBe(
      'What now? Head north!',
    )
  })
})

/**
 * The dangling-fragment half of AC-5.10. A model that stops mid-thought
 * should not have that half-thought shown as if it were a finished offer -
 * the shown text stops at the last complete sentence boundary it has.
 */
describe('T-FR-5-17: truncation lands on a sentence boundary, not mid-sentence', () => {
  it('drops an incomplete trailing fragment after a complete sentence', () => {
    expect(truncateToTwoSentences('Turn left at the fork. Then follow the creek until')).toBe(
      'Turn left at the fork.',
    )
  })

  it('drops the incomplete third fragment when two full sentences precede it', () => {
    expect(
      truncateToTwoSentences('Turn left at the fork. Follow the creek. Then climb until'),
    ).toBe('Turn left at the fork. Follow the creek.')
  })

  it('keeps a response with no boundary at all rather than showing nothing', () => {
    // A continuation that is one unfinished clause is all the model returned;
    // cutting it to the empty string would mean this case can never offer
    // anything, which is a worse failure than showing an unfinished clause.
    expect(truncateToTwoSentences(' the pot for coffee')).toBe(' the pot for coffee')
  })

  it('does not treat a decimal point as a sentence boundary', () => {
    expect(truncateToTwoSentences('The ridge sits at 1.5 km. Bring water.')).toBe(
      'The ridge sits at 1.5 km. Bring water.',
    )
  })

  it('keeps trailing whitespace after the final boundary from becoming a fragment', () => {
    expect(truncateToTwoSentences('Turn left at the fork.   ')).toBe('Turn left at the fork.')
  })
})

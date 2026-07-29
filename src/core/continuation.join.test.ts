import { describe, it, expect } from 'vitest'
import { joinContinuation } from './continuation'

/**
 * The gap between the document and the continuation belongs to the document,
 * not to the response: the model returns words, and whether a space goes in
 * front of them depends entirely on what the caret sits after.
 */
describe('joinContinuation', () => {
  it('adds the missing word gap after a closed sentence', () => {
    expect(joinContinuation('hello how you doing?', "I'm doing well.")).toBe(" I'm doing well.")
  })

  it('adds the missing word gap mid-sentence', () => {
    expect(joinContinuation('Pack the tent, the stove, and', 'the pot.')).toBe(' the pot.')
  })

  it('keeps a single gap the model already supplied', () => {
    expect(joinContinuation('Pack the tent, and', ' the pot.')).toBe(' the pot.')
  })

  it('does not double a gap the document already ends with', () => {
    expect(joinContinuation('This message is ', ' just a note.')).toBe('just a note.')
  })

  it('does not add a gap at the very start of a document', () => {
    expect(joinContinuation('', 'The cabin sat quiet.')).toBe('The cabin sat quiet.')
  })

  it('does not add a gap after an opener the next word belongs inside', () => {
    expect(joinContinuation('the fork (', 'the left one).')).toBe('the left one).')
  })

  it('does not add a gap after a hyphen a word is compounded onto', () => {
    expect(joinContinuation('a well-', 'worn path.')).toBe('worn path.')
  })

  it('does not add a gap after a newline the document already broke on', () => {
    expect(joinContinuation('- Pack the tent\n', '- Pack the stove')).toBe('- Pack the stove')
  })

  it('leaves a continuation that opens its own line alone', () => {
    expect(joinContinuation('- Pack the tent', '\n- Pack the stove')).toBe('\n- Pack the stove')
  })

  it('returns empty for an empty continuation', () => {
    expect(joinContinuation('anything at all', '')).toBe('')
  })
})

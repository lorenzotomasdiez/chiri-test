import { describe, expect, it } from 'vitest'
import { isEligible } from './continuation'

/**
 * AC-5.7's mid-word row. A continuation only ever proposes forward, on text
 * that does not exist yet. A caret with more of the same word ahead of it is
 * by definition not a place where the next text does not exist yet.
 */
describe('T-FR-5-22: a caret in the middle of an existing word does not trigger a continuation', () => {
  const text = 'The path led over the mountain'
  const midWord = text.indexOf('mountain') + 'moun'.length

  it('refuses between moun and tain', () => {
    expect(isEligible({ text, cursorPos: midWord })).toBe(false)
  })

  it('refuses mid-line even at a word boundary', () => {
    expect(isEligible({ text, cursorPos: text.indexOf('over') })).toBe(false)
  })

  it('allows at the end of the same line', () => {
    expect(isEligible({ text, cursorPos: text.length })).toBe(true)
  })

  it('refuses mid-word on a line that is not the last one', () => {
    const doc = 'The path led over the mountain\n\nAnd then down again'
    expect(isEligible({ text: doc, cursorPos: doc.indexOf('mountain') + 4 })).toBe(false)
  })

  it('allows at the end of a paragraph that is followed by a blank line', () => {
    const doc = 'The path led over the mountain\n\nAnd then down again'
    expect(isEligible({ text: doc, cursorPos: 'The path led over the mountain'.length })).toBe(true)
  })

  it('refuses where a wrapped line continues on the very next line', () => {
    // Nothing follows on this line, but the next line is not blank - the
    // paragraph carries on, so this caret is mid-paragraph, not at its end.
    const doc = 'The path led over\nthe mountain and down'
    expect(isEligible({ text: doc, cursorPos: 'The path led over'.length })).toBe(false)
  })
})

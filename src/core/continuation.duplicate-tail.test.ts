import { describe, expect, it } from 'vitest'
import { suppressDuplicateTail } from './continuation'

/**
 * The edge-case table's "response duplicates text already present" row.
 *
 * A model handed the preceding paragraph as context routinely echoes the last
 * few words back before continuing. Accepted verbatim that echo duplicates
 * text the writer already has, which is exactly the "never touches text
 * already written" promise (AC-5.15) failing from the other direction.
 */
describe('T-FR-5-18: a response that duplicates text already present is not shown as a duplicate', () => {
  it('drops a leading echo of the text immediately before the caret', () => {
    expect(suppressDuplicateTail('The cabin sat quiet and', ' and the mountains')).toBe(
      ' the mountains',
    )
  })

  it('drops the echo case-insensitively, since the model may recase it', () => {
    expect(suppressDuplicateTail('the stove, And', ' and the pot')).toBe(' the pot')
  })

  it('drops a long multi-word echo, preferring the longest overlap', () => {
    expect(
      suppressDuplicateTail('Pack the tent, the stove, and', ' the stove, and the pot for coffee.'),
    ).toBe(' the pot for coffee.')
  })

  it('leaves a continuation that does not echo anything untouched', () => {
    expect(suppressDuplicateTail('Pack the tent, the stove, and', ' the pot for coffee.')).toBe(
      ' the pot for coffee.',
    )
  })

  it('returns nothing when the continuation is entirely an echo', () => {
    expect(suppressDuplicateTail('the stove, and', 'the stove, and')).toBe('')
  })

  it('leaves an empty continuation alone', () => {
    expect(suppressDuplicateTail('anything at all', '')).toBe('')
  })

  it('handles empty preceding context without treating it as an overlap', () => {
    expect(suppressDuplicateTail('', ' the pot for coffee.')).toBe(' the pot for coffee.')
  })
})

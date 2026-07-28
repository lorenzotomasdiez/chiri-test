import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDocumentPersister } from './persist'

/**
 * T-FR-4-2: A character survives the durability floor
 *
 * The persistence layer debounces writes to guard against thrashing the storage
 * layer. This test verifies that once a character is typed and the debounce
 * period elapses, the change is persisted and remains persisted. The timing
 * verifies the debounce window: at 1900ms (before the 800ms debounce from a
 * call at 1200ms), the value may not be persisted yet (loss within NFR-5's
 * allowance). At 2000ms (800ms after the call), the change must be persisted.
 * At 2100ms, it remains persisted.
 */

describe('Document persistence debounce durability', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('T-FR-4-2: A character survives the durability floor', () => {
    // Create an in-memory store starting with the initial document
    const store = { text: 'Draft intro paragraph.' }

    const persister = createDocumentPersister({
      store,
      now: () => Date.now(),
      setTimeout: (fn, ms) => {
        const timeoutId = setTimeout(fn, ms)
        return timeoutId
      },
      debounceMs: 800,
    })

    // Advance time to 1200ms to set up the test scenario
    vi.advanceTimersByTime(1200)

    // The user types a character, extending the document
    const newText = 'Draft intro paragraph.x'
    const caretOffset = newText.length
    persister.onChange(newText, caretOffset)

    // At 1900ms absolute (700ms after onChange), debounce has not yet fired.
    // The value may not be persisted; we do not assert either way.
    vi.advanceTimersByTime(700)

    // At 2000ms absolute (800ms after onChange), debounce fires and persists.
    vi.advanceTimersByTime(100)
    expect(store.text).toBe('Draft intro paragraph.x')

    // At 2100ms, the persisted value remains.
    vi.advanceTimersByTime(100)
    expect(store.text).toBe('Draft intro paragraph.x')
  })
})

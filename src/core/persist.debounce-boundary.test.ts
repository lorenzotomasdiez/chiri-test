import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDocumentPersister } from './persist'

/**
 * T-FR-4-2, the half of it that can honestly be proven here.
 *
 * This file asserts one thing: a text edit reaches the store on the debounce
 * boundary and not before, carrying the caret and a timestamp with it. That
 * is a real contract - it is what stops the write path from either thrashing
 * IndexedDB on every keystroke or sitting on an edit indefinitely.
 *
 * It is deliberately NOT presented as a test of NFR-5's two-second durability
 * floor. The floor is a wall-clock promise about how much typing a real user
 * can lose, and it is the debounce *plus* the real IndexedDB write latency.
 * Neither half of that is observable against fake timers and an in-memory
 * object, so measuring it here would only ever restate the `debounceMs` value
 * the test itself passed in. The floor is proven in
 * e2e/fr-4-durability-floor.spec.ts, against a real browser and real storage.
 */

describe('DocumentPersister write debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('holds a text edit until the debounce boundary, then writes text, caret and timestamp', () => {
    const store = { text: 'Draft intro paragraph.', caretOffset: 22, savedAt: 100 }
    let clock = 1000
    const persister = createDocumentPersister({
      store,
      now: () => clock,
      debounceMs: 800,
    })

    persister.onChange('Draft intro paragraph.x', 23)

    // One tick short of the boundary the store is untouched, still holding
    // every field from before the edit.
    vi.advanceTimersByTime(799)
    expect(store).toEqual({ text: 'Draft intro paragraph.', caretOffset: 22, savedAt: 100 })

    // On the boundary the whole record lands at once - a write that carried
    // the text but left the caret behind would restore the document with the
    // cursor in the wrong place (T-FR-4-7).
    clock = 1800
    vi.advanceTimersByTime(1)
    expect(store).toEqual({ text: 'Draft intro paragraph.x', caretOffset: 23, savedAt: 1800 })
  })

  it('coalesces a burst of edits into a single write of the final state', () => {
    const store = { text: '', caretOffset: 0, savedAt: 0 }
    const writes: string[] = []
    const recording = {
      get text() {
        return store.text
      },
      set text(v: string) {
        store.text = v
        writes.push(v)
      },
      caretOffset: 0,
      savedAt: 0,
    }
    const persister = createDocumentPersister({ store: recording, now: () => 0, debounceMs: 800 })

    // Typing "abc" faster than the debounce window can close.
    persister.onChange('a', 1)
    vi.advanceTimersByTime(100)
    persister.onChange('ab', 2)
    vi.advanceTimersByTime(100)
    persister.onChange('abc', 3)
    vi.advanceTimersByTime(800)

    // One write, of the final state - not three, and not an intermediate
    // fragment (T-FR-4-11).
    expect(writes).toEqual(['abc'])
  })

  it('flush() writes the pending edit immediately instead of waiting out the debounce', async () => {
    const store = { text: 'before', caretOffset: 6, savedAt: 0 }
    const persister = createDocumentPersister({ store, now: () => 42, debounceMs: 800 })

    persister.onChange('after', 5)
    // No timer advance at all: this is the pagehide path, where the debounce
    // will never get to fire because the page is going away.
    await persister.flush()

    expect(store).toEqual({ text: 'after', caretOffset: 5, savedAt: 42 })
  })

  it('does not resurrect old text when the document is emptied', () => {
    const store = { text: 'Temporary notes to be discarded.', caretOffset: 32, savedAt: 0 }
    const persister = createDocumentPersister({ store, now: () => 1, debounceMs: 800 })

    persister.onChange('', 0)
    vi.advanceTimersByTime(800)

    // An empty document is a value to save, not an absence of one.
    expect(store.text).toBe('')
  })
})

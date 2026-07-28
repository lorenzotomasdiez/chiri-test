/**
 * FR-4's continuous local persistence, section 5 of the blueprint.
 *
 * Pure by construction, the same way src/core/schedule.ts and
 * src/core/keygate.ts are: no DOM, no idb-keyval, no fetch. The clock and
 * the debounce timer are injected, so the 800ms write debounce and the
 * durability floor run in virtual time with nothing running. This module
 * listens to no browser events itself - pagehide and visibilitychange are
 * wired by the caller, which is what keeps the forced-flush path testable
 * (testing.md).
 *
 * The sink this writes into is a plain mutable record - `store.text`,
 * `store.caretOffset`, `store.savedAt` are simply assigned, never called as
 * methods. In production that sink is src/storage/documentStore.ts's
 * handle, whose property writes forward to IndexedDB, mirroring how
 * src/storage/settings.ts's handle forwards writes to localStorage. In
 * tests it can be as plain as `{ text: '' }`.
 */

export interface Doc {
  text: string
  caretOffset: number
  savedAt: number
}

/**
 * The sink persist.ts writes into. Only ever assigned to, never called.
 * caretOffset and savedAt are optional on the input side so a bare
 * `{ text: '' }` in-memory fake (as used in tests) is a valid store without
 * having to pre-populate fields this module is about to write anyway.
 */
export interface DocumentStore {
  text: string
  caretOffset?: number
  savedAt?: number
}

export interface DocumentPersisterOptions {
  store: DocumentStore
  now?: () => number
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
  /** The write debounce (section 5): 800ms in production. */
  debounceMs?: number
}

export class DocumentPersister {
  private readonly opts: Required<
    Pick<DocumentPersisterOptions, 'store' | 'now' | 'setTimeout' | 'clearTimeout' | 'debounceMs'>
  >

  private handle: ReturnType<typeof setTimeout> | null = null
  private text: string
  private caretOffset: number

  constructor(options: DocumentPersisterOptions) {
    this.opts = {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h),
      debounceMs: 800,
      ...options,
    }
    this.text = options.store.text ?? ''
    this.caretOffset = options.store.caretOffset ?? 0
  }

  /**
   * The document changed - a keystroke, a paste, a deletion down to nothing,
   * or just the caret moving. Restarts the debounce window; an empty string
   * is a real value to persist, not "nothing to save" (T-FR-4-8), so it is
   * never special-cased away here.
   *
   * A caret move with no text change writes immediately rather than joining
   * the 800ms text debounce. It carries none of the thrash risk a debounce
   * guards against - one small field write, not a rewrite of the whole
   * document - and unlike a text edit, the forced pagehide/visibilitychange
   * flush is not a safe backstop for it: a caret move is very often the last
   * thing that happens before a tab closes (the user reads, then leaves),
   * leaving no subsequent edit to land inside the debounce window before
   * that flush fires.
   */
  onChange(text: string, caretOffset: number): void {
    const textChanged = text !== this.text
    this.text = text
    this.caretOffset = caretOffset
    if (this.handle !== null) {
      this.opts.clearTimeout(this.handle)
      this.handle = null
    }
    if (!textChanged) {
      this.writeNow()
      return
    }
    this.handle = this.opts.setTimeout(() => {
      this.handle = null
      this.writeNow()
    }, this.opts.debounceMs)
  }

  /**
   * Forces the pending write now, cancelling the debounce timer. Called by
   * the caller's pagehide/visibilitychange listener - this module never
   * listens for those itself.
   */
  async flush(): Promise<void> {
    if (this.handle !== null) {
      this.opts.clearTimeout(this.handle)
      this.handle = null
    }
    this.writeNow()
    // Yields one microtask so a store whose setters schedule their own
    // microtask-coalesced write (src/storage/documentStore.ts) get to start
    // that write before flush()'s promise settles.
    await Promise.resolve()
  }

  private writeNow(): void {
    this.opts.store.text = this.text
    this.opts.store.caretOffset = this.caretOffset
    this.opts.store.savedAt = this.opts.now()
  }
}

export function createDocumentPersister(options: DocumentPersisterOptions): DocumentPersister {
  return new DocumentPersister(options)
}

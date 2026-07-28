import { get, set } from 'idb-keyval'
import type { Doc, DocumentStore } from '../core/persist'

export type { Doc }

/** Section 5 of the blueprint: the whole document lives under one key. */
const STORAGE_KEY = 'chiri-document'

function isDoc(value: unknown): value is Doc {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.text === 'string' &&
    typeof v.caretOffset === 'number' &&
    typeof v.savedAt === 'number'
  )
}

/**
 * Reads the persisted document once at boot. A missing key, a read that
 * throws, or a record that does not match the `{ text, caretOffset,
 * savedAt }` shape all degrade to null rather than throwing - the same
 * try/catch degrade-to-default pattern as src/storage/settings.ts's
 * readInitial(), applied to a corrupted IndexedDB record instead of a
 * corrupted localStorage string.
 */
export async function loadDocument(): Promise<Doc | null> {
  try {
    const raw = await get(STORAGE_KEY)
    return isDoc(raw) ? raw : null
  } catch {
    return null
  }
}

async function persistDoc(doc: Doc): Promise<void> {
  try {
    await set(STORAGE_KEY, doc)
  } catch {
    // FR-4's whole premise is that saving is invisible - there is no save
    // affordance to report a failure to, so a write failure degrades
    // silently rather than crashing the app.
  }
}

/**
 * A handle whose field writes persist to IndexedDB, mirroring
 * src/storage/settings.ts's createSettingsHandle: a plain object whose
 * property writes persist. This is the `DocumentStore` src/core/persist.ts
 * writes into - src/core never imports idb-keyval, it is only ever handed
 * this object.
 *
 * src/core/persist.ts always sets text, then caretOffset, then savedAt
 * together in the same synchronous burst (its one debounced write), so
 * those three writes are coalesced into a single IndexedDB write via
 * microtask rather than firing three redundant ones.
 */
export function createDocumentHandle(initial: Doc): DocumentStore {
  let text = initial.text
  let caretOffset = initial.caretOffset
  let savedAt = initial.savedAt
  let writeScheduled = false

  function scheduleWrite() {
    if (writeScheduled) return
    writeScheduled = true
    queueMicrotask(() => {
      writeScheduled = false
      void persistDoc({ text, caretOffset, savedAt })
    })
  }

  const handle = {} as DocumentStore
  Object.defineProperty(handle, 'text', {
    enumerable: true,
    get: () => text,
    set: (v: string) => {
      text = v
      scheduleWrite()
    },
  })
  Object.defineProperty(handle, 'caretOffset', {
    enumerable: true,
    get: () => caretOffset,
    set: (v: number) => {
      caretOffset = v
      scheduleWrite()
    },
  })
  Object.defineProperty(handle, 'savedAt', {
    enumerable: true,
    get: () => savedAt,
    set: (v: number) => {
      savedAt = v
      scheduleWrite()
    },
  })
  return handle
}

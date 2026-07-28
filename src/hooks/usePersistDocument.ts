import { useEffect, useRef, useState } from 'react'
import { createDocumentPersister, type DocumentPersister } from '../core/persist'
import { loadDocument, createDocumentHandle, type Doc } from '../storage/documentStore'

/** What the caller needs to seed the editor's first mount. */
export interface LoadedDocument {
  text: string
  caretOffset: number
}

/**
 * Loads the persisted document once at boot, then wires up the debounced
 * writer (src/core/persist.ts) against the IndexedDB-backed handle
 * (src/storage/documentStore.ts), forcing a flush on `pagehide` and on
 * `visibilitychange` turning hidden - section 5 of the blueprint's write
 * schedule. `doc` is null until the load resolves; callers must not mount
 * the Editor before it does (its mount effect is keyed on initialDoc, so a
 * later change would remount it and destroy undo history).
 */
export function usePersistDocument() {
  const [doc, setDoc] = useState<LoadedDocument | null>(null)
  const persisterRef = useRef<DocumentPersister | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadDocument().then((loaded: Doc | null) => {
      if (cancelled) return
      const initial: Doc = loaded ?? { text: '', caretOffset: 0, savedAt: 0 }
      const handle = createDocumentHandle(initial)
      persisterRef.current = createDocumentPersister({ store: handle })
      setDoc({ text: initial.text, caretOffset: initial.caretOffset })
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function flush() {
      void persisterRef.current?.flush()
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  function onDocChange(text: string, caretOffset: number): void {
    persisterRef.current?.onChange(text, caretOffset)
  }

  return { doc, onDocChange }
}

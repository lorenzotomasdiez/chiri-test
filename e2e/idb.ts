import type { Page } from '@playwright/test'

/**
 * Reads FR-4's persisted document record straight out of IndexedDB, the same
 * way a cold boot does.
 *
 * Asserting on `window.__editor.state.doc` only proves what CodeMirror is
 * holding in memory. It says nothing about what survives a reload, so a spec
 * built on it alone passes just as happily when the write path is dead as
 * when it works. Reading the record itself is what makes the persistence
 * claim falsifiable.
 *
 * The db and store names are idb-keyval's defaults, and the key is the single
 * one src/storage/documentStore.ts writes under.
 */
export interface PersistedDoc {
  text: string
  caretOffset: number
  savedAt: number
}

export async function readPersistedDoc(page: Page): Promise<PersistedDoc | null> {
  return page.evaluate(
    () =>
      new Promise<PersistedDoc | null>((resolve) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => resolve(null)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('keyval')) return resolve(null)
          const req = db
            .transaction('keyval', 'readonly')
            .objectStore('keyval')
            .get('chiri-document')
          req.onsuccess = () => resolve((req.result as PersistedDoc | undefined) ?? null)
          req.onerror = () => resolve(null)
        }
      }),
  )
}

/**
 * Waits until the persisted record satisfies `predicate`, or throws once
 * `timeoutMs` elapses. Polling rather than sleeping a fixed span keeps the
 * durability specs honest about *when* a write lands, which is the whole
 * point of NFR-5, and keeps them from being slower than they need to be.
 */
export async function waitForPersisted(
  page: Page,
  predicate: (doc: PersistedDoc | null) => boolean,
  timeoutMs = 5000,
): Promise<PersistedDoc | null> {
  const deadline = Date.now() + timeoutMs
  let last: PersistedDoc | null = null
  for (;;) {
    last = await readPersistedDoc(page)
    if (predicate(last)) return last
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for the persisted document. Last record: ${JSON.stringify(last)}`,
      )
    }
    await page.waitForTimeout(50)
  }
}

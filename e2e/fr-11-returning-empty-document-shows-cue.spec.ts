import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { seedValidatedKey } from './seed'
import { readPersistedDoc } from './idb'
import type { EditorView } from '@codemirror/view'

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
async function docText(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __editor: EditorView }).__editor.state.doc.toString(),
  )
}

/**
 * Writes FR-4's document record directly, so the next boot loads a document
 * that was *saved* and happens to be empty.
 *
 * This is the whole point of T-FR-11-8: "no document has ever been saved" and
 * "a document was saved and it holds zero characters" are two different states
 * that both render an empty editor. Typing and deleting to get there would be
 * T-FR-11-5 again; seeding the record is what makes the distinction real, and
 * what would catch a cue gated on "is this a first-ever visit" rather than on
 * current emptiness.
 *
 * The db, store, and key are idb-keyval's defaults, matching e2e/idb.ts and
 * src/storage/documentStore.ts. The store is created if the app has not
 * written anything yet, the same way idb-keyval creates it.
 */
async function seedPersistedEmptyDoc(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const record = { text: '', caretOffset: 0, savedAt: 1 }

        const put = (db: IDBDatabase) => {
          const tx = db.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put(record, 'chiri-document')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(new Error('seed transaction failed'))
        }

        const open = indexedDB.open('keyval-store')
        open.onerror = () => reject(new Error('could not open keyval-store'))
        open.onsuccess = () => {
          const db = open.result
          if (db.objectStoreNames.contains('keyval')) return put(db)

          // The app has not written yet, so idb-keyval has not created the
          // store. Bump the version to create it, exactly as idb-keyval does.
          const version = db.version + 1
          db.close()
          const upgrade = indexedDB.open('keyval-store', version)
          upgrade.onupgradeneeded = () => upgrade.result.createObjectStore('keyval')
          upgrade.onerror = () => reject(new Error('could not create keyval store'))
          upgrade.onsuccess = () => put(upgrade.result)
        }
      }),
  )
}

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-11-8: a returning user whose saved document is still empty sees the cue again', async ({
  page,
}) => {
  const cue = page.locator('[data-testid="onboarding-cue"]')

  // What the very first visit shows, captured so the second visit can be
  // compared against it rather than against a copy pasted into this spec.
  await expect(cue).toHaveCount(1)
  const firstVisitCueText = (await cue.textContent())?.trim()
  expect(firstVisitCueText).toBeTruthy()

  // Given: a document was saved in the prior session and holds zero
  // characters. Read it back before reloading - if this record is not really
  // on disk, the reload below proves nothing except that a never-saved
  // profile shows the cue, which is T-FR-11-1.
  await seedPersistedEmptyDoc(page)
  const seeded = await readPersistedDoc(page)
  expect(seeded).not.toBeNull()
  expect(seeded?.text).toBe('')

  // When: the user reopens Chiri in the same browser profile.
  await page.reload()
  await page.waitForSelector('[data-testid="editor"] .cm-content')

  // Then: the document is empty...
  expect(await docText(page)).toBe('')

  // ...and the cue is shown exactly as it was on the very first visit.
  await expect(cue).toHaveCount(1)
  await expect(cue).toBeVisible()
  expect((await cue.textContent())?.trim()).toBe(firstVisitCueText)

  // And it stays. A cue that flashes during load and then decides this is a
  // returning profile would satisfy every assertion above.
  await page.waitForTimeout(500)
  await expect(cue).toBeVisible()
})

import { test, expect } from '@playwright/test'
import { seedValidatedKey } from './seed'

/**
 * Guards the EditorErrorBoundary added around src/App.tsx's lazily-loaded
 * Editor chunk: if the network drops that chunk's request (a stale deploy,
 * a flaky connection), the app must degrade to a recoverable message rather
 * than an uncaught error that blanks the whole page.
 */
test('a failed editor chunk fetch shows a recoverable error, not a blank page', async ({
  page,
}) => {
  await seedValidatedKey(page)

  // Fail only the Editor module's own request, not its dependencies - a
  // real chunk-load failure is one missing file, not a total network outage.
  await page.route('**/src/components/Editor.tsx*', (route) => route.abort('failed'))

  await page.goto('/')

  await expect(page.getByTestId('editor-load-error')).toBeVisible()
  await expect(page.getByTestId('editor-load-error')).toContainText('failed to load')
  // The rest of the shell survives - the top bar is not part of the boundary.
  await expect(page.getByTestId('copy-button')).toBeVisible()

  // Once the chunk is reachable again, the offered reload recovers the app.
  await page.unroute('**/src/components/Editor.tsx*')
  await page.getByTestId('editor-load-retry').click()

  await expect(page.getByTestId('editor-load-error')).not.toBeVisible()
  await expect(page.locator('.cm-content')).toBeVisible()
})

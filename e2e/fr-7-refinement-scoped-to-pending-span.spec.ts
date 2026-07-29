import { test, expect } from '@playwright/test'
import type { EditorView } from '@codemirror/view'
import { seedValidatedKey } from './seed'
import { mockRevisionResponse } from './openrouter-mock'
import { seedPendingRevision, docText } from './pendingRevision'

const PARAGRAPH_ONE = 'The launch date is unclear.'
const PARAGRAPH_THREE = 'Budget approval is still outstanding for the second half.'
const DOC = `${PARAGRAPH_ONE}\n\nA middle paragraph nobody touches.\n\n${PARAGRAPH_THREE}`

const PROPOSED = 'The launch date is not yet set.'
const REASON = 'Clarified'
const REFINED = 'No launch date has been fixed.'
const REFINED_REASON = 'Made it definite'

test.beforeEach(async ({ page }) => {
  await seedValidatedKey(page)
  await page.goto('/')
  await page.waitForSelector('[data-testid="editor"] .cm-content')
})

test('T-FR-7-7: A refinement applies only to the pending revision span, never to a selection made while it is open', async ({
  page,
}) => {
  // Given a pending revision over paragraph one, with its refinement input open
  const span = await seedPendingRevision(page, {
    doc: DOC,
    span: PARAGRAPH_ONE,
    proposed: PROPOSED,
    reason: REASON,
  })

  await page.locator('[data-testid="revision-refine"]').click()
  const input = page.locator('[data-testid="refinement-instruction-input"]')
  await input.fill('make it definite')

  // When the user selects text in paragraph three without closing the refinement input
  const thirdStart = DOC.indexOf(PARAGRAPH_THREE)
  await page.evaluate(
    ({ start, end }) => {
      const editor = (window as unknown as { __editor: EditorView }).__editor
      editor.dispatch({ selection: { anchor: start, head: end } })
    },
    { start: thirdStart, end: thirdStart + PARAGRAPH_THREE.length },
  )

  // Then no new action bar or revision is raised for paragraph three
  await expect(page.locator('[data-testid="selection-action-bar"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="revision-decoration"]')).toHaveCount(1)

  // And the refinement input is still attached to paragraph one's revision,
  // still holding the instruction typed for it
  await expect(page.locator('[data-testid="revision-existing"]')).toHaveText(PARAGRAPH_ONE)
  await expect(input).toHaveValue('make it definite')

  // When the refinement is submitted
  await mockRevisionResponse(page, { reason: REFINED_REASON, proposal: REFINED })
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith('https://openrouter.ai')) requests.push(request.postData() ?? '')
  })
  await page.locator('[data-testid="revision-refine-submit"]').click()

  // Then the result is scoped to paragraph one only
  await expect(page.locator('[data-testid="revision-proposed"]')).toHaveText(REFINED)
  await expect(page.locator('[data-testid="revision-existing"]')).toHaveText(PARAGRAPH_ONE)

  // And the request the refinement sent carried paragraph one's span, not paragraph three's
  expect(requests).toHaveLength(1)
  expect(requests[0]).toContain(PARAGRAPH_ONE)
  expect(requests[0]).not.toContain(PARAGRAPH_THREE)

  // And accepting replaces paragraph one alone, leaving paragraph three intact
  await page.locator('[data-testid="revision-accept"]').click()
  const finalDoc = await docText(page)
  expect(finalDoc).toBe(
    `${REFINED}\n\nA middle paragraph nobody touches.\n\n${PARAGRAPH_THREE}`,
  )
  expect(span.from).toBe(0)
})

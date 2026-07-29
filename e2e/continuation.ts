import type { Page, Route } from '@playwright/test'

/**
 * Shared seam for FR-5's continuation specs.
 *
 * Every FR-5 spec needs the same four things: the document as CodeMirror
 * holds it, the ghost continuation as the ghostField holds it, a mocked
 * OpenRouter that answers a continuation request the way the real one does,
 * and - for the whole family of "no request is issued" scenarios - a count of
 * how many continuation requests actually left the browser.
 *
 * That last one is why this file exists rather than each spec hand-rolling a
 * `page.route`. A scenario like T-FR-5-12 passes trivially if it only asserts
 * that no ghost appeared: no ghost appears when the network is simply slow
 * either. Counting the requests is what makes "no request was issued"
 * falsifiable.
 */

/** The first words of the continuation system message in src/core/prompt.ts. */
const CONTINUATION_MARKER = 'Continue the text with at most two sentences'

/**
 * The Scheduler's settle window (src/editor/ghostText.ts passes 600). A pause
 * asserted as "no continuation was requested" has to outlast this, or it is
 * only asserting that the debounce had not fired yet.
 */
export const SETTLE_MS = 600

/** Comfortably past the settle window, for scenarios asserting silence. */
export const PAST_SETTLE_MS = SETTLE_MS * 2

/** The document as CodeMirror holds it - the canonical Markdown, not the DOM. */
export async function docText(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __editor: { state: { doc: { toString(): string } } } }
      ).__editor.state.doc.toString(),
  )
}

/** The caret offset as CodeMirror holds it. */
export async function caretOffset(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        window as unknown as { __editor: { state: { selection: { main: { head: number } } } } }
      ).__editor.state.selection.main.head,
  )
}

/**
 * The ghost continuation currently held in the ghostField, or null when none
 * is shown. Read off the handle Editor.tsx publishes rather than scraped out
 * of the widget's rendered text, so a spec asserts the state the accept
 * commands actually read.
 */
export async function ghostText(page: Page): Promise<string | null> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          ghostTextStateField?: { getGhostText: () => string | null }
        }
      ).ghostTextStateField?.getGhostText?.() ?? null,
  )
}

/**
 * Waits until a non-empty ghost continuation is showing. The predicate runs
 * entirely inside the page - it reads the published handle directly rather
 * than calling the Node-side `ghostText` helper above, which does not exist
 * in the browser context `waitForFunction` evaluates in.
 */
export async function waitForGhost(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      const handle = (
        window as unknown as { ghostTextStateField?: { getGhostText: () => string | null } }
      ).ghostTextStateField
      const ghost = handle?.getGhostText?.() ?? null
      return ghost !== null && ghost !== ''
    },
    { timeout: timeoutMs },
  )
}

export interface EditorSnapshot {
  doc: string
  caret: number
  ghost: string | null
  ghostWidgets: number
}

/**
 * Reads the document, caret, ghost, and painted widget count in a single
 * round trip.
 *
 * Several scenarios have to assert a state that is only true for a moment -
 * after the last accept-word press the ghost is empty, but the caret is now
 * at an eligible position again and the scheduler will offer a fresh
 * continuation once the settle window elapses. Four sequential `evaluate`
 * calls can straddle that window; one cannot.
 */
export async function snapshot(page: Page): Promise<EditorSnapshot> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __editor: {
        state: {
          doc: { toString(): string }
          selection: { main: { head: number } }
        }
      }
      ghostTextStateField?: { getGhostText: () => string | null }
    }
    return {
      doc: w.__editor.state.doc.toString(),
      caret: w.__editor.state.selection.main.head,
      ghost: w.ghostTextStateField?.getGhostText?.() ?? null,
      ghostWidgets: document.querySelectorAll('[data-testid="ghost-text"]').length,
    }
  })
}

/** How many ghost widgets are painted in the editor right now. */
export async function ghostWidgetCount(page: Page): Promise<number> {
  return page.locator('[data-testid="ghost-text"]').count()
}

/** Wraps one fragment of model output in the SSE frame OpenRouter sends for it. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\n`
}

function isContinuation(route: Route): boolean {
  return (route.request().postData() ?? '').includes(CONTINUATION_MARKER)
}

export interface OpenRouterMock {
  /** How many continuation requests actually reached the network layer. */
  continuationCount(): number
}

export interface MockOptions {
  /**
   * The continuation to stream back. A string is sent as one frame; an array
   * is sent fragment by fragment, which is how a real model streams and the
   * only shape that catches a decoder scanning the raw transcript.
   */
  continuation?: string | string[]
  /** Fail the continuation request instead of answering it (T-FR-5-20). */
  failContinuation?: boolean
}

/**
 * Installs one OpenRouter handler that answers continuation requests and
 * counts them.
 *
 * The count is keyed off the continuation system message rather than the host,
 * because FR-6's revisions and FR-1's key validation go to the same host. A
 * counter that could not tell them apart would report traffic FR-5 never
 * caused.
 */
export async function mockOpenRouter(page: Page, options: MockOptions = {}): Promise<OpenRouterMock> {
  let continuationCount = 0

  await page.route('https://openrouter.ai/**', async (route) => {
    if (isContinuation(route)) {
      continuationCount++

      if (options.failContinuation) {
        await route.abort('failed')
        return
      }

      const fragments =
        typeof options.continuation === 'string'
          ? [options.continuation]
          : (options.continuation ?? [])

      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: fragments.map(frame).join('') + 'data: [DONE]\n\n',
      })
      return
    }

    // Anything else this app sends to OpenRouter (key validation, an FR-6
    // revision) is answered as an empty success rather than aborted, so an
    // unrelated request never surfaces as a failure inside an FR-5 spec.
    await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' })
  })

  return { continuationCount: () => continuationCount }
}

/**
 * Raises an FR-6 pending revision over `[from, to)` through the handle
 * Editor.tsx publishes, without going through the action bar.
 *
 * FR-5's two suppression scenarios only care that a pending span exists -
 * whether the action bar raised it correctly is FR-6's own requirement, and
 * routing through the UI here would make these specs fail for FR-6's reasons.
 */
export async function raisePendingRevision(
  page: Page,
  from: number,
  to: number,
  proposed = 'a softer phrasing',
  reason = 'Softens the claim.',
): Promise<void> {
  await page.evaluate(
    ({ from: start, to: end, proposed: proposal, reason: why }) => {
      const w = window as unknown as {
        __editor: {
          state: { sliceDoc: (from: number, to: number) => string }
          dispatch: (spec: unknown) => void
        }
        setPendingRevision: (
          from: number,
          to: number,
          existing: string,
          modelId: string,
          proposed?: string,
          reason?: string,
        ) => unknown
      }
      w.__editor.dispatch({
        effects: [
          w.setPendingRevision(
            start,
            end,
            w.__editor.state.sliceDoc(start, end),
            'openai/gpt-4o-mini',
            proposal,
            why,
          ),
        ],
      })
    },
    { from, to, proposed, reason },
  )
}

/** Moves the caret to `offset` without a pointer and without changing the document. */
export async function moveCaret(page: Page, offset: number): Promise<void> {
  await page.evaluate((anchor) => {
    const editor = (window as unknown as { __editor: { dispatch: (spec: unknown) => void } })
      .__editor
    editor.dispatch({ selection: { anchor } })
  }, offset)
}

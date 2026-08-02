import { useEffect, useRef, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { useAppStore } from '../state/store'
import { buildRevisionRequest } from '../core/prompt'
import { checkParagraphCount, validateResponseSpan } from '../core/revision'
import { MalformedResponseError } from '../core/failure'
import { splitRevisionResponse } from '../core/provider'
import { requestRevisionCompletion } from '../net/openrouter'
import { setPendingRevisionEffect } from '../editor/pendingRevision'

interface OneTapAction {
  testId: string
  label: string
  instruction: string
}

/** AC-6.2's one-tap set: improve the writing, make it shorter, change the tone, fix grammar and spelling. */
const ONE_TAP_ACTIONS: OneTapAction[] = [
  {
    testId: 'action-improve-writing',
    label: 'Improve the writing',
    instruction: 'Improve the writing.',
  },
  { testId: 'action-make-shorter', label: 'Make it shorter', instruction: 'Make it shorter.' },
  { testId: 'action-change-tone', label: 'Change the tone', instruction: 'Change the tone.' },
  {
    testId: 'action-fix-grammar',
    label: 'Fix grammar and spelling',
    instruction: 'Fix grammar and spelling.',
  },
]

interface SelectionActionBarProps {
  view: EditorView
  from: number
  to: number
  /**
   * AC-6.13: another revision is already pending elsewhere in the document.
   * At most one revision is in flight at a time, so a request from this bar
   * is refused with a visible message rather than issued.
   */
  revisionPending?: boolean
}

const PENDING_REVISION_MESSAGE =
  'A revision is already pending. Resolve it before requesting another.'

/**
 * The floating action bar raised over a non-empty selection (AC-6.2), a
 * compact primary "Ask AI" button (CC-BTN.3) plus one-tap secondary chips
 * (CC-BTN.4) and a borderless instruction field (CC-INPUT.5) inside a
 * floating panel (CC-PANEL.1-5). Positioned off `coordsAtPos` of the
 * selection's own start and end, the same values the selection's rendered
 * rectangles are read from, and always below the selection so it never
 * covers the text it refers to.
 */
export function SelectionActionBar({
  view,
  from,
  to,
  revisionPending = false,
}: SelectionActionBarProps) {
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  // Aborted on unmount (T-FR-6-13): clearing or replacing the selection
  // unmounts this bar while a request may still be in flight, and without
  // this the response would land later and dispatch a proposal over a span
  // the user is no longer looking at.
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])
  // What has streamed back so far, for the progress line. Never rendered as
  // the proposal itself - see the AC-6.9 note in `runRevision`.
  const [streamed, setStreamed] = useState('')
  const modelId = useAppStore((s) => s.selectedModelId)
  const apiKey = useAppStore((s) => s.apiKey)

  // T-FR-6-24: the window is the scroll container (CC-SHELL.6), and
  // `coordsAtPos` below is only ever recomputed on render. Without this, a
  // window scroll after the bar has already mounted leaves it stranded at
  // its old viewport coordinates, floating over whatever text scrolled in
  // underneath it. A scroll never changes CM6 selection state on its own, so
  // nothing else here would trigger the re-render that recomputes it.
  const [, trackScroll] = useState(0)
  useEffect(() => {
    let raf = 0
    const onViewportChange = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => trackScroll((n) => n + 1))
    }
    // `capture: true`: scroll events do not bubble, and the window itself is
    // only one of possibly several scrollable ancestors.
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [])

  const startCoords = view.coordsAtPos(from)
  const endCoords = view.coordsAtPos(to)
  const selectionBottom = Math.max(startCoords?.bottom ?? 0, endCoords?.bottom ?? 0)
  const left = startCoords?.left ?? 0
  const top = selectionBottom + 8

  async function runRevision(userInstruction: string) {
    // Read through a ref rather than the rendered value: `runRevision` is also
    // the retry closure handed to the failure banner, and by the time the user
    // clicks Retry the `busy` this closure captured is several renders old.
    if (busyRef.current) return
    // AC-6.13: a revision is already pending over some other span. Refuse
    // outright, the same shape as the paragraph-count guard below, rather
    // than issuing a second request that would have nowhere valid to land.
    if (revisionPending) {
      setMessage(PENDING_REVISION_MESSAGE)
      return
    }
    const selectedText = view.state.sliceDoc(from, to)
    const guard = checkParagraphCount(selectedText)
    if (guard.kind === 'refused') {
      setMessage(guard.message)
      return
    }

    setMessage(null)
    setStreamed('')
    busyRef.current = true
    setBusy(true)

    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const promptText = userInstruction ? `${userInstruction}\n\n${selectedText}` : selectedText
      const requestBody = buildRevisionRequest(modelId, promptText)

      let completion: string
      try {
        // The response streams, and is consumed as it streams: `onFragment`
        // drives the progress line below. What it must NOT drive is the
        // review surface - AC-6.9 requires a response reaching outside the
        // span to render nothing at all, and that can only be judged once
        // the whole proposal has arrived. So the card is dispatched once,
        // after the containment check, while the progress indicator is what
        // the user watches in the meantime.
        completion = await requestRevisionCompletion(
          requestBody,
          apiKey,
          controller.signal,
          (_fragment, soFar) => setStreamed(soFar),
        )
      } catch (error) {
        // T-FR-6-13: an abort means the selection this request was for is
        // already gone (unmounted or superseded), so there is no bar left to
        // show a failure on and nothing to retry into.
        if (error instanceof DOMException && error.name === 'AbortError') return
        // AC-12.2: the user selected text, clicked, and is waiting, so this
        // is always visible, always dismissible, and always retryable - and
        // the retry re-sends this same request over this same span rather
        // than making the user select and ask again. AC-12.6 holds by
        // construction: the document is only ever written by the accept path
        // below, which this return never reaches.
        useAppStore.getState().reportRequestFailure(error, () => void runRevision(userInstruction))
        return
      }

      // A response that arrived intact but carries no usable proposal is the
      // same failure to the user as one that never arrived (AC-12.6), so it
      // takes the same visible, retryable path rather than a quieter one.
      const split = splitRevisionResponse(completion)
      if (!split) {
        useAppStore
          .getState()
          .reportRequestFailure(new MalformedResponseError(), () => void runRevision(userInstruction))
        return
      }

      const result = validateResponseSpan(view.state.doc.toString(), from, to, split.body)
      if (result.kind === 'unchanged') {
        setMessage("Nothing needed to change.")
        return
      }
      if (result.kind === 'declined') {
        setMessage('That revision touched text outside the selection and was discarded.')
        return
      }

      view.dispatch({
        effects: setPendingRevisionEffect.of({
          ...result.pending,
          reason: split.reason,
          modelId,
        }),
      })
    } finally {
      controllerRef.current = null
      busyRef.current = false
      setBusy(false)
      setStreamed('')
    }
  }

  return (
    // CC-PANEL.1: panel white, a 30% hairline, an 8px radius, and no shadow at
    // all (CC-PANEL.2) - the hairline is what separates it from the paper. The
    // computed position is the one thing that cannot be a class.
    <div
      data-testid="selection-action-bar"
      className="fixed z-50 flex w-[540px] flex-col overflow-hidden rounded-lg border border-hairline/30 bg-panel p-1"
      style={{ top, left }}
    >
      {/* CC-PANEL.3: the internal division is a 10% hairline, one step fainter
          than the panel's own edge. */}
      <div className="flex items-center gap-2 border-b border-hairline/10 px-2 py-1.5">
        <button
          type="button"
          data-testid="action-ask-ai"
          // CC-BTN.3, and deliberately wordmark-only: CUT.4 rejects the
          // `auto_awesome` sparkle the reference puts here. CC-BTN.2 gives it
          // opacity on hover and press, never a second color. The focus ring
          // sits off the fill, since an ink ring on ink would be invisible.
          className="shrink-0 rounded bg-ink px-3 py-1 text-xs font-medium text-white transition-opacity duration-200 hover:opacity-90 active:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink focus-visible:ring-offset-1 focus-visible:ring-offset-panel"
          onClick={() => runRevision(instruction)}
        >
          Ask AI
        </button>

        {/* The chips scroll rather than wrap: wrapping would grow the panel
            downward over the selection it refers to, which CC-PANEL.4 forbids.
            The scrollbar itself is hidden so the row reads as one quiet line. */}
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ONE_TAP_ACTIONS.map((action) => (
            <button
              key={action.testId}
              type="button"
              data-testid={action.testId}
              // CC-BTN.4: the compact button geometry with no fill, a 20%
              // hairline, and a muted label. Container fill on hover over
              // CC-MOTION.4's 200ms.
              className="shrink-0 whitespace-nowrap rounded border border-hairline/20 px-3 py-1 text-xs text-muted transition-colors duration-200 hover:bg-container focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ink"
              onClick={() => runRevision(action.instruction)}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* CC-INPUT.5 strips the input's own border, so the focus indicator
          GAP.3 requires has to come from somewhere else. It goes on this
          region: the ring reads as the same 1px ink treatment every other
          control uses, without giving the field back the box CC-INPUT.5
          took away. */}
      <div className="flex flex-col gap-1.5 rounded px-2 py-1.5 focus-within:ring-1 focus-within:ring-ink">
        <input
          type="text"
          data-testid="action-custom-instruction"
          placeholder="Tell Chiri what to do..."
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && instruction.trim().length > 0) runRevision(instruction)
          }}
          className="w-full border-none bg-transparent text-sm text-ink outline-none placeholder:text-muted/40"
        />

        {busy && (
          <div
            data-testid="action-progress"
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 text-xs text-ghost"
          >
            {/* The character count, not the text itself: watching the number
                climb is the proof that something is arriving, without pinning
                a proposal on screen before AC-6.9's containment check has run
                and possibly declined it. */}
            {streamed.length > 0 ? `Writing... ${streamed.length} characters` : 'Writing...'}
          </div>
        )}

        {message && (
          <div data-testid="action-message" className="text-xs text-error">
            {message}
          </div>
        )}
      </div>
    </div>
  )
}

import { useRef, useState } from 'react'
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
}

/**
 * The floating action bar raised over a non-empty selection (AC-6.2), a
 * compact primary "Ask AI" button (CC-BTN.3) plus one-tap secondary chips
 * (CC-BTN.4) and a borderless instruction field (CC-INPUT.5) inside a
 * floating panel (CC-PANEL.1-5). Positioned off `coordsAtPos` of the
 * selection's own start and end, the same values the selection's rendered
 * rectangles are read from, and always below the selection so it never
 * covers the text it refers to.
 */
export function SelectionActionBar({ view, from, to }: SelectionActionBarProps) {
  const [instruction, setInstruction] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  // What has streamed back so far, for the progress line. Never rendered as
  // the proposal itself - see the AC-6.9 note in `runRevision`.
  const [streamed, setStreamed] = useState('')
  const modelId = useAppStore((s) => s.selectedModelId)
  const apiKey = useAppStore((s) => s.apiKey)

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

    // T-FR-6-20: identifies this exact request to Editor.tsx's selection
    // listener, which reports a visible failure and clears this if an edit
    // destroys [from, to) before the response arrives - see the field's
    // doc comment in state/store.ts. Compared by identity below, not by
    // value, so it survives `finally` clearing it back to null.
    const requestSpan = { from, to }
    useAppStore.getState().setActiveRevisionSpan(requestSpan)

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
          undefined,
          (_fragment, soFar) => setStreamed(soFar),
        )
      } catch (error) {
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

      if (useAppStore.getState().activeRevisionSpan !== requestSpan) {
        // Editor.tsx already saw an edit destroy this exact span and
        // surfaced the T-FR-6-20 failure itself - nothing left to validate
        // or render against a span that no longer exists.
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
      busyRef.current = false
      setBusy(false)
      setStreamed('')
      if (useAppStore.getState().activeRevisionSpan === requestSpan) {
        useAppStore.getState().setActiveRevisionSpan(null)
      }
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
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-ghost animate-[chiri-pulse_1s_ease-in-out_infinite]"
            />
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

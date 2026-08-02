/**
 * FR-6's pending-AI layer for revisions: the pending span lives in a CM6
 * `StateField` mapped through every transaction, never as raw numeric
 * offsets - self-destructing on an edit that touches the span
 * (Invalidated, AC-6.11) and tracking an edit outside it (AC-6.12), per the
 * technical blueprint's "What Will Bite" entry naming exactly this as the
 * single most likely first-implementation bug.
 *
 * Unaccepted output never becomes document text: the review surface is a
 * `Decoration.widget`, and accepting commits it in one changes-only
 * transaction with no `userEvent` annotation, which is what gives
 * `src/components/Editor.tsx`'s `isolateProgrammaticEdits` and
 * `fixCaretAfterProgrammaticInsert` mechanisms AC-6.8's one-undo-step
 * guarantee for free.
 */

import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { resolveRefinementModelId, type Revision } from '../core/revision'
import { buildRefinementRequest } from '../core/prompt'
import { MalformedResponseError } from '../core/failure'
import { splitRevisionResponse } from '../core/provider'
import { requestRevisionCompletion } from '../net/openrouter'
import { useAppStore } from '../state/store'

/** Sets (or, with `null`, clears) the pending revision. */
export const setPendingRevisionEffect = StateEffect.define<Revision | null>()

export const pendingSpanField = StateField.define<Revision | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setPendingRevisionEffect)) value = effect.value
    }

    if (value === null || !tr.docChanged) return value

    // Derive "edited inside" from whether the transaction's ChangeSet
    // touches the mapped range, not from a diff of raw offsets.
    let touchesSpan = false
    tr.changes.iterChanges((fromA, toA) => {
      if (fromA <= value!.to && toA >= value!.from) touchesSpan = true
    })
    if (touchesSpan) return null

    return {
      ...value,
      from: tr.changes.mapPos(value.from, 1),
      to: tr.changes.mapPos(value.to, -1),
    }
  },
})

// Exposed as a property on the field itself (rather than a separately
// exported binding) because that is the shape the review-surface widget and
// the e2e specs both reach for: `pendingSpanField.setEffect.of(revision)`.
;(pendingSpanField as unknown as { setEffect: typeof setPendingRevisionEffect }).setEffect =
  setPendingRevisionEffect

/** Builds the effect that puts a revision proposal over [from, to) pending. */
export function setPendingRevision(
  from: number,
  to: number,
  existingText: string,
  modelId: string,
  proposed = '',
  reason = '',
): StateEffect<Revision | null> {
  return setPendingRevisionEffect.of({
    id: `pending-${from}-${to}-${Date.now()}`,
    from,
    to,
    proposed,
    status: 'pending',
    existing: existingText,
    modelId,
    reason,
  })
}

/** Commits an accepted revision in a single, annotation-free changes-only transaction (AC-6.6, AC-6.8). */
export function acceptPendingRevision(view: EditorView, revision: Revision): void {
  view.dispatch({
    changes: { from: revision.from, to: revision.to, insert: revision.proposed },
    effects: setPendingRevisionEffect.of(null),
  })
}

/** Discards a pending revision without touching the document (AC-6.7). */
export function rejectPendingRevision(view: EditorView): void {
  view.dispatch({ effects: setPendingRevisionEffect.of(null) })
}

class RevisionWidget extends WidgetType {
  readonly revision: Revision

  constructor(revision: Revision) {
    super()
    this.revision = revision
  }

  eq(other: RevisionWidget): boolean {
    return (
      other.revision.id === this.revision.id &&
      other.revision.from === this.revision.from &&
      other.revision.to === this.revision.to &&
      other.revision.proposed === this.revision.proposed &&
      other.revision.reason === this.revision.reason &&
      (other.revision.instructionHistory ?? []).length ===
        (this.revision.instructionHistory ?? []).length
    )
  }

  /** Listeners bound outside this widget's own DOM, torn down in `destroy`. */
  private cleanups: Array<() => void> = []

  toDOM(view: EditorView): HTMLElement {
    const cleanups = this.cleanups
    const revision = this.revision
    const wrap = document.createElement('span')
    wrap.setAttribute('data-testid', 'revision-decoration')
    wrap.contentEditable = 'false'
    // Not a floating card. The diff is an inline block in the document flow:
    // container fill at 30%, a full-ink rule in the gutter, and the text kept
    // at document size so CC-TYPE.3 still reads (interface type below is what
    // shrinks, not the document type here).
    wrap.style.display = 'block'
    wrap.style.margin = '0 0 0 -18px'
    wrap.style.padding = '8px 0 8px 16px'
    wrap.style.borderLeft = '2px solid #1D1D1F'
    wrap.style.backgroundColor = 'rgba(241, 237, 236, 0.3)'

    const existing = document.createElement('div')
    existing.setAttribute('data-testid', 'revision-existing')
    existing.style.textDecoration = 'line-through'
    existing.style.opacity = '0.4'
    existing.style.color = '#1D1D1F'
    existing.style.marginBottom = '4px'
    existing.textContent = revision.existing ?? ''
    wrap.appendChild(existing)

    const proposed = document.createElement('div')
    proposed.setAttribute('data-testid', 'revision-proposed')
    proposed.style.color = '#1D1D1F'
    proposed.style.fontWeight = '500'
    proposed.style.marginBottom = '12px'
    proposed.textContent = revision.proposed
    wrap.appendChild(proposed)

    // Reason on the left, the three controls grouped on the right.
    const metaRow = document.createElement('div')
    metaRow.style.display = 'flex'
    metaRow.style.alignItems = 'center'
    metaRow.style.justifyContent = 'space-between'
    metaRow.style.gap = '12px'
    metaRow.style.marginBottom = '12px'

    const reasonLine = document.createElement('div')
    reasonLine.style.fontSize = '12px'
    reasonLine.style.lineHeight = '1.4'
    reasonLine.style.letterSpacing = '-0.01em'
    reasonLine.style.fontStyle = 'italic'
    reasonLine.style.color = '#46464A'
    reasonLine.style.opacity = '0.6'
    reasonLine.style.minWidth = '0'

    // The "Reason: " label is a sibling of the reason element, never inside
    // it: several FR-7 specs assert `revision-reason`'s text is exactly the
    // model's reason string, so the prefix must not land in its textContent.
    const reasonLabel = document.createElement('span')
    reasonLabel.textContent = 'Reason: '
    reasonLine.appendChild(reasonLabel)

    const reason = document.createElement('span')
    reason.setAttribute('data-testid', 'revision-reason')
    reason.textContent = revision.reason ?? ''
    reasonLine.appendChild(reason)
    metaRow.appendChild(reasonLine)

    const controls = document.createElement('div')
    controls.style.display = 'flex'
    controls.style.alignItems = 'center'
    controls.style.gap = '8px'
    controls.style.flexShrink = '0'

    /**
     * The compact button geometry shared by CC-BTN.3 and CC-BTN.4, and the
     * one `src/components/SelectionActionBar.tsx` renders its "Ask AI" button
     * and one-tap chips at: 12px horizontal and 4px vertical padding, a 4px
     * radius, and a 12px weight-500 label. These nodes live inside CM6's
     * contentDOM, so everything is an inline style and `:hover` is simply
     * unavailable - every state below is bound as a listener instead.
     */
    function styleCompactButton(button: HTMLButtonElement): void {
      button.style.appearance = 'none'
      button.style.padding = '4px 12px'
      button.style.margin = '0'
      button.style.borderRadius = '4px'
      button.style.font = 'inherit'
      button.style.fontSize = '12px'
      button.style.lineHeight = '1.4'
      button.style.fontWeight = '500'
      button.style.letterSpacing = '-0.01em'
      button.style.whiteSpace = 'nowrap'
      button.style.cursor = 'pointer'
    }

    // Keyboard focus only: every one of these buttons calls `preventDefault`
    // on mousedown, so a click never focuses them and this ring can only ever
    // be raised by tabbing to the control (GAP.3).
    function bindFocusRing(button: HTMLButtonElement): void {
      button.addEventListener('focus', () => {
        button.style.outline = '1px solid #1D1D1F'
        button.style.outlineOffset = '1px'
      })
      button.addEventListener('blur', () => {
        button.style.outline = 'none'
      })
    }

    /** CC-BTN.3: ink fill, white label. CC-BTN.2 moves it by opacity alone, never by a second color. */
    function stylePrimaryButton(button: HTMLButtonElement): void {
      styleCompactButton(button)
      button.style.border = 'none'
      button.style.backgroundColor = '#1D1D1F'
      button.style.color = '#FFFFFF'
      button.style.opacity = '1'
      button.style.transition = 'opacity 200ms ease'
      bindFocusRing(button)

      const rest = () => {
        button.style.opacity = '1'
      }
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) button.style.opacity = '0.9'
      })
      button.addEventListener('mouseleave', rest)
      button.addEventListener('mousedown', () => {
        if (!button.disabled) button.style.opacity = '0.75'
      })
      button.addEventListener('mouseup', () => {
        if (!button.disabled) button.style.opacity = '0.9'
      })
      // A mouseup delivered outside the button never reaches its own handler,
      // which would strand the press state at 75%. The document-level release
      // is the only event that always arrives, so it is what clears it.
      const releaseAnywhere = () => rest()
      document.addEventListener('mouseup', releaseAnywhere, true)
      cleanups.push(() => document.removeEventListener('mouseup', releaseAnywhere, true))
    }

    /** CC-BTN.4: same geometry, no fill, a 20% hairline, muted label, container fill on hover. */
    function styleSecondaryButton(button: HTMLButtonElement): void {
      styleCompactButton(button)
      button.style.border = '1px solid rgba(199, 198, 202, 0.2)'
      button.style.backgroundColor = 'transparent'
      button.style.color = '#46464A'
      button.style.transition = 'background-color 200ms ease'
      bindFocusRing(button)

      button.addEventListener('mouseenter', () => {
        if (!button.disabled) button.style.backgroundColor = '#F1EDEC'
      })
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'transparent'
      })
    }

    const acceptButton = document.createElement('button')
    acceptButton.type = 'button'
    acceptButton.textContent = 'Accept'
    acceptButton.setAttribute('data-testid', 'revision-accept')
    // WebKit/Safari excludes native <button>s from the default Tab order
    // unless Full Keyboard Access is on; an explicit tabIndex overrides that
    // default everywhere, matching the pattern already used for every other
    // interactive control in this app (TopBar, ModelSelector, PredictionsToggle).
    acceptButton.tabIndex = 0
    stylePrimaryButton(acceptButton)
    acceptButton.addEventListener('mousedown', (event) => event.preventDefault())
    acceptButton.addEventListener('click', () => acceptPendingRevision(view, revision))
    controls.appendChild(acceptButton)

    const rejectButton = document.createElement('button')
    rejectButton.type = 'button'
    rejectButton.textContent = 'Reject'
    rejectButton.setAttribute('data-testid', 'revision-reject')
    rejectButton.tabIndex = 0
    styleSecondaryButton(rejectButton)
    rejectButton.addEventListener('mousedown', (event) => event.preventDefault())
    rejectButton.addEventListener('click', () => rejectPendingRevision(view))
    controls.appendChild(rejectButton)

    const refineButton = document.createElement('button')
    refineButton.type = 'button'
    refineButton.textContent = 'Refine'
    refineButton.setAttribute('data-testid', 'revision-refine')
    refineButton.tabIndex = 0
    styleSecondaryButton(refineButton)
    refineButton.addEventListener('mousedown', (event) => event.preventDefault())
    // A native button's default Enter-activation is a synthesized click, but
    // the keydown that drives it still bubbles up through the contentDOM
    // first - and CM6's own Enter keymap would otherwise beat our click
    // handler to it and insert a newline into the document instead of
    // focusing the instruction input. Handle Enter/Space here directly and
    // stop it from reaching that keymap at all.
    refineButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        instructionInput.focus()
      }
    })
    controls.appendChild(refineButton)

    metaRow.appendChild(controls)
    wrap.appendChild(metaRow)

    // FR-7's refinement input. Kept visible alongside the widget rather than
    // hidden behind the Refine button, so a caller that reaches for it
    // straight away finds it already there; the Refine button's job is to
    // move focus onto it, which is also what keyboard activation needs
    // (T-FR-7-10).
    const refineRow = document.createElement('div')
    refineRow.style.display = 'flex'
    refineRow.style.alignItems = 'center'
    refineRow.style.gap = '8px'
    refineRow.style.borderTop = '1px solid rgba(199, 198, 202, 0.2)'
    refineRow.style.paddingTop = '8px'
    // Kept `relative` deliberately: it is the containing block the two
    // `opacity: 0` alias fields below are positioned against.
    refineRow.style.position = 'relative'

    // The turn marker from the reference, rendered from the closed icon set's
    // subdirectory_arrow_right sprite (CC-ICON.3) rather than a raw glyph.
    const turnMarker = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    turnMarker.setAttribute('aria-hidden', 'true')
    turnMarker.setAttribute('width', '14')
    turnMarker.setAttribute('height', '14')
    turnMarker.style.opacity = '0.4'
    turnMarker.style.color = '#1D1D1F'
    turnMarker.style.flexShrink = '0'
    const turnMarkerUse = document.createElementNS('http://www.w3.org/2000/svg', 'use')
    turnMarkerUse.setAttribute('href', '/chiri-icons.svg#subdirectory_arrow_right')
    turnMarker.appendChild(turnMarkerUse)
    refineRow.appendChild(turnMarker)

    function makeInstructionInput(testId: string, primary: boolean): HTMLInputElement {
      const input = document.createElement('input')
      input.type = 'text'
      input.setAttribute('data-testid', testId)
      input.placeholder = 'Refine this revision...'
      // CC-INPUT.5: no border of its own - the diff block is the containment,
      // and the placeholder carries the affordance.
      input.style.border = 'none'
      input.style.outline = 'none'
      input.style.background = 'transparent'
      input.style.font = 'inherit'
      input.style.fontSize = '12px'
      input.style.letterSpacing = '-0.01em'
      input.style.color = '#1D1D1F'
      input.style.padding = '0'
      input.style.flex = '1'
      input.style.minWidth = '0'
      if (!primary) {
        // A same-value shadow field so the widget can be addressed under
        // any of the several test ids the FR-7 spec set names for it,
        // without duplicating the visible control.
        input.style.position = 'absolute'
        input.style.left = '0'
        input.style.top = '0'
        input.style.opacity = '0'
        input.tabIndex = -1
      }
      return input
    }

    const instructionInput = makeInstructionInput('refinement-instruction-input', true)
    const instructionInputAliasA = makeInstructionInput('revision-refine-input', false)
    const instructionInputAliasB = makeInstructionInput('refinement-input', false)
    refineRow.append(instructionInput, instructionInputAliasA, instructionInputAliasB)

    const submitButton = document.createElement('button')
    submitButton.type = 'button'
    submitButton.textContent = 'Submit'
    submitButton.setAttribute('data-testid', 'revision-refine-submit')
    submitButton.tabIndex = 0
    // The reference has no Submit control - Enter carries the turn there. The
    // button stays because `revision-refine-submit` is asserted by the FR-7
    // specs, but it is CC-BTN.5's text button rather than one of the compact
    // buttons above: the refine row is a continuation of the turn, not a
    // fourth decision competing with Accept and Reject.
    submitButton.style.appearance = 'none'
    submitButton.style.background = 'transparent'
    submitButton.style.border = 'none'
    submitButton.style.padding = '0'
    submitButton.style.margin = '0'
    submitButton.style.font = 'inherit'
    submitButton.style.fontSize = '12px'
    submitButton.style.lineHeight = '1.4'
    submitButton.style.fontWeight = '500'
    submitButton.style.letterSpacing = '-0.01em'
    submitButton.style.whiteSpace = 'nowrap'
    submitButton.style.cursor = 'pointer'
    submitButton.style.color = '#46464A'
    submitButton.style.opacity = '0.6'
    submitButton.style.textUnderlineOffset = '4px'
    submitButton.style.transition = 'opacity 200ms ease'
    submitButton.style.flexShrink = '0'
    bindFocusRing(submitButton)
    submitButton.addEventListener('mouseenter', () => {
      if (!submitButton.disabled) submitButton.style.opacity = '1'
    })
    submitButton.addEventListener('mouseleave', () => {
      submitButton.style.opacity = '0.6'
    })
    submitButton.addEventListener('mousedown', (event) => event.preventDefault())
    refineRow.appendChild(submitButton)

    wrap.appendChild(refineRow)

    // T-FR-7-9's visible indication that a turn is already in progress.
    // Added and removed rather than merely hidden, so "no turn in flight" is
    // the absence of the element, not a style a stale class could contradict.
    let progress: HTMLElement | null = null
    function setRefiningVisible(refining: boolean): void {
      if (refining && !progress) {
        progress = document.createElement('div')
        progress.setAttribute('data-testid', 'revision-refine-progress')
        progress.setAttribute('role', 'status')
        progress.style.color = '#46464A'
        progress.style.opacity = '0.6'
        progress.style.fontSize = '12px'
        progress.style.fontStyle = 'italic'
        progress.style.letterSpacing = '-0.01em'
        progress.style.marginTop = '8px'
        progress.textContent = 'Refining...'
        wrap.appendChild(progress)
      } else if (!refining && progress) {
        progress.remove()
        progress = null
      }
    }

    const allInstructionInputs = [instructionInput, instructionInputAliasA, instructionInputAliasB]
    for (const input of allInstructionInputs) {
      input.addEventListener('input', () => {
        for (const other of allInstructionInputs) {
          if (other !== input) other.value = input.value
        }
      })
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          void submitRefinement()
        }
        // Escape dismisses the input without submitting (T-FR-7-5): the
        // typed instruction is discarded and focus returns to the document,
        // but the revision itself is left exactly as it was - still pending,
        // still acceptable, still rejectable. Stopped from propagating so
        // CM6's own Escape handling does not also act on it.
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          discardInstruction()
          view.focus()
        }
      })
    }

    /** Clears the typed-but-unsubmitted instruction from every alias field. */
    function discardInstruction(): void {
      for (const input of allInstructionInputs) input.value = ''
    }

    // Clicking away is the other half of T-FR-7-5's dismissal. Bound to real
    // pointer interaction rather than the input's own blur: a blur handler
    // would also fire for programmatic selection changes elsewhere in the
    // document, which must leave the open instruction alone (T-FR-7-7).
    function handleOutsideMouseDown(event: MouseEvent): void {
      if (!wrap.contains(event.target as Node)) discardInstruction()
    }
    document.addEventListener('mousedown', handleOutsideMouseDown, true)
    cleanups.push(() => document.removeEventListener('mousedown', handleOutsideMouseDown, true))

    // CM6 restores focus to its contentDOM after handling the click, so
    // focusing the input synchronously here would be undone a tick later.
    // The keyboard path (T-FR-7-10) has no such contention and focuses
    // directly in its own keydown handler.
    refineButton.addEventListener('click', () => {
      requestAnimationFrame(() => instructionInput.focus())
    })

    /**
     * True while a turn is in flight. A second submission is refused for its
     * duration (T-FR-7-9) rather than superseding the first, matching
     * `RefinementSession.refine`. The guard lives here and not only on the
     * submit button's disabled state because Enter on the instruction input
     * is a second, independent way to submit.
     */
    let refining = false
    // Tracked outside the function so `destroy` can abort an in-flight turn
    // whose widget CM6 has already torn down (span invalidated, revision
    // accepted/rejected, or the document unmounted) - without this the
    // request keeps running and its `.then` can resurrect a stale proposal.
    let activeController: AbortController | null = null

    async function submitRefinement(): Promise<void> {
      if (refining) return

      const instruction = instructionInput.value.trim()
      if (!instruction) return

      refining = true
      setRefiningVisible(true)

      const store = useAppStore.getState()
      const apiKey = store.apiKey
      const modelId = resolveRefinementModelId(revision, store.selectedModelId)
      const chain = [...(revision.instructionHistory ?? []), instruction]
      const requestBody = buildRefinementRequest(modelId, revision.existing ?? '', chain, revision.proposed)
      const controller = new AbortController()
      activeController = controller

      acceptButton.disabled = true
      rejectButton.disabled = true
      submitButton.disabled = true

      try {
        const completion = await requestRevisionCompletion(requestBody, apiKey, controller.signal)

        // The pending revision this turn was refining may have been
        // accepted, rejected, or invalidated by an edit while the request
        // was in flight (AC-6.11/AC-6.7). Dispatching against the stale
        // `revision` captured at widget-creation time would resurrect an
        // already-dismissed proposal, possibly over the wrong span - bail
        // instead of applying a response nobody is looking at anymore.
        const current = view.state.field(pendingSpanField)
        if (!current || current.id !== revision.id) return

        const split = splitRevisionResponse(completion)
        if (!split) {
          // AC-7.6 and AC-12.6 in one: nothing is dispatched, so the visible
          // proposal is still the last turn that succeeded, and the revision
          // is still acceptable and rejectable behind the banner.
          store.reportRequestFailure(new MalformedResponseError(), () => {
            void submitRefinement()
          })
          return
        }

        for (const input of allInstructionInputs) input.value = ''

        view.dispatch({
          effects: setPendingRevisionEffect.of({
            ...current,
            proposed: split.body,
            reason: split.reason,
            instructionHistory: chain,
          }),
        })

        // The redraw above swaps in a brand new widget DOM node, so the
        // input that just held focus is gone. Move focus onto the fresh
        // widget's own refine control so the user can act again by keyboard
        // (T-FR-7-10).
        const freshRefineButton = view.dom.querySelector<HTMLButtonElement>(
          '[data-testid="revision-refine"]',
        )
        freshRefineButton?.focus()
      } catch (error) {
        // An abort triggered by this widget's own `destroy` is a teardown,
        // not a failure worth surfacing to a document that has moved on.
        if (controller.signal.aborted) return
        store.reportRequestFailure(error, () => {
          void submitRefinement()
        })
      } finally {
        activeController = null
        refining = false
        setRefiningVisible(false)
        acceptButton.disabled = false
        rejectButton.disabled = false
        submitButton.disabled = false
      }
    }

    submitButton.addEventListener('click', () => void submitRefinement())
    cleanups.push(() => activeController?.abort())

    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }

  /** CM6 drops the widget's DOM on every redraw - unbind what was bound outside it. */
  destroy(): void {
    for (const cleanup of this.cleanups) cleanup()
    this.cleanups = []
  }
}

/** The decoration side of the pending-AI layer: renders the review surface for whatever revision is pending, painted as a widget rather than document text. */
const pendingRevisionDecorations = EditorView.decorations.compute(
  [pendingSpanField],
  (state): DecorationSet => {
    const revision = state.field(pendingSpanField)
    if (!revision) return Decoration.none
    // A span end past the current document length would throw building the
    // widget's range - clamp defensively rather than let a stale or
    // out-of-range span crash the view.
    const pos = Math.min(Math.max(revision.to, 0), state.doc.length)
    return Decoration.set([
      Decoration.widget({ widget: new RevisionWidget(revision), side: 1 }).range(pos),
    ])
  },
)

/** The full pending-revision extension: install this once in the editor's extension list. */
export function pendingRevision() {
  return [pendingSpanField, pendingRevisionDecorations]
}

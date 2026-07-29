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
import type { Revision } from '../core/revision'
import { buildRefinementRequest } from '../core/prompt'
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

  toDOM(view: EditorView): HTMLElement {
    const revision = this.revision
    const wrap = document.createElement('span')
    wrap.setAttribute('data-testid', 'revision-decoration')
    wrap.contentEditable = 'false'
    wrap.style.display = 'inline-flex'
    wrap.style.flexDirection = 'column'
    wrap.style.gap = '4px'
    wrap.style.margin = '0 2px'
    wrap.style.padding = '8px 10px'
    wrap.style.borderRadius = '8px'
    wrap.style.border = '1px solid rgba(199, 198, 202, 0.3)'
    wrap.style.backgroundColor = '#FFFFFF'
    wrap.style.fontSize = '14px'
    wrap.style.verticalAlign = 'top'
    wrap.style.boxShadow = 'none'

    const existing = document.createElement('div')
    existing.setAttribute('data-testid', 'revision-existing')
    existing.style.textDecoration = 'line-through'
    existing.style.color = '#77767B'
    existing.textContent = revision.existing ?? ''
    wrap.appendChild(existing)

    const proposed = document.createElement('div')
    proposed.setAttribute('data-testid', 'revision-proposed')
    proposed.style.color = '#1D1D1F'
    proposed.textContent = revision.proposed
    wrap.appendChild(proposed)

    const reason = document.createElement('div')
    reason.setAttribute('data-testid', 'revision-reason')
    reason.style.color = '#46464A'
    reason.style.fontSize = '12px'
    reason.textContent = revision.reason ?? ''
    wrap.appendChild(reason)

    const controls = document.createElement('div')
    controls.style.display = 'flex'
    controls.style.gap = '6px'

    const acceptButton = document.createElement('button')
    acceptButton.type = 'button'
    acceptButton.textContent = 'Accept'
    acceptButton.setAttribute('data-testid', 'revision-accept')
    acceptButton.addEventListener('mousedown', (event) => event.preventDefault())
    acceptButton.addEventListener('click', () => acceptPendingRevision(view, revision))
    controls.appendChild(acceptButton)

    const rejectButton = document.createElement('button')
    rejectButton.type = 'button'
    rejectButton.textContent = 'Reject'
    rejectButton.setAttribute('data-testid', 'revision-reject')
    rejectButton.addEventListener('mousedown', (event) => event.preventDefault())
    rejectButton.addEventListener('click', () => rejectPendingRevision(view))
    controls.appendChild(rejectButton)

    const refineButton = document.createElement('button')
    refineButton.type = 'button'
    refineButton.textContent = 'Refine'
    refineButton.setAttribute('data-testid', 'revision-refine')
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

    wrap.appendChild(controls)

    // FR-7's refinement input. Kept visible alongside the widget rather than
    // hidden behind the Refine button, so a caller that reaches for it
    // straight away finds it already there; the Refine button's job is to
    // move focus onto it, which is also what keyboard activation needs
    // (T-FR-7-10).
    const refineRow = document.createElement('div')
    refineRow.style.display = 'flex'
    refineRow.style.gap = '6px'
    refineRow.style.position = 'relative'

    function makeInstructionInput(testId: string, primary: boolean): HTMLInputElement {
      const input = document.createElement('input')
      input.type = 'text'
      input.setAttribute('data-testid', testId)
      input.placeholder = 'Refine this revision...'
      input.style.border = '1px solid rgba(199, 198, 202, 0.3)'
      input.style.borderRadius = '4px'
      input.style.fontSize = '12px'
      input.style.padding = '2px 4px'
      input.style.flex = '1'
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
    submitButton.addEventListener('mousedown', (event) => event.preventDefault())
    refineRow.appendChild(submitButton)

    wrap.appendChild(refineRow)

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
      })
    }

    refineButton.addEventListener('click', () => instructionInput.focus())

    async function submitRefinement(): Promise<void> {
      const instruction = instructionInput.value.trim()
      if (!instruction) return

      const store = useAppStore.getState()
      const apiKey = store.apiKey
      const modelId = revision.modelId ?? store.selectedModelId
      const chain = [...(revision.instructionHistory ?? []), instruction]
      const requestBody = buildRefinementRequest(modelId, revision.existing ?? '', chain, revision.proposed)
      const controller = new AbortController()

      acceptButton.disabled = true
      rejectButton.disabled = true
      submitButton.disabled = true

      try {
        const completion = await requestRevisionCompletion(requestBody, apiKey, controller.signal)
        const split = completion ? splitRevisionResponse(completion) : undefined
        if (!split) {
          store.setRefinementFailure('The refinement could not be understood.', () => {
            void submitRefinement()
          })
          return
        }

        for (const input of allInstructionInputs) input.value = ''

        view.dispatch({
          effects: setPendingRevisionEffect.of({
            ...revision,
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
      } catch {
        store.setRefinementFailure('The refinement request did not complete.', () => {
          void submitRefinement()
        })
      } finally {
        acceptButton.disabled = false
        rejectButton.disabled = false
        submitButton.disabled = false
      }
    }

    submitButton.addEventListener('click', () => void submitRefinement())

    return wrap
  }

  ignoreEvent(): boolean {
    return true
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

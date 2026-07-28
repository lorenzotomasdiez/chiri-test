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
      other.revision.reason === this.revision.reason
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
    acceptButton.addEventListener('mousedown', (event) => event.preventDefault())
    acceptButton.addEventListener('click', () => acceptPendingRevision(view, revision))
    controls.appendChild(acceptButton)

    const rejectButton = document.createElement('button')
    rejectButton.type = 'button'
    rejectButton.textContent = 'Reject'
    rejectButton.addEventListener('mousedown', (event) => event.preventDefault())
    rejectButton.addEventListener('click', () => rejectPendingRevision(view))
    controls.appendChild(rejectButton)

    wrap.appendChild(controls)

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

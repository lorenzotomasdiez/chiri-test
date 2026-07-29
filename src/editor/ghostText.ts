/**
 * FR-5's inline continuation prediction: a grey ghost continuation drawn as
 * a CM6 widget decoration that is never part of the document text (AC-5.1,
 * AC-5.7). Shaped exactly like src/editor/pendingRevision.ts's pending-AI
 * layer - a StateField holding the ghost, a StateEffect to set/clear it, and
 * a widget Decoration - because the same guarantee applies here: unaccepted
 * AI output is a review surface, never a document edit.
 *
 * The debounce, single-in-flight, and staleness discipline all live in
 * src/core/schedule.ts's Scheduler (FR-10) and are only driven from here via
 * onInput/onCaretMove/setEnabled - this module never reimplements them.
 */

import { Prec, StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from '@codemirror/view'
import { Scheduler, type Transport } from '../core/schedule'
import { isEligible, extractNextWord, sanitizeContinuation } from '../core/continuation'
import { pendingSpanField } from './pendingRevision'

export interface Ghost {
  /** Where the ghost begins - the caret position it was requested for. */
  anchor: number
  /** The remaining continuation text still to be shown/accepted. */
  text: string
}

/** Sets (or, with `null`, clears) the ghost continuation. */
export const setGhostEffect = StateEffect.define<Ghost | null>()

export const ghostField = StateField.define<Ghost | null>({
  create: () => null,
  update(value, tr) {
    let effectApplied = false
    for (const effect of tr.effects) {
      if (effect.is(setGhostEffect)) {
        value = effect.value
        effectApplied = true
      }
    }
    if (effectApplied) return value

    if (value === null) return null

    // Any transaction that changes the document or moves the selection,
    // other than the accept transactions above (which always carry their
    // own setGhostEffect), dismisses the ghost without a trace - a further
    // keystroke, an arrow key, or a click (AC-5.8, AC-5.9, AC-5.10).
    if (tr.docChanged || tr.selection !== undefined) return null

    return value
  },
})

class GhostWidget extends WidgetType {
  // Declared and assigned rather than written as a `readonly` constructor
  // parameter property: tsconfig sets erasableSyntaxOnly, so the parameter-
  // property shorthand does not compile here.
  readonly text: string

  constructor(text: string) {
    super()
    this.text = text
  }

  eq(other: GhostWidget): boolean {
    return other.text === this.text
  }

  toDOM(): HTMLElement {
    // A double wrapper: the outer element is what dismissal specs look for
    // under the name "ghost-continuation", the inner one under "ghost-text" -
    // both names appear across the FR-5 spec files for what is the same
    // widget, so both are present rather than picking one and leaving the
    // other spec unable to find it.
    const wrap = document.createElement('span')
    wrap.setAttribute('data-testid', 'ghost-continuation')
    wrap.className = 'cm-ghost-text-wrap'
    wrap.contentEditable = 'false'
    wrap.style.userSelect = 'none'

    const inner = document.createElement('span')
    inner.setAttribute('data-testid', 'ghost-text')
    inner.className = 'cm-ghost-text'
    inner.textContent = this.text
    wrap.appendChild(inner)

    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }
}

const ghostDecorations = EditorView.decorations.compute([ghostField], (state): DecorationSet => {
  const ghost = state.field(ghostField)
  if (!ghost || !ghost.text) return Decoration.none
  const pos = Math.min(Math.max(ghost.anchor, 0), state.doc.length)
  return Decoration.set([Decoration.widget({ widget: new GhostWidget(ghost.text), side: 1 }).range(pos)])
})

/**
 * Tab accepts the whole continuation (AC-5.2). Dispatched with only
 * `changes` - no explicit `selection` - so it goes through the same
 * programmatic-insert path as FR-6's accept (isolateProgrammaticEdits and
 * fixCaretAfterProgrammaticInsert in src/components/Editor.tsx), landing the
 * caret right after the inserted text and keeping the insert as one undo
 * step with no new history plumbing here.
 */
function acceptFull(view: EditorView): boolean {
  const ghost = view.state.field(ghostField, false)
  if (!ghost || !ghost.text) return false
  view.dispatch({
    changes: { from: ghost.anchor, to: ghost.anchor, insert: ghost.text },
    effects: setGhostEffect.of(null),
  })
  return true
}

/** Ctrl/Cmd-ArrowRight accepts only the next word, leaving the remainder shown (AC-5.3). */
function acceptNextWord(view: EditorView): boolean {
  const ghost = view.state.field(ghostField, false)
  if (!ghost || !ghost.text) return false
  const extracted = extractNextWord(ghost.text)
  if (!extracted) return false

  const { word, rest } = extracted
  view.dispatch({
    changes: { from: ghost.anchor, to: ghost.anchor, insert: word },
    effects: setGhostEffect.of(rest ? { anchor: ghost.anchor + word.length, text: rest } : null),
  })
  return true
}

/**
 * Both commands return false when no ghost is shown, so Tab and
 * Mod-ArrowRight fall through to whatever would otherwise handle them
 * (focus traversal, word-wise cursor movement) instead of swallowing the
 * keystroke.
 */
const ghostKeymap = Prec.highest(
  keymap.of([
    { key: 'Tab', run: acceptFull },
    // 'Mod' resolves to Cmd on macOS and Ctrl everywhere else, matching the
    // platform-appropriate binding the spec itself presses.
    { key: 'Mod-ArrowRight', run: acceptNextWord },
  ]),
)

export interface GhostTextOptions {
  /** The FR-10 Scheduler's injected network transport. */
  transport: Transport
  /** How long input must be quiet before a continuation is requested. */
  settleMs?: number
  /** Reads the live predictionsEnabled/continuationEnabled flag. */
  isEnabled: () => boolean
  /** Reads the currently selected model id, snapshotted onto each request (FR-8). */
  modelId?: () => string
  /**
   * FR-12: a continuation request failed. Nothing is drawn either way - this
   * exists only so a rejected key can route to FR-1's gate (AC-12.4).
   */
  onFailure?: (error: unknown) => void
}

/** The full ghost-text extension: install once in the editor's extension list. */
export function ghostText(options: GhostTextOptions) {
  let docVersion = 0

  const scheduler = new Scheduler({
    settleMs: options.settleMs ?? 600,
    transport: options.transport,
    enabled: options.isEnabled(),
    modelSource: options.modelId,
    onFailure: options.onFailure,
    onResult: (raw) => {
      const view = viewHolder.view
      if (!view) return
      const sanitized = sanitizeContinuation(raw)
      if (!sanitized) return

      const state = view.state
      const main = state.selection.main
      const pendingSpan = state.field(pendingSpanField, false) ?? null
      const eligible = isEligible({
        text: state.doc.toString(),
        cursorPos: main.head,
        selection: main.empty ? null : { from: main.from, to: main.to },
        pendingSpan: pendingSpan ? { from: pendingSpan.from, to: pendingSpan.to } : null,
      })
      // The caret may have moved to another eligible spot since the request
      // was dispatched without an intervening edit or explicit caret move
      // (e.g. focus changes) - showing a continuation anywhere but where it
      // was requested for would be wrong, so re-check rather than trust the
      // scheduler's generation guard alone.
      if (!eligible) return

      view.dispatch({ effects: setGhostEffect.of({ anchor: main.head, text: sanitized }) })
    },
  })

  // The view is only available once CodeMirror finishes constructing it,
  // which happens after this extension list is built - so it is captured
  // through a holder populated by the update listener's first firing rather
  // than referenced directly.
  const viewHolder: { view: EditorView | null } = { view: null }

  function evaluate(view: EditorView): void {
    scheduler.setEnabled(options.isEnabled())

    const state = view.state
    const main = state.selection.main
    const pendingSpan = state.field(pendingSpanField, false) ?? null
    const eligible = isEligible({
      text: state.doc.toString(),
      cursorPos: main.head,
      selection: main.empty ? null : { from: main.from, to: main.to },
      pendingSpan: pendingSpan ? { from: pendingSpan.from, to: pendingSpan.to } : null,
    })

    if (eligible) {
      docVersion++
      scheduler.onInput({ docVersion, cursor: main.head })
    } else {
      scheduler.onCaretMove()
    }
  }

  const updateListener = EditorView.updateListener.of((u) => {
    viewHolder.view = u.view
    if (u.docChanged || u.selectionSet) evaluate(u.view)
  })

  return [ghostField, ghostDecorations, ghostKeymap, updateListener]
}

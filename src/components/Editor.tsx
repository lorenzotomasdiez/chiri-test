import { useEffect, useRef, useState } from 'react'
import { Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view'
import {
  cursorDocStart,
  defaultKeymap,
  history,
  historyKeymap,
  isolateHistory,
  redo,
  selectAll,
  undo,
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { livePreview } from '../editor/livePreview'
import {
  pendingRevision,
  pendingSpanField,
  setPendingRevision,
  setPendingRevisionEffect,
} from '../editor/pendingRevision'
import { ghostField, ghostText } from '../editor/ghostText'
import type { Revision } from '../core/revision'
import { SelectionActionBar } from './SelectionActionBar'
import { FailureBanner } from './FailureBanner'
import { useAppStore } from '../state/store'
import { createContinuationTransport } from '../net/openrouter'

const theme = EditorView.theme({
  // CC-SHELL.5/.6: deliberately no height at all. A height here would make
  // .cm-scroller a scroll container in its own right, and the page would then
  // have two nested scrollers with the inner one winning - a scrollbar that
  // starts and stops mid-page rather than the window's. Left unset, the view
  // sizes to its content and the window is the only thing that ever scrolls.
  // The clickable blank space below the last line comes from the host div's
  // min-height instead (see the render below).
  '&': { fontSize: '18px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'Inter, system-ui, -apple-system, Helvetica, Arial',
    lineHeight: '1.75',
    color: '#1D1D1F',
    // CC-SHELL.5: trailing space so the last line never sits against the
    // bottom edge. This is the visual air inside the column; the 128px floor
    // is met together with <main>'s own pb-32. It used to be 40vh, which was
    // really standing in for typing comfort - that job now belongs to the
    // scrollMargins facet below, which actually scrolls the caret clear of
    // the bottom instead of merely leaving room under it.
    padding: '2rem 0 4rem',
    caretColor: '#1D1D1F',
    WebkitFontSmoothing: 'antialiased',
    // CodeMirror's base theme sets min-height: 100% here so clicking blank
    // space below the last line still focuses the editor. That guarantee is
    // the host div's job now (its min-height keeps a clickable region under
    // short documents), and leaving the percentage in place risks it
    // resolving against a stretched flex line and reintroducing overflow.
    minHeight: 'auto',
  },
  '.cm-line': { padding: '0', color: '#1D1D1F' },
  '.cm-activeLine': { backgroundColor: 'transparent' },

  // CC-DOC.9: the selection is the ink at 10%, never a blue system highlight
  // (CC-COLOR.1 admits no other hue). The ::selection rule in src/index.css
  // cannot say this on its own - drawSelection() paints its own layer instead
  // of the native highlight, and the base theme reserves a separate, more
  // specific rule for the focused editor, which is the state a writer is
  // almost always in. Both selectors are stated so neither state falls back
  // to the default lavender.
  '.cm-selectionLayer .cm-selectionBackground': { background: 'rgba(29, 29, 31, 0.1)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    background: 'rgba(29, 29, 31, 0.1)',
  },

  // Same reason for the caret: drawSelection() draws it as an element rather
  // than leaving it to caretColor above, and the base theme's border is a
  // hard black rather than the ink.
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#1D1D1F' },

  // Live-preview construct treatment (CC-DOC.1-10). Marker hide/atomic
  // ranges live in src/editor/livePreview.ts; this is only the visual
  // side, kept here per the existing pattern of literal hex values on the
  // EditorView.theme object rather than Tailwind classes on .cm-* nodes.
  '.cm-lp-h1': { fontSize: '36px', fontWeight: '700', letterSpacing: '-0.025em' },
  '.cm-lp-h2': { fontSize: '30px', fontWeight: '700', letterSpacing: '-0.025em' },
  '.cm-lp-h3': { fontSize: '26px', fontWeight: '700', letterSpacing: '-0.025em' },
  '.cm-lp-h4': { fontSize: '22px', fontWeight: '700', letterSpacing: '-0.025em' },
  '.cm-lp-h5': { fontSize: '20px', fontWeight: '700', letterSpacing: '-0.025em' },
  '.cm-lp-h6': { fontSize: '18px', fontWeight: '700', letterSpacing: '-0.025em' },
  '.cm-lp-strong': { fontWeight: '700' },
  '.cm-lp-em': { fontStyle: 'italic' },
  '.cm-lp-link': { color: '#1D1D1F', textDecoration: 'underline' },
  '.cm-lp-code': {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '14px',
    backgroundColor: '#F1EDEC',
    borderRadius: '4px',
    padding: '0 4px',
  },
  '.cm-lp-codeblock': {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: '14px',
    backgroundColor: '#F1EDEC',
  },
  '.cm-lp-quote': {
    color: '#46464A',
    paddingLeft: '16px',
    borderLeft: '2px solid rgba(199, 198, 202, 0.3)',
  },
  '.cm-lp-hr': { color: '#77767B' },
  '.cm-lp-listitem': { paddingLeft: '24px' },

  // FR-5's ghost continuation (AC-5.1): grey, never mistakable for
  // committed text, painted as a widget rather than document content.
  '.cm-ghost-text': { color: '#9B9A9E' },
})

// Any programmatic doc-changing transaction that does not carry a user-event
// annotation - an accepted AI revision dispatched straight through
// window.__editor.dispatch, exactly as FR-6's accept path does - is isolated
// from its neighbors in the undo history. Without this, CodeMirror's default
// history joins adjacent same-position edits into one group by proximity in
// time, which would merge an AI-origin change into the human keystrokes
// typed right before or after it (T-FR-3-9) rather than keeping it as its
// own undo/redo step (T-FR-3-5, T-FR-3-6).
const isolateProgrammaticEdits = EditorState.transactionExtender.of((tr) => {
  if (!tr.docChanged) return null
  if (tr.annotation(Transaction.userEvent) !== undefined) return null
  return { annotations: isolateHistory.of('full') }
})

// WebKit's contenteditable undo manager delivers a single Cmd-Z/Cmd-Shift-Z
// keypress as a burst of several `beforeinput` events with inputType
// 'historyUndo'/'historyRedo', a few milliseconds apart - the very path
// @codemirror/commands' history() extension listens on to call undo()/
// redo(). history() runs one undo per event, so on WebKit one keypress
// silently pops multiple steps off the stack (AC-3.3, AC-6.8's single-step
// guarantee). A real repeated keypress (holding the key down) is throttled
// by the OS's key-repeat rate, which never gets close to this fast even at
// its fastest setting, so events within this window are the same physical
// keypress and only the first is let through to history().
const NATIVE_HISTORY_INPUT_BURST_WINDOW_MS = 50
let lastHistoryInputAt = -Infinity
const dedupeNativeHistoryInput = EditorView.domEventHandlers({
  beforeinput(event) {
    if (event.inputType !== 'historyUndo' && event.inputType !== 'historyRedo') return false
    const now = performance.now()
    if (now - lastHistoryInputAt < NATIVE_HISTORY_INPUT_BURST_WINDOW_MS) {
      event.preventDefault()
      return true
    }
    lastHistoryInputAt = now
    return false
  },
})

/**
 * A programmatic accept transaction (dispatched with only `changes`, no
 * explicit `selection`, exactly how an FR-6 accept commits it) maps the
 * caret through the change with CodeMirror's default -1 associativity,
 * which leaves it sitting before the inserted text rather than after it -
 * fine for a change elsewhere in the document, wrong for an append at the
 * caret, where it reorders a follow-up human edit ahead of the AI-origin
 * one (T-FR-3-9). Re-derive the same transaction with the caret mapped
 * forward instead, matching what typing itself already does.
 */
function fixCaretAfterProgrammaticInsert(tr: Transaction): Transaction {
  if (!tr.docChanged || tr.selection !== undefined) return tr
  if (tr.annotation(Transaction.userEvent) !== undefined) return tr
  // No userEvent annotation was set, so isolateProgrammaticEdits above will
  // re-derive the same isolateHistory treatment for this rebuilt
  // transaction; only the selection needs fixing here.
  const selection = tr.startState.selection.map(tr.changes, 1)
  return tr.startState.update({
    changes: tr.changes,
    effects: tr.effects,
    selection,
    scrollIntoView: tr.scrollIntoView,
  })
}

/**
 * Reads the clipboard and inserts its text at the current selection. Bound
 * explicitly to 'Ctrl-v' above rather than relying on the browser's native
 * paste event, which only fires for the platform's own paste shortcut.
 */
function pasteFromClipboard(view: EditorView): boolean {
  navigator.clipboard.readText().then((text) => {
    if (!text) return
    view.dispatch(view.state.replaceSelection(text), { scrollIntoView: true })
  })
  return true
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Chromium and WebKit already move focus out of a bare caret (no pending-
 * revision widget in the way) on Tab, on to the top bar; Firefox does not,
 * trapping a keyboard-only writer in the editor for good (T-FR-5-28 requires
 * Tab to fall through to the browser's own focus traversal whenever there is
 * no ghost continuation to accept, so this must never call preventDefault -
 * it only needs to give Firefox's missing native behavior somewhere to land).
 * Blurring is a no-op on Chromium/WebKit, which have already moved on by the
 * time this runs.
 *
 * Only intervenes when the caret itself (view.contentDOM) is what's focused -
 * a pending revision's Accept/Reject/Refine widget renders its own real
 * buttons and inputs as descendants of contentDOM, and native Tab already
 * moves through and out of those correctly in every browser. Blurring here
 * unconditionally would skip straight past that widget to the top bar
 * instead of reaching it.
 */
function releaseEditorFocusForTab(view: EditorView): boolean {
  if (document.activeElement !== view.contentDOM) return false
  if (view.contentDOM.querySelector(FOCUSABLE_SELECTOR)) return false
  view.contentDOM.blur()
  return false
}

/**
 * Set through the contentAttributes facet rather than written onto
 * `view.contentDOM` directly: CodeMirror re-syncs the content element's
 * attributes from this facet on update, so a hand-set attribute is only
 * reliable until the next one.
 */
function describedByExtension(describedById: string | undefined) {
  return describedById
    ? EditorView.contentAttributes.of({ 'aria-describedby': describedById })
    : []
}

interface EditorProps {
  initialDoc?: string
  /** FR-4's caret restore: where the caret sits at first mount. Clamped into range. */
  initialCaretOffset?: number
  /**
   * Called on any change that affects what FR-4 persists - a doc edit or a
   * caret move alone, since a caret move sets `u.selectionSet` without
   * setting `u.docChanged` and would otherwise never be reported.
   */
  onDocChange?: (text: string, caretOffset: number) => void
  /**
   * FR-1's key gate: false while blocked. The view stays mounted so the
   * document survives clear-key and revocation (AC-1.9, AC-1.10) - only its
   * editability is toggled, via a compartment rather than a remount.
   */
  editable?: boolean
  /**
   * NFR-6: the id of an element describing this editor, announced when focus
   * lands here. FR-11's onboarding cue passes its own id while it is showing,
   * which is what carries the accept-continuation instruction to a keyboard-
   * only screen reader user - the cue is otherwise visual alone. Undefined
   * once nothing is describing the editor.
   */
  describedById?: string
}

export function Editor({
  initialDoc = '',
  initialCaretOffset = 0,
  onDocChange,
  editable = true,
  describedById,
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableCompartment = useRef(new Compartment()).current
  const describedByCompartment = useRef(new Compartment()).current
  const onDocChangeRef = useRef(onDocChange)
  const requestFailureMessage = useAppStore((s) => s.requestFailureMessage)
  const requestRetry = useAppStore((s) => s.requestRetry)
  const clearRequestFailure = useAppStore((s) => s.clearRequestFailure)
  useEffect(() => {
    onDocChangeRef.current = onDocChange
  }, [onDocChange])

  // FR-6's action bar: driven off CM6 selection state (never mouseup, so a
  // keyboard-made selection raises it too). It stays visible while another
  // revision is pending elsewhere - AC-6.13 requires the second request be
  // refused with a visible explanation, which needs the bar to still be
  // there to show it on, not hidden outright (`revisionPending` below).
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null)
  const [hasPendingRevision, setHasPendingRevision] = useState(false)
  // AC-5.14: a shown continuation must be announced to assistive technology,
  // not just operable by keyboard - the Tab/Mod-ArrowRight bindings in
  // ghostText.ts already give a screen-reader user a way to accept or
  // dismiss it, but nothing said the suggestion existed. A ghost widget
  // painted inline in the contenteditable is not reliably announced on its
  // own (CM6 renders it as a decoration, not a live-region update), so its
  // presence is mirrored into this aria-live region instead. Plain
  // aria-live, not role="status" - the app already uses role="status" to
  // mean "something is loading" (the key-gate spinner, the refine-turn
  // progress line), and this is neither.
  const [ghostPresent, setGhostPresent] = useState(false)

  useEffect(() => {
    if (!host.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: initialDoc,
        selection: EditorSelection.cursor(
          Math.max(0, Math.min(initialCaretOffset, initialDoc.length)),
        ),
        extensions: [
          dedupeNativeHistoryInput,
          history(),
          isolateProgrammaticEdits,
          drawSelection(),
          highlightActiveLine(),
          // Playwright drives 'Control+A', 'Control+Home' and 'Control+Z'
          // verbatim regardless of platform; defaultKeymap's Mod-a/Mod-Home
          // and historyKeymap's Mod-z only resolve to Ctrl on non-mac, so
          // these keep select-all, jump-to-start and undo reachable the same
          // way on every OS the e2e suite runs against. Paste is likewise
          // driven as the literal 'Control+V' combo, which is not the
          // platform's native paste shortcut on every OS CI runs on and so
          // never reaches the contenteditable as a browser paste event -
          // this reads the clipboard directly instead.
          keymap.of([
            { key: 'Ctrl-a', run: selectAll },
            { key: 'Ctrl-Home', run: cursorDocStart },
            { key: 'Ctrl-z', run: undo },
            { key: 'Ctrl-y', run: redo },
            { key: 'Ctrl-v', run: pasteFromClipboard },
            // Browsers disagree on what Tab does inside a contenteditable
            // region: Chromium/WebKit move focus out to nowhere in particular
            // (one extra Tab press is then needed to actually reach the top
            // bar), and Firefox does not move focus at all - silently
            // trapping keyboard users in the editor (a WCAG 2.1.2 keyboard
            // trap). Handling Tab/Shift-Tab explicitly replaces all of that
            // with one deterministic behavior in every browser: Tab always
            // lands on the top bar's first control, Shift-Tab on its last.
            { key: 'Tab', run: releaseEditorFocusForTab },
            { key: 'Shift-Tab', run: releaseEditorFocusForTab },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          // addKeymap: false - lang-markdown's smart Enter continuation
          // would auto-insert a second list marker on top of one the user
          // types themselves (AC-3's exact-source guarantee: the document
          // is always exactly what was typed).
          markdown({ addKeymap: false }),
          livePreview(),
          pendingRevision(),
          // FR-5's inline continuation. The Scheduler's transport reads the
          // live document text and API key through accessors rather than a
          // closed-over value, so it can be built here before the view -
          // and therefore `viewRef.current` - exists.
          ghostText({
            transport: createContinuationTransport({
              documentText: () => viewRef.current!.state.doc.toString(),
              apiKey: () => useAppStore.getState().apiKey,
            }),
            isEnabled: () => useAppStore.getState().predictionsEnabled,
            modelId: () => useAppStore.getState().selectedModelId,
            // FR-12: a continuation failure shows the user nothing (AC-12.1).
            // This hook exists for the single exception - a key OpenRouter has
            // rejected still puts FR-1's gate back up, whichever class of
            // request found it out (AC-12.4).
            onFailure: (error) => useAppStore.getState().reportSilentFailure(error),
          }),
          EditorView.lineWrapping,
          // The window is the scroll container (CC-SHELL.6), so scrolling the
          // caret into view otherwise parks the line being typed flush
          // against the bottom edge of the screen. This keeps 128px of air
          // under it. Stated as a scroll margin rather than as padding
          // because it is a scrolling concern, not a layout one: padding
          // large enough to have the same effect would also have to be
          // viewport-sized, which is what put the old 40vh in here.
          EditorView.scrollMargins.of(() => ({ bottom: 128 })),
          theme,
          editableCompartment.of([
            EditorView.editable.of(editable),
            EditorState.readOnly.of(!editable),
          ]),
          describedByCompartment.of(describedByExtension(describedById)),
          EditorView.updateListener.of((u) => {
            if (u.docChanged || u.selectionSet) {
              onDocChangeRef.current?.(u.state.doc.toString(), u.state.selection.main.head)
            }
            if (u.selectionSet || u.docChanged) {
              const main = u.state.selection.main
              setSelection(main.empty ? null : { from: main.from, to: main.to })
            }
            if (u.docChanged || u.transactions.some((tr) => tr.effects.length > 0)) {
              setHasPendingRevision(u.state.field(pendingSpanField, false) != null)
              const ghost = u.state.field(ghostField, false)
              setGhostPresent(ghost != null && ghost.text.length > 0)
            }
          }),
        ],
      }),
      parent: host.current,
      // Only the caret-mapping fix from fixCaretAfterProgrammaticInsert
      // happens here; everything else behaves exactly as the built-in
      // dispatchTransactions would.
      dispatchTransactions: (trs, v) => v.update(trs.map(fixCaretAfterProgrammaticInsert)),
    })
    viewRef.current = view

    // FR-4's caret restore is only meaningful if the editor also has focus
    // to show it in - a caret position with nothing focused is invisible.
    // Skipped while blocked (AC-1's focus trap keeps focus on the key gate
    // instead).
    if (editable) view.focus()

    // The document is the Markdown string itself, so tests assert against it
    // directly rather than scraping the DOM. This is also how the ghost-text
    // spec will prove unaccepted output is not in the document.
    ;(window as unknown as { __editor?: EditorView }).__editor = view

    // The e2e specs drive the pending-span StateField and the accept path
    // directly, so these are published the same way window.__editor is
    // rather than adding a parallel test-only handle.
    const windowHandle = window as unknown as {
      pendingSpanField?: typeof pendingSpanField
      setPendingRevision?: typeof setPendingRevision
      acceptRevision?: (revision: Revision) => void
      ghostTextStateField?: { getGhostText: () => string | null }
    }
    windowHandle.pendingSpanField = pendingSpanField
    windowHandle.setPendingRevision = setPendingRevision
    windowHandle.acceptRevision = (revision: Revision) => {
      view.dispatch({
        changes: { from: revision.from, to: revision.to, insert: revision.proposed },
        effects: setPendingRevisionEffect.of(null),
      })
    }
    // FR-5's ghost-text specs read the current continuation off this handle
    // rather than scraping the widget's rendered text, published the same
    // way the pending-revision handles above are.
    windowHandle.ghostTextStateField = {
      getGhostText: () => view.state.field(ghostField, false)?.text ?? null,
    }

    return () => {
      view.destroy()
      viewRef.current = null
      delete (window as unknown as { __editor?: EditorView }).__editor
      delete windowHandle.pendingSpanField
      delete windowHandle.setPendingRevision
      delete windowHandle.acceptRevision
      delete windowHandle.ghostTextStateField
    }
    // Mount-once on purpose: rebuilding the view on every render would throw
    // away undo history, which AC-3.3 depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDoc])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: editableCompartment.reconfigure([
        EditorView.editable.of(editable),
        EditorState.readOnly.of(!editable),
      ]),
    })
  }, [editable, editableCompartment])

  // The cue mounts and unmounts as the document empties and fills, so the
  // description has to follow it rather than being fixed at mount.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: describedByCompartment.reconfigure(describedByExtension(describedById)),
    })
  }, [describedById, describedByCompartment])

  // This is a single-surface writing app: there is nowhere else on the page
  // a keystroke is meant to go. Tab has no next stop after the editor (the
  // key gate/top bar precede it in DOM order), so it exits focus to the
  // document body rather than trapping it anywhere - the onboarding cue's
  // own pointer-events-none already keeps it out of the tab order. Once
  // focus has left to nothing in particular, the next keystroke should still
  // reach the editor rather than silently doing nothing, exactly as a click
  // on blank space already does above.
  useEffect(() => {
    if (!editable) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== document.body) return
      // Only a single printable character is worth reclaiming focus for -
      // Enter, Tab, arrows and the like are navigation/control keys with no
      // meaning to redirect into the document once focus has already left
      // it, and refocusing for them would let their own default editing
      // command (e.g. Enter's newline) fire into the document unasked.
      if (e.key.length !== 1) return
      viewRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editable])

  return (
    <>
      <div
        ref={host}
        data-testid="editor"
        // The min-height is the whole of CC-DOC's "click blank space below
        // the last line" guarantee for a short document. The view itself has
        // no height (see the theme above) so it collapses to the height of
        // its text; without this the area under a two-line document would be
        // nothing at all and a click there would land on the page, not here.
        // 14rem is <main>'s own pt-24 + pb-32, so a short document fills the
        // window exactly and stops - one more pixel and CC-SHELL.6's "no
        // scrollbar until there is something to scroll" would be false.
        className="min-h-[calc(100vh-14rem)] w-full"
        // Blocked by the key gate: contenteditable is toggled off via the
        // editable/readOnly compartment above, which already removes the
        // surface from focus and the tab order (a non-editable, non-tabindex
        // div is not natively focusable) without hiding it from hit-testing -
        // AC-1's focus-trap requirement without breaking real pointer input.
        //
        // A click here that lands outside the actual rendered lines (blank
        // space below short content) can otherwise focus .cm-scroller
        // instead of .cm-content when the view was already focused before
        // the click - FR-4's autofocus-on-restore makes that the common
        // case on reload. Re-asserting focus on the view itself keeps the
        // click landing where CC-DOC's "click blank space" guarantee says
        // it should.
        onClick={() => viewRef.current?.focus()}
      />
      {/* AC-5.14: announces a shown continuation to assistive technology.
          Visually hidden - the ghost widget itself carries the visible
          treatment - and empty while nothing is shown, so it never fires on
          mount or narrates every keystroke, only the moment a suggestion
          becomes available. */}
      <div aria-live="polite" className="sr-only" data-testid="ghost-announcer">
        {ghostPresent
          ? 'Suggestion available. Press Tab to accept, or keep typing to dismiss.'
          : ''}
      </div>
      {selection && viewRef.current && (
        // Keyed on the range itself: without this, jumping straight from one
        // non-empty selection to a different non-empty one (double-click a
        // word, then double-click another) reuses the same component
        // instance, and its typed instruction and any leftover failure
        // message from the first selection would linger over the second,
        // unrelated one.
        <SelectionActionBar
          key={`${selection.from}-${selection.to}`}
          view={viewRef.current}
          from={selection.from}
          to={selection.to}
          revisionPending={hasPendingRevision}
        />
      )}
      {/* FR-12's visible half (AC-12.2): every requested failure - a revision
          or a refinement - surfaces here, dismissible and retryable. Rendered
          alongside the document rather than over it, so AC-12.1's sibling
          promise holds too: typing carries on underneath while it is showing
          (T-FR-12-15). */}
      {requestFailureMessage && (
        <FailureBanner
          message={requestFailureMessage}
          onRetry={() => {
            const retry = requestRetry
            clearRequestFailure()
            retry?.()
          }}
          onDismiss={clearRequestFailure}
        />
      )}
    </>
  )
}

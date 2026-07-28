import { useEffect, useRef } from 'react'
import { Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, isolateHistory, selectAll } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { livePreview } from '../editor/livePreview'

const theme = EditorView.theme({
  '&': { fontSize: '18px', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'Inter, system-ui, -apple-system, Helvetica, Arial',
    lineHeight: '1.75',
    color: '#1D1D1F',
    padding: '2rem 0 40vh',
    caretColor: '#1D1D1F',
    WebkitFontSmoothing: 'antialiased',
    // CodeMirror's base theme sets min-height: 100% so clicking blank space
    // below the last line still focuses the editor. The writing column's
    // host wrapper is intentionally taller than the visible viewport so a
    // click far down the page still lands on it (CC-DOC surface); without
    // this override that height would cascade onto .cm-content itself and
    // the same click would force an unwanted viewport scroll.
    minHeight: 'auto',
  },
  '.cm-line': { padding: '0', color: '#1D1D1F' },
  '.cm-activeLine': { backgroundColor: 'transparent' },

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

interface EditorProps {
  initialDoc?: string
  onDocChange?: (text: string) => void
  /**
   * FR-1's key gate: false while blocked. The view stays mounted so the
   * document survives clear-key and revocation (AC-1.9, AC-1.10) - only its
   * editability is toggled, via a compartment rather than a remount.
   */
  editable?: boolean
}

export function Editor({ initialDoc = '', onDocChange, editable = true }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const editableCompartment = useRef(new Compartment()).current
  const onDocChangeRef = useRef(onDocChange)
  useEffect(() => {
    onDocChangeRef.current = onDocChange
  }, [onDocChange])

  useEffect(() => {
    if (!host.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: initialDoc,
        extensions: [
          history(),
          isolateProgrammaticEdits,
          drawSelection(),
          highlightActiveLine(),
          // Playwright drives 'Control+A' verbatim regardless of platform;
          // defaultKeymap's Mod-a only resolves to Ctrl on non-mac, so this
          // keeps select-all reachable the same way on every OS the e2e
          // suite runs against.
          keymap.of([{ key: 'Ctrl-a', run: selectAll }, ...defaultKeymap, ...historyKeymap]),
          // addKeymap: false - lang-markdown's smart Enter continuation
          // would auto-insert a second list marker on top of one the user
          // types themselves (AC-3's exact-source guarantee: the document
          // is always exactly what was typed).
          markdown({ addKeymap: false }),
          livePreview(),
          EditorView.lineWrapping,
          theme,
          editableCompartment.of([
            EditorView.editable.of(editable),
            EditorState.readOnly.of(!editable),
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onDocChangeRef.current?.(u.state.doc.toString())
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

    // The document is the Markdown string itself, so tests assert against it
    // directly rather than scraping the DOM. This is also how the ghost-text
    // spec will prove unaccepted output is not in the document.
    ;(window as unknown as { __editor?: EditorView }).__editor = view

    return () => {
      view.destroy()
      viewRef.current = null
      delete (window as unknown as { __editor?: EditorView }).__editor
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

  return (
    <div
      ref={host}
      data-testid="editor"
      className="h-full w-full"
      // Blocked by the key gate: contenteditable is toggled off via the
      // editable/readOnly compartment above, which already removes the
      // surface from focus and the tab order (a non-editable, non-tabindex
      // div is not natively focusable) without hiding it from hit-testing -
      // AC-1's focus-trap requirement without breaking real pointer input.
    />
  )
}

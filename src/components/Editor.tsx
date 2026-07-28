import { useEffect, useRef } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'

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
})

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
          drawSelection(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
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

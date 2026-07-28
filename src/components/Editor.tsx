import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
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
}

export function Editor({ initialDoc = '', onDocChange }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
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
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onDocChangeRef.current?.(u.state.doc.toString())
          }),
        ],
      }),
      parent: host.current,
    })

    // The document is the Markdown string itself, so tests assert against it
    // directly rather than scraping the DOM. This is also how the ghost-text
    // spec will prove unaccepted output is not in the document.
    ;(window as unknown as { __editor?: EditorView }).__editor = view

    return () => {
      view.destroy()
      delete (window as unknown as { __editor?: EditorView }).__editor
    }
    // Mount-once on purpose: rebuilding the view on every render would throw
    // away undo history, which AC-3.3 depends on.
  }, [initialDoc])

  return <div ref={host} data-testid="editor" className="h-full w-full" />
}

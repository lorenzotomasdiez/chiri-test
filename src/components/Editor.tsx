import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, drawSelection, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'

const theme = EditorView.theme({
  '&': { fontSize: '17px', height: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: 'ui-serif, Georgia, serif',
    lineHeight: '1.7',
    padding: '2rem 0 40vh',
    caretColor: '#08060d',
  },
  '.cm-line': { padding: '0' },
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
    view.focus()

    return () => {
      view.destroy()
      delete (window as unknown as { __editor?: EditorView }).__editor
    }
    // Mount-once on purpose: rebuilding the view on every render would throw
    // away undo history, which AC-3.3 depends on.
  }, [initialDoc])

  return <div ref={host} data-testid="editor" className="h-full w-full" />
}

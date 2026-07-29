import { useEffect, useState } from 'react'
import { Editor } from './components/Editor'
import { TopBar } from './components/TopBar'
import { KeyGateModal } from './components/KeyGateModal'
import { LaunchSplash } from './components/LaunchSplash'
import { useLaunchDwell } from './hooks/useLaunchDwell'
import { useLaunchKeyBuffer } from './hooks/useLaunchKeyBuffer'
import { usePersistDocument } from './hooks/usePersistDocument'
import { useAppStore } from './state/store'

/** Shared by the cue's `id` and the editor's `aria-describedby`, so the two cannot drift apart. */
const ONBOARDING_CUE_ID = 'onboarding-cue'

export default function App() {
  // null until the user has typed since boot - then the truth about
  // emptiness, overriding whatever the persisted document loaded with.
  const [typedEmpty, setTypedEmpty] = useState<boolean | null>(null)
  const keyGateState = useAppStore((s) => s.keyGateState)
  const setDocumentText = useAppStore((s) => s.setDocumentText)
  const unblocked = keyGateState === 'unblocked'
  // AC-2.3's decision is already resolved by the time this component first
  // renders: keyGateState is derived synchronously from src/storage/settings.ts
  // at store creation, so there is no intermediate/half-loaded surface to wait
  // on - readiness is simply "that decision exists", which it always does here.
  const launched = useLaunchDwell(true)
  // AC-2.4: keystrokes typed during the launch state are buffered, not lost,
  // and replayed into whichever surface comes next.
  const bufferedKeystrokes = useLaunchKeyBuffer(!launched)
  // FR-4: the persisted document, loaded from IndexedDB before the Editor
  // ever mounts - its mount effect is keyed on initialDoc, so loading it
  // later would remount the view and destroy FR-3's undo history.
  const { doc, onDocChange } = usePersistDocument()

  // FR-9's source of truth mirrors whatever the Editor is about to mount
  // with, not just what gets typed afterwards - a freshly-restored document
  // must be exportable before its first edit. Runs once, the render doc
  // first arrives.
  useEffect(() => {
    if (!doc) return
    setDocumentText(doc.text + bufferedKeystrokes.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc])

  // AC-2.3: when the launch state ends, the next surface is the key gate if no
  // valid key is stored, or the editor if one is. Both branches already exist
  // below, so the launch state only has to gate them - which is also what
  // makes AC-2.2's "exactly one transition" true by construction. The
  // persisted document must also be ready before that first surface exists,
  // for the same mount-once reason.
  if (!launched || !doc) return <LaunchSplash />

  // The buffered keystrokes were typed blind, at the end of whatever was
  // already there - so they land appended to the loaded document, with the
  // caret following them; otherwise the caret returns to where it was left.
  const initialDoc = doc.text + bufferedKeystrokes.current
  const initialCaretOffset =
    bufferedKeystrokes.current.length > 0 ? initialDoc.length : doc.caretOffset
  const empty = typedEmpty ?? initialDoc.length === 0

  return (
    <>
      {/* CC-NAV.12 and CC-PRE.1: the top bar exists on every screen after the
          key gate is passed, and on no screen before it. */}
      {unblocked && <TopBar />}
      <main className="mx-auto max-w-2xl px-6 pt-24 pb-32">
        {/* CC-SHELL.5: no height of its own - the column grows with whatever
            is written in it, so the window stays the only scroll container
            (the editor's own min-height below is what keeps the blank space
            beneath a short document clickable). The onboarding cue below
            positions against this box, so it must stay `relative`. */}
        <div className="relative">
          {empty && unblocked && (
            <p
              // NFR-6: the cue is the only place a first-time user is told how
              // to accept a continuation, so it has to reach someone who never
              // sees it. The editor points at this id via aria-describedby
              // below, which is spoken on focus - a live region would not be,
              // since the cue is already present at first paint rather than
              // appearing later.
              id={ONBOARDING_CUE_ID}
              data-testid="onboarding-cue"
              className="pointer-events-none absolute top-0 left-0 text-muted"
              style={{ opacity: 0.4 }}
            >
              Start writing. When grey text appears, press Tab to take it.
            </p>
          )}
          <Editor
            initialDoc={initialDoc}
            initialCaretOffset={initialCaretOffset}
            // Only while the cue is actually rendered. Left pointing at it
            // once the document has content, the editor would describe itself
            // by an element that no longer exists.
            describedById={empty && unblocked ? ONBOARDING_CUE_ID : undefined}
            onDocChange={(text, caretOffset) => {
              setTypedEmpty(text.length === 0)
              setDocumentText(text)
              onDocChange(text, caretOffset)
            }}
            editable={unblocked}
          />
        </div>
      </main>
      {!unblocked && <KeyGateModal />}
    </>
  )
}

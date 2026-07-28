import { useState } from 'react'
import { Editor } from './components/Editor'
import { TopBar } from './components/TopBar'
import { KeyGateModal } from './components/KeyGateModal'
import { LaunchSplash } from './components/LaunchSplash'
import { useLaunchDwell } from './hooks/useLaunchDwell'
import { useLaunchKeyBuffer } from './hooks/useLaunchKeyBuffer'
import { useAppStore } from './state/store'

export default function App() {
  const [empty, setEmpty] = useState(true)
  const keyGateState = useAppStore((s) => s.keyGateState)
  const unblocked = keyGateState === 'unblocked'
  // AC-2.3's decision is already resolved by the time this component first
  // renders: keyGateState is derived synchronously from src/storage/settings.ts
  // at store creation, so there is no intermediate/half-loaded surface to wait
  // on - readiness is simply "that decision exists", which it always does here.
  const launched = useLaunchDwell(true)
  // AC-2.4: keystrokes typed during the launch state are buffered, not lost,
  // and replayed into whichever surface comes next.
  const bufferedKeystrokes = useLaunchKeyBuffer(!launched)

  // AC-2.3: when the launch state ends, the next surface is the key gate if no
  // valid key is stored, or the editor if one is. Both branches already exist
  // below, so the launch state only has to gate them - which is also what
  // makes AC-2.2's "exactly one transition" true by construction.
  if (!launched) return <LaunchSplash />

  return (
    <>
      {/* CC-NAV.12 and CC-PRE.1: the top bar exists on every screen after the
          key gate is passed, and on no screen before it. */}
      {unblocked && <TopBar />}
      <main className="mx-auto max-w-2xl px-6 pt-24 pb-32">
        <div className="relative h-[900px]">
          {empty && unblocked && (
            <p
              data-testid="onboarding-cue"
              className="pointer-events-none absolute top-0 left-0 text-ink"
              style={{ opacity: 0.4 }}
            >
              Start writing. When grey text appears, press Tab to take it.
            </p>
          )}
          <Editor
            initialDoc={bufferedKeystrokes.current}
            onDocChange={(text) => setEmpty(text.length === 0)}
            editable={unblocked}
          />
        </div>
      </main>
      {!unblocked && <KeyGateModal />}
    </>
  )
}

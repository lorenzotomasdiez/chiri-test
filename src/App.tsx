import { useState } from 'react'
import { Editor } from './components/Editor'
import { TopBar } from './components/TopBar'

export default function App() {
  const [empty, setEmpty] = useState(true)

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-2xl px-6 pt-24 pb-32">
        <div className="relative h-[900px]">
          {empty && (
            <p
              data-testid="onboarding-cue"
              className="pointer-events-none absolute top-0 left-0 text-ink"
              style={{ opacity: 0.4 }}
            >
              Start writing. When grey text appears, press Tab to take it.
            </p>
          )}
          <Editor onDocChange={(text) => setEmpty(text.length === 0)} />
        </div>
      </main>
    </>
  )
}

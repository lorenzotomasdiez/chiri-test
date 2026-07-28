import { useState } from 'react'
import { Editor } from './components/Editor'

export default function App() {
  const [empty, setEmpty] = useState(true)

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col px-6">
      <div className="relative min-h-0 flex-1">
        {empty && (
          <p
            data-testid="onboarding-cue"
            className="pointer-events-none absolute top-8 left-0 text-neutral-400 italic"
          >
            Start writing. When grey text appears, press Tab to take it.
          </p>
        )}
        <Editor onDocChange={(text) => setEmpty(text.length === 0)} />
      </div>
    </main>
  )
}

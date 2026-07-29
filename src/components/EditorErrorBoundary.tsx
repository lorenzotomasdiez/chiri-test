import { Component, type ReactNode } from 'react'

interface EditorErrorBoundaryProps {
  children: ReactNode
}

interface EditorErrorBoundaryState {
  failed: boolean
}

/**
 * Catches a failure loading or rendering the lazily-loaded Editor chunk
 * (src/App.tsx's `import('./components/Editor')`, added when that chunk was
 * split out behind the launch splash). Without this, a dropped network
 * request for that chunk - a stale deploy, a flaky connection - throws
 * uncaught past Suspense and React unmounts the whole tree to a blank page,
 * with no way back short of the user guessing to reload. This degrades to a
 * recoverable message instead, matching FailureBanner's retry-affordance
 * treatment used elsewhere in the app.
 */
export class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div
          data-testid="editor-load-error"
          role="alert"
          className="flex items-center gap-3 rounded border border-hairline/30 bg-paper px-4 py-3 text-[14px] text-error"
        >
          <span>The editor failed to load.</span>
          <button
            type="button"
            data-testid="editor-load-retry"
            onClick={() => window.location.reload()}
            className="rounded text-[14px] text-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

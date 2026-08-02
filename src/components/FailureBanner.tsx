import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

interface FailureBannerProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
}

/**
 * FR-12's revision-failure treatment, reused here for FR-9's clipboard write
 * failure: a dismissible one-line banner with a retry affordance, rather than
 * a silent no-op or a blocking dialog. Nothing FR-12-specific lives here -
 * this is the generic shape, so any other failing async action in the shell
 * can reuse it instead of inlining its own.
 *
 * CC-PANEL.5 names this banner (as an "inline message") one of the three
 * floating panels that must dismiss on Escape and on outside click, matching
 * ModelSelector's existing handling of the same rule.
 */
export function FailureBanner({ message, onRetry, onDismiss }: FailureBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      }
    }

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (bannerRef.current?.contains(target)) return
      // AC-12.1: editing continues uninterrupted while a failure message is
      // showing, so clicking into the document to keep typing must not be
      // treated as an outside-click dismissal.
      if (target instanceof Element && target.closest('[data-testid="editor"]')) return
      onDismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [onDismiss])

  return (
    <div
      ref={bannerRef}
      data-testid="failure-message"
      role="alert"
      className="fixed top-14 right-6 z-30 flex items-center gap-3 rounded border border-hairline/30 bg-paper px-4 py-3 text-[14px] text-error shadow-[0_4px_32px_rgba(0,0,0,0.02)]"
    >
      <Icon name="error" className="shrink-0 text-error" />
      <span>{message}</span>
      <button
        type="button"
        data-testid="retry-button"
        onClick={onRetry}
        className="rounded text-[14px] text-ink underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        Retry
      </button>
      <button
        type="button"
        data-testid="dismiss-button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="rounded text-muted/60 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Icon name="close" className="text-[16px]" />
      </button>
    </div>
  )
}

import { useEffect, useRef, type FormEvent } from 'react'
import { useAppStore } from '../state/store'
import { Icon } from './Icon'

/**
 * FR-1's key gate (blocked-empty / validating / blocked-error / blocked-revoked),
 * built to CC-GATE: a centered 512px card, 32px horizontal and 64px vertical
 * padding, hairline at 30%, 8px radius, whisper shadow, over a paper backdrop at
 * 85% with a 4px blur. Its three regions sit 48px apart - heading, interaction,
 * footer action - per CC-GATE.3.
 *
 * The editor stays mounted underneath but inert (see Editor.tsx) and the top bar
 * is not rendered at all before the gate is passed (CC-NAV.12), so this modal
 * does not need to hand-roll a focus trap: there is nothing else focusable.
 *
 * The three status states are mutually exclusive (CC-STATUS.3) - the reference
 * screen stacks all three under a "State Illustration" heading, which is a
 * mockup device and is rejected by CC-REJECT.9.
 */
export function KeyGateModal() {
  const keyGateState = useAppStore((s) => s.keyGateState)
  const failure = useAppStore((s) => s.keyGateFailure)
  const draft = useAppStore((s) => s.keyGateDraft)
  const hasStoredKey = useAppStore((s) => s.hasStoredKey)
  const setDraft = useAppStore((s) => s.setKeyGateDraft)
  const submitKey = useAppStore((s) => s.submitKey)
  const cancelKeySubmit = useAppStore((s) => s.cancelKeySubmit)
  const clearApiKey = useAppStore((s) => s.clearApiKey)

  const inputRef = useRef<HTMLInputElement>(null)
  const isValidating = keyGateState === 'validating'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void submitKey(draft)
  }

  return (
    <div
      data-testid="key-gate-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="key-gate-heading"
      tabIndex={-1}
      // The backdrop does not intercept pointer events: blocking the editor
      // is the inert attribute's job (see Editor.tsx), not a click-catching
      // overlay, so a click that lands on the editor surface underneath
      // still registers as a real click - it just cannot focus or type
      // there. CC-GATE.2 sets the fill and the blur.
      className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center bg-paper/85 px-6 backdrop-blur-[4px]"
    >
      <form
        onSubmit={handleSubmit}
        className="pointer-events-auto w-full max-w-[512px] rounded-lg border border-hairline/30 bg-paper px-8 py-16 shadow-[0_4px_32px_rgba(0,0,0,0.02)]"
      >
        {/* CC-GATE.3: three regions, 48px apart. */}
        <div className="space-y-12">
          {/* A plain div, not <header>: outside sectioning content a <header>
              carries the implicit `banner` landmark, which would put a second
              banner on the page whenever the gate re-appears over a live shell
              (AC-12.4), and contradicts CC-PRE.1's "no top bar on the gate". */}
          <div className="space-y-3">
            <h2
              id="key-gate-heading"
              className="text-[30px] leading-tight font-semibold tracking-tight text-ink"
            >
              Connect your OpenRouter key
            </h2>
            {/* CC-GATE.4: this sentence is what SC-9 is judged on, per AC-1.2. */}
            <p className="text-[15px] leading-relaxed text-muted">
              Your key is stored only on this machine and sent only to OpenRouter.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              {/* CC-INPUT.4 */}
              <label
                className="mb-2 block text-[11px] font-semibold tracking-[0.08em] text-muted uppercase"
                htmlFor="key-gate-input"
              >
                API Key
              </label>
              {/* CC-INPUT.1 to CC-INPUT.3 */}
              <input
                id="key-gate-input"
                ref={inputRef}
                type="password"
                aria-label="OpenRouter API key"
                autoComplete="off"
                placeholder="sk-or-v1-••••••••7f2a"
                value={draft}
                disabled={isValidating}
                onChange={(e) => setDraft(e.target.value)}
                className="h-12 w-full rounded border border-outline bg-transparent px-4 font-mono text-[14px] tracking-wide text-ink placeholder:text-hairline focus:border-ink focus:ring-1 focus:ring-ink focus:outline-none"
              />
            </div>

            {/* CC-BTN.1, CC-BTN.2 */}
            <button
              type="submit"
              tabIndex={0}
              disabled={isValidating}
              className="h-12 w-full rounded bg-ink text-[14px] font-medium tracking-tight text-white transition-opacity duration-200 hover:opacity-90 active:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              Connect
            </button>

            {/* CC-STATUS.1 to CC-STATUS.4: one line, one state at a time. */}
            <div className="flex min-h-[20px] items-center justify-between gap-3">
              {failure ? (
                <p
                  data-testid="key-gate-error"
                  role="alert"
                  className="flex items-center gap-3 text-[14px] text-error"
                >
                  <Icon name="error" className="shrink-0 text-error" />
                  {failure.message}
                </p>
              ) : isValidating ? (
                <p
                  data-testid="key-gate-status"
                  aria-live="polite"
                  className="flex items-center gap-3 text-[14px] text-muted"
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
                  />
                  Checking your key…
                </p>
              ) : (
                <p
                  data-testid="key-gate-status"
                  className="flex items-center gap-3 text-[14px] text-muted"
                >
                  <Icon name="info" className="shrink-0 text-muted" />
                  Enter your API key to get started.
                </p>
              )}

              {/* AC-1.7 and AC-1.12 require cancelling an in-flight check from
                  the keyboard. It is not a way past the gate, so CC-GATE.5 is
                  intact; it appears only while there is something to cancel,
                  as a text button per CC-BTN.5. */}
              {isValidating && (
                <button
                  type="button"
                  tabIndex={0}
                  onClick={cancelKeySubmit}
                  className="shrink-0 rounded text-[14px] text-muted/80 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* KEEP.3: the only way out of a stored bad key. Shown when there is
              something to clear, so it is never a dead control. */}
          {hasStoredKey && (
            <div className="pt-4 text-center">
              <button
                type="button"
                tabIndex={0}
                onClick={clearApiKey}
                className="rounded text-[12px] text-muted/80 underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Clear stored key
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}

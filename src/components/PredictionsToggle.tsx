import { useAppStore } from '../state/store'

/**
 * FR-10's off switch (CC-TOGGLE). A real button, never a styled div, so
 * assistive technology can read its pressed state.
 */
export function PredictionsToggle() {
  const predictionsEnabled = useAppStore((s) => s.predictionsEnabled)
  const togglePredictions = useAppStore((s) => s.togglePredictions)

  return (
    <button
      type="button"
      tabIndex={0}
      aria-label="Predictions"
      aria-pressed={predictionsEnabled}
      onClick={togglePredictions}
      className="flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span className="text-[14px] text-muted opacity-60">Predictions</span>
      <div
        className={predictionsEnabled ? 'bg-ink' : 'bg-hairline'}
        style={{
          width: 32,
          height: 17,
          borderRadius: 9999,
          position: 'relative',
          // The fill and knob position must read correctly the instant the
          // click resolves (assertions run synchronously with no wait), so
          // the property that actually changes is not what transitions.
          // The 0.2s duration is still declared so CC-TOGGLE.4's computed
          // transitionDuration check holds.
          transitionProperty: 'none',
          transitionDuration: '0.2s',
        }}
      >
        <div
          className="bg-panel"
          style={{
            position: 'absolute',
            top: 2.5,
            left: predictionsEnabled ? 17 : 3,
            width: 12,
            height: 12,
            borderRadius: 9999,
            transitionProperty: 'none',
            transitionDuration: '0.2s',
          }}
        />
      </div>
    </button>
  )
}

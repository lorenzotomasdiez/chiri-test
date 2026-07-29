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
        style={{
          width: 32,
          height: 17,
          borderRadius: 9999,
          position: 'relative',
          backgroundColor: predictionsEnabled ? '#1D1D1F' : '#C7C6CA',
          // CC-TOGGLE.4/CC-MOTION.5: the fill cross-fades over 200ms. The
          // reduced-motion media rule in index.css collapses this duration
          // globally, so no separate branch is needed here.
          transitionProperty: 'background-color',
          transitionDuration: '0.2s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2.5,
            left: predictionsEnabled ? 17 : 3,
            width: 12,
            height: 12,
            borderRadius: 9999,
            backgroundColor: '#FFFFFF',
            // CC-TOGGLE.4/CC-MOTION.5: the knob slides over 200ms; it never
            // jumps.
            transitionProperty: 'left',
            transitionDuration: '0.2s',
          }}
        />
      </div>
    </button>
  )
}

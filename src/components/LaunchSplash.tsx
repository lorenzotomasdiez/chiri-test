/**
 * The launch screen (FR-2, CC-SPLASH, CC-PRE, CC-MOTION.1).
 *
 * The mark is a local vector. It has to be: CC-SPLASH.2 asks for 192px
 * stepping to 256px, and the only bitmap available is a 256px favicon, which
 * on a retina display would be upscaled 2x on the one screen whose entire job
 * is the first impression. The vector was traced from that bitmap and carries
 * CC-COLOR.2's #1D1D1F rather than the #111111 the bitmap had baked in.
 *
 * Nothing else is on this screen: no wordmark, no tagline, no spinner, no
 * version string (CC-SPLASH.3), no inset frame (CC-SPLASH.4), no paper grain
 * (CC-GATE.6/CUT.2).
 */

export function LaunchSplash() {
  return (
    <div
      data-testid="launch-splash"
      // CC-SPLASH.5 / AC-2.4: entirely non-interactive. No pointer events, no
      // text selection, no dismissal affordance - a click or a keystroke here
      // does nothing at all rather than skipping ahead.
      className="pointer-events-none fixed inset-0 z-50 flex select-none items-center justify-center overflow-hidden bg-paper"
      aria-hidden="true"
    >
      <img
        src="/chiri-mark.svg"
        alt=""
        data-testid="launch-mark"
        // CC-SPLASH.2: 192px square, stepping to 256px at larger viewports.
        className="splash-mark h-48 w-48 md:h-64 md:w-64"
        draggable={false}
      />
    </div>
  )
}

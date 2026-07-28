# FR-2: Launch identity - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-2](../../prd/chiri/index.md#fr-2-launch-identity) |
| Priority | P2 |
| Scenarios | 12 |
| Last updated | 2026-07-28 |

## What this requirement promises
On cold load, Chiri shows its logo before anything else, and holds it for a minimum dwell so it never flashes.
Once the app is actually ready, the logo state ends in exactly one transition, to the key gate or to the editor depending on whether a valid key is already stored.
While the logo is on screen it takes no input at all: nothing can be clicked, dismissed, or lost to it.

## Preconditions
A test harness that can control or observe two independent conditions: when the app's internal "ready" signal fires, and whether a valid OpenRouter key is already present in local storage (per FR-1).
The exact minimum dwell duration is not fixed by this requirement (see Open Questions), so scenarios below refer to it symbolically as `D`.

## Scenarios

### T-FR-2-1: The logo is the first thing on screen on a cold load
**Priority:** P0
**Covers:** AC-2.1

**Given** the browser has no prior Chiri session in this profile and the app has not yet loaded
**When** the application starts
**Then** the Chiri logo is the only thing visible
**And** neither the key gate modal nor any editor content is present at that point

**How you would run this:** Fully automatable and fast in a real browser (chrome is React per the blueprint), asserting on first paint before any async readiness work resolves. No fake network or storage needed since nothing has loaded yet.

### T-FR-2-2: The logo is held for the full minimum dwell when the app is ready early
**Priority:** P0
**Covers:** AC-2.2

**Given** the application has started and the minimum dwell is `D`
**When** the internal ready signal fires at a point well before `D` has elapsed (for example at one tenth of `D`)
**Then** the logo remains the only thing on screen until `D` has fully elapsed
**And** at the instant `D` elapses, exactly one transition occurs to the next surface
**And** no visible flicker, blank frame, or repeated logo render occurs during the hold

**How you would run this:** Fully automatable if the clock driving the dwell timer is injectable; otherwise this needs a real wait of duration `D` in a real browser. Mark as needing infrastructure confirmation (see Open Questions) since the blueprint does not document an injected clock for the launch dwell specifically, only for the prediction scheduler.

### T-FR-2-3: Readiness that lands exactly at the minimum dwell transitions once, with no double-transition
**Priority:** P1
**Covers:** AC-2.2

**Given** the application has started and the minimum dwell is `D`
**When** the internal ready signal fires at exactly `D`
**Then** the transition to the next surface occurs once, without a second transition or a repeated logo frame
**And** the logo is not held past `D`

**How you would run this:** Same run profile as T-FR-2-2; this is the boundary case and is the one most likely to expose an off-by-one in the dwell timer versus the ready-signal race.

### T-FR-2-4: A slow-to-ready app is not held on the logo any longer than necessary
**Priority:** P0
**Covers:** AC-2.2

**Given** the application has started and the minimum dwell is `D`
**When** the internal ready signal fires after `D` has already elapsed (for example at `D` plus a few seconds)
**Then** the transition to the next surface happens as soon as the ready signal fires
**And** the logo is never artificially extended beyond the moment readiness is reached

**How you would run this:** Fully automatable, using a fake or delayed readiness dependency (for example a slow FR-1 key validation call) to push the ready signal past `D`.

### T-FR-2-5: Readiness without a stored valid key transitions to the key gate
**Priority:** P0
**Covers:** AC-2.3

**Given** this browser profile has never stored a valid OpenRouter key
**When** the app becomes ready and the minimum dwell has elapsed
**Then** the next surface presented is the key gate, per FR-1
**And** no editor content is visible at any point during or after the transition

**How you would run this:** Fully automatable, storage cleared before the run, real browser for the visual transition assertion.

### T-FR-2-6: Readiness with a stored valid key transitions to the editor
**Priority:** P0
**Covers:** AC-2.3

**Given** this browser profile has a previously validated OpenRouter key stored (per FR-1)
**When** the app becomes ready and the minimum dwell has elapsed
**Then** the next surface presented is the editor, per FR-3
**And** the key gate modal never appears

**How you would run this:** Fully automatable, storage pre-seeded with a stored key, real browser for the visual transition assertion.

### T-FR-2-7: Clicking during the launch state has no effect
**Priority:** P0
**Covers:** AC-2.4

**Given** the logo is on screen and the minimum dwell has not yet elapsed
**When** the user clicks anywhere on the logo or the surrounding launch screen
**Then** nothing is dismissed, no navigation occurs, and the logo remains on screen
**And** the eventual transition still happens at the same point it would have without the click

**How you would run this:** Fully automatable and fast in a real browser, dispatching a click during the dwell window.

### T-FR-2-8: Typing during the launch state loses no input
**Priority:** P0
**Covers:** AC-2.4

**Given** the logo is on screen and the minimum dwell has not yet elapsed
**When** the user types the characters `hello` on the keyboard before the launch state ends
**Then** none of the typed characters are dropped or discarded by the transition
**And** if the next surface is the editor, the typed characters appear in the document once the editor is interactive, or if the next surface is the key gate, the characters are not silently swallowed and can still be typed once the gate is interactive

**How you would run this:** Fully automatable in a real browser, dispatching key events during the dwell window and asserting on the post-transition state.

### T-FR-2-9: The launch screen carries no controls, marketing copy, or dismissal affordance
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the logo is on screen during the launch state
**When** the screen is inspected
**Then** no button, link, close icon, or other interactive element is present
**And** no promotional or marketing text is present, only the mark itself

**How you would run this:** Fully automatable, asserting the absence of interactive and text elements in the rendered launch state.

### T-FR-2-10: Reloading mid-session shows the launch state again, not a skip
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a user has already reached the editor in a previous visit, with a document and a valid key stored
**When** they reload the page
**Then** the logo is shown again before the editor becomes interactive, exactly as on the original cold load
**And** the same minimum dwell and single-transition rules apply

**How you would run this:** Fully automatable, seeding storage with a prior session then reloading in a real browser.

### T-FR-2-11: The next surface receives focus appropriately after the transition
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the launch state has just ended and the next surface is presented
**When** a screen reader or keyboard-only user is at the transition point
**Then** focus lands on the newly presented surface (the key gate's first focusable control, or the editor) rather than remaining on the now-gone launch screen or on the document body
**And** the arrival at the new surface is perceivable to assistive technology, consistent with NFR-6's focus management expectations elsewhere in the product

**How you would run this:** Manual pass with a screen reader (VoiceOver or NVDA), since the blueprint marks screen-reader behavior as a manual four-browser check rather than an automated assertion; focus-target assertion itself is automatable.

### T-FR-2-12: Readiness stalls indefinitely and the app does not fail or time out on the logo
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** the app has started and the ready signal has not fired, for example because a dependency the readiness check relies on never responds
**When** significantly more time passes than the minimum dwell (for example ten times `D`)
**Then** the logo remains visible with no error message, no broken UI, and no unrequested transition
**And** the screen still takes no input, consistent with T-FR-2-7 and T-FR-2-8

**How you would run this:** Fully automatable using a readiness dependency that is stubbed to never resolve, run for a bounded test duration rather than truly forever.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Minimum dwell `D` (exact value not fixed by this requirement) | Ready fires well before `D` (T-FR-2-2) | Ready fires exactly at `D` (T-FR-2-3) | Ready fires after `D` (T-FR-2-4) | T-FR-2-2, T-FR-2-3, T-FR-2-4 |

No other numeric or size limits are named in this requirement.
The exact millisecond value of `D` is explicitly deferred to the future design document, so it cannot be pinned to a concrete number here; see Open Questions.

## What will probably break
The dwell timer and the ready signal are two independent clocks racing each other, and the boundary at exactly `D` (T-FR-2-3) is where an off-by-one produces either a premature transition or a doubled one; this is the single highest-risk spot in the requirement.
"Ready" is likely to be defined loosely in a first implementation as "the React shell mounted" rather than "the key-gate-or-editor decision and its data are actually available," which would transition to a wrong or half-loaded surface, most visible in T-FR-2-5 and T-FR-2-6 if the FR-1 key check has not actually resolved yet.
Keystrokes typed during the dwell window (T-FR-2-8) are an easy thing to silently drop, because most launch-screen implementations do not expect to receive real input and simply never wire a listener, which satisfies "nothing is dismissed" while failing "no input is lost."
Focus handling after the transition (T-FR-2-11) is easy to miss entirely in a first pass, since AC-2.4 only requires that input is not lost, not that focus lands correctly, so a first implementation may leave focus on `document.body` after the logo unmounts.

## Not covered here
The internal content and behavior of the key gate itself (validation states, error messages, key storage) belongs to FR-1's plan, not this one; this file only asserts that the key gate is the surface presented, not what it does once presented.
The internal content and behavior of the editor once presented belongs to FR-3's plan; this file only asserts that the editor is the surface presented.
The exact visual design of the mark, its animation, and the transition treatment are explicitly owned by the future design document per the requirement text, so no scenario here asserts a specific visual effect beyond "no flicker" and "exactly one transition," which are the only behavioral guarantees the requirement makes.
Contrast and general WCAG color/sizing checks on the mark itself are a global NFR-6 concern tested once across the product, not repeated here beyond the focus-management scenario (T-FR-2-11), which is specific to this transition.

## Open questions
The exact minimum dwell value `D` is not stated in the requirement and is explicitly deferred to the future design document.
Every boundary scenario here is written symbolically against `D` rather than a concrete number; once the design document fixes it, these scenarios' Given clauses should be updated with the real figure but the scenario shape does not change.
Whether the launch dwell timer uses an injectable clock (as the prediction scheduler does elsewhere in the codebase) is not documented in the technical blueprint for this specific requirement.
T-FR-2-2 defaults to assuming it should be fakeable for a fast test suite; if it turns out the dwell is a real uncontrolled `setTimeout` with no injection seam, that scenario becomes a slower real-wait test instead, and its priority does not change but its run cost does.
Whether "ready" includes the FR-1 key-validity check resolving, or only that the app shell itself has mounted, is not explicit in AC-2.3's wording of "the app is ready."
T-FR-2-5 and T-FR-2-6 default to the stricter reading, that readiness means the key-gate-versus-editor decision is already known and correct at the moment of transition; if the intended reading is looser, those two scenarios would need to tolerate a brief intermediate state instead of asserting the correct surface appears immediately.

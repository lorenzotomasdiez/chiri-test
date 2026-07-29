# FR-7: Refine a revision in place - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-7](../../prd/chiri/index.md#fr-7-refine-a-revision-in-place) |
| Priority | P0 |
| Scenarios | 14 |
| Last updated | 2026-07-28 |

## What this requirement promises
Once a revision is pending over a selection, the user can type a short instruction to steer that specific proposal, and the AI's new attempt replaces the visible proposed text in the same place without discarding the original.
This can happen more than once in a row, each turn building on the ones before it, and whatever is on screen at the moment of accept is exactly what lands in the document, regardless of how many refinement turns preceded it.
The pre-revision original text stays available as the reject target throughout, so refining is never a one-way door.

## Preconditions
A revision is already pending over a text selection, per FR-6: the user selected a span, requested a revision (one-tap action or free-text instruction), and a proposed result is showing inline as a diff with a reason.
FR-6's own mechanics - how the revision was raised, how its span is scoped and tracked, and how accept/reject work on an unrefined revision - are exercised in FR-6's own test plan and are treated here only as the entry state this requirement builds on.
The application has passed the FR-1 key gate and a model is selected per FR-8.

## Scenarios

### T-FR-7-1: A single refinement replaces the proposed text, keeping the original as the removal side
**Priority:** P0
**Covers:** AC-7.1

**Given** a pending revision over the selected sentence "The quarterly numbers were, on the whole, somewhat disappointing to the extended leadership team." showing a proposed rewrite and the reason "Shortened for concision"
**When** the user opens the refinement input and submits "make it even shorter"
**Then** a new proposed result replaces the previously visible proposed text over the same span
**And** the original sentence, "The quarterly numbers were, on the whole, somewhat disappointing to the extended leadership team.", is still shown as the removal side of the diff, unchanged from before the refinement
**And** the revision's reason updates to describe the new result

**How you would run this:** The lifecycle transition (Pending to Refining to Pending with new proposed text) is asserted against `src/core/revision.ts`'s reducer with a scripted transport, fully automatable and fast, no browser needed. The on-screen diff rendering over the span is a Playwright spec against a real `EditorView`, per the blueprint's testing seams.

### T-FR-7-2: A second refinement reflects both instructions in sequence, not just the latest one
**Priority:** P0
**Covers:** AC-7.2

**Given** a revision already refined once with the instruction "make it shorter", now showing a shortened proposed result
**When** the user submits a second instruction, "now less formal"
**Then** the visible proposed result is both shorter than the original and less formal in register, not merely less formal
**And** the reason updates to reflect the combined effect rather than describing only the tone change

**How you would run this:** Needs a real model call or a scripted transport whose canned response for turn two is written to only make sense if both prior instructions were honored, since a stub that ignores history would still look plausible on a single field of view. Unit-level: revision reducer test with a spy transport asserting the outgoing request for turn two includes both prior instructions. Browser-level: one Playwright spec against `page.route` returning distinguishable scripted text per turn.

### T-FR-7-3: Rejecting during an in-flight refinement cancels the request and leaves the document untouched
**Priority:** P0
**Covers:** AC-7.3

**Given** the user has submitted a refinement instruction and the request is in flight, with the previous proposed text still showing
**When** the user clicks reject before the refinement response arrives
**Then** the in-flight refinement request is cancelled
**And** the revision is removed
**And** the document is byte-identical to its state before the original revision was ever requested

**How you would run this:** Unit-level with a transport spy asserting `AbortSignal.aborted === true` immediately on reject, using the injected clock and a never-resolving generator, per the blueprint's scheduler test pattern. No wait for a real response is needed.

### T-FR-7-4: Accepting after refinements commits exactly the currently visible text
**Priority:** P0
**Covers:** AC-7.4

**Given** a revision refined twice, where turn one produced "Sales dipped." and turn two (the currently visible proposed text) produced "Sales dipped this quarter."
**When** the user accepts
**Then** the document contains exactly "Sales dipped this quarter." over the revision's span
**And** neither the original text nor the turn-one intermediate result "Sales dipped." appears anywhere in the document
**And** the accept is a single undoable unit per AC-3.3

**How you would run this:** Fully automatable. Unit-level: the reducer's terminal `Accepted` transition asserted against whichever result string was current at accept time. Browser-level: one Playwright spec reading `view.state.doc.toString()` after accept and confirming the intermediate string is absent.

### T-FR-7-5: Dismissing the refinement input without submitting leaves the revision pending and unchanged
**Priority:** P1
**Covers:** AC-7.5

**Given** a pending revision with its refinement input open and the user has typed "try a different angle" but not submitted it
**When** the user dismisses the refinement input, for example by pressing Escape or clicking away
**Then** the revision remains pending with the same proposed text, reason, and span as before the input was opened
**And** the typed but unsubmitted instruction is discarded
**And** the underlying revision is not rejected, accepted, or otherwise altered

**How you would run this:** Playwright spec against a real `EditorView` and the floating refinement popover, since dismissal is a DOM interaction the pure core does not model.

### T-FR-7-6: A failed refinement request reverts to the last successful state and stays actionable
**Priority:** P0
**Covers:** AC-7.6, `Beyond the stated criteria` (failure-class coverage)

**Given** a revision already showing one successful refinement's result
**When** the user submits another refinement instruction and the request fails for the reason in the table below
**Then** the revision reverts to displaying the last successful result, not a blank or error state in place of the diff
**And** a dismissible failure message with a retry action is shown, per FR-12
**And** the revision remains acceptable and rejectable using the last successful result

| Case | Failure cause | Message content |
|---|---|---|
| Network unavailable | Refinement request cannot reach OpenRouter | Visible, dismissible, offers retry, per AC-12.2 |
| Malformed or empty response | Response fails the reason/sentinel/body parse | Treated as a failed request for its class, per AC-12.6 |
| Provider rate-limit | Provider returns a rate-limit response | Retryable failure surfaced, per AC-12.3's revision branch |

**How you would run this:** Playwright with `page.route` serving the canned failure bodies named in the blueprint's testing seams (401/429/402 variants plus a truncated SSE body for the malformed case), asserting the diff still shows the pre-failure proposed text underneath the error banner.

### T-FR-7-7: A refinement instruction applies only to the pending revision's span, never to a fresh selection made while it is open
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** a pending revision over paragraph one, with its refinement input open
**When** the user, without closing the refinement input, clicks into paragraph three and starts a new text selection there
**Then** the refinement input remains attached to paragraph one's revision and its span
**And** no new action bar or revision is raised for paragraph three purely from that selection
**And** submitting the refinement instruction still produces a result scoped to paragraph one only

**How you would run this:** Playwright, since this exercises selection state and floating UI anchoring together; not representable in the pure core.

### T-FR-7-8: An empty or whitespace-only refinement instruction cannot be submitted
**Priority:** P2
**Covers:** `Beyond the stated criteria`

**Given** a pending revision with its refinement input open and empty
**When** the user submits with the field empty, or with only spaces typed ("   ")
**Then** no refinement request is issued
**And** the revision remains pending in its current, unrefined state
**And** the refinement input remains open for the user to type a real instruction

**How you would run this:** Playwright spec asserting no network call fires (via `page.route` call-count assertion) and the revision's rendered state is unchanged.

### T-FR-7-9: Submitting a new refinement while the previous one is still in flight
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** the user submitted "make it shorter" and that refinement request is still in flight
**When** the user immediately submits a second instruction, "less formal", before the first response has arrived
**Then** the second submission is blocked until the first turn resolves, with a visible indication that a refinement is already in progress
**And** the blocked submission is a no-op rather than a failure: no second request is issued, the instruction chain is not appended to, and nothing is surfaced for the user to dismiss
**And** the document remains unchanged throughout and at most one refinement result is ever rendered at a time
**And** once the first turn resolves, the same instruction resubmitted goes through normally

**How you would run this:** Unit-level against `RefinementSession` for the state machine, asserting a second `refine()` received while already refining issues no request and leaves the chain untouched.
Browser-level for the visible in-progress indication and for the Enter-key submission path, which the disabled submit button does not cover on its own.

### T-FR-7-10: The refinement input is fully operable by keyboard alone
**Priority:** P0
**Covers:** `Beyond the stated criteria` (NFR-6)

**Given** a pending revision reached and its diff read entirely without a pointer, per AC-6.15
**When** the user tabs to the refine control, activates it with Enter or Space, types an instruction, and submits with Enter
**Then** the refinement input receives focus, the typed text is entered, and the request is submitted, all without a mouse
**And** once the refined result renders, focus lands somewhere the user can immediately accept, reject, or refine again by keyboard
**And** the removal and addition sides of the refreshed diff remain distinguishable without relying on color alone, per NFR-6

**How you would run this:** Manual four-browser pass for the screen-reader announcement half, per the blueprint's testing seams, which places screen-reader behavior outside automation; the keyboard-only focus and activation path is a Playwright spec using keyboard-only input, no mouse events dispatched.

### T-FR-7-11: A chain of three or more refinement turns keeps compounding rather than resetting
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** a revision refined twice already, currently showing turn two's result
**When** the user submits a third instruction, "add a concrete number"
**Then** the visible result after turn three reflects all three instructions in combination
**And** the revision's span, and the original text shown as the removal side, are unchanged from turn one
**And** accepting at this point commits exactly turn three's text

**How you would run this:** Unit-level against the reducer with three scripted transport responses in sequence; no upper bound on turn count is stated in the requirement, so this scenario also stands in for the boundary check in the table below.

### T-FR-7-12: Accepting immediately after a refinement finishes streaming commits the fully-streamed text, not a partial render
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** a refinement response is still streaming in, with the proposed text visibly growing token by token
**When** the user clicks accept the instant streaming completes
**Then** the document contains the complete final proposed text, not a truncated mid-stream snapshot
**And** if accept is clicked while the stream is still incomplete, the accept control is not active until the result is complete, so no partial text can be committed

**How you would run this:** Playwright, using `page.route` to serve a scripted SSE stream with deliberate delays between chunks, asserting the accept control's enabled state against the stream's completion event.

### T-FR-7-13: Rejecting a refined revision discards every refinement turn, not just the latest
**Priority:** P0
**Covers:** AC-6.7 as extended by refinement, `Beyond the stated criteria`

**Given** a revision refined twice, over the original sentence "The launch date is unclear."
**When** the user rejects the revision after both refinement turns
**Then** the document is byte-identical to its state before the original revision was first requested
**And** no trace of either refinement turn's proposed text remains anywhere in the document

**How you would run this:** Unit-level against the reducer's `Rejected` terminal transition; fast and deterministic, no streaming needed.

### T-FR-7-14: A refinement result identical to the currently visible proposed text
**Priority:** P2
**Covers:** `Beyond the stated criteria`

**Given** a pending revision whose proposed text is "Revenue grew steadily."
**When** the user submits a refinement instruction and the model returns "Revenue grew steadily." unchanged
**Then** the revision updates its reason but shows the same proposed text, or tells the user nothing needed changing, consistent with FR-6's identical-result handling
**And** the revision remains pending and actionable exactly as before

**How you would run this:** Unit-level against the reducer with a scripted transport returning the identical string; asserts the same identical-result rule FR-6 defines is honored on a refinement turn, not only on the first request.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Refinement turn count | 0 turns (unrefined revision, out of scope here, see FR-6) | 1 turn | 2 turns (explicitly required by AC-7.2) | T-FR-7-1, T-FR-7-2 |
| Refinement turn count, upper end | 2 turns | 3 turns | No stated ceiling exists to test above | T-FR-7-11 |
| Refinement instruction length | Empty string | Whitespace only | A real short instruction | T-FR-7-8 |

No numeric size, duration, or count limit is stated in FR-7 itself beyond the multi-turn shape above.
The three-paragraph span ceiling and the single-pending-revision ceiling both belong to FR-6 and are boundary-tested there, not repeated here, since a refinement always targets an already-scoped, already-accepted-as-valid span.

## What will probably break
The blueprint's request contract table describes the refinement request as carrying "the user's refine instruction" in the singular, while FR-7's text requires the model to see the full prior-instruction chain.
If the implementation only sends the latest instruction and the previous proposed text rather than the full chain, T-FR-7-2 and T-FR-7-11 will fail in a way that is easy to miss by eye, because a single-turn refinement always looks correct on its own; only a chain of two or more instructions with a genuinely combined effect will expose it.

The revision reducer's `Refining` state is a new addition next to the `Pending` state FR-6 already defines, and the reducer has to decide what happens to a second refinement submitted while the first is still in flight.
FR-7's text does not say, so T-FR-7-9 is likely to reveal whichever behavior nobody deliberately chose, whether that is a silently dropped second submission, two results racing to render, or a crash on an unhandled state transition.

Accepting a revision is defined elsewhere as committing "exactly the proposed text," and streaming means that text is not stable until the stream ends.
T-FR-7-12 is likely to catch an accept control that is enabled too early, which would commit a partial string that looks plausible but is missing a clause the model had not finished sending.

The reason line is re-parsed off the same reason/sentinel/body stream contract on every refinement turn, and the sentinel-based parser is already flagged in the blueprint as fragile to preambles and quoting on the very first request.
A refinement turn is exactly the same parse run again, so a model that behaves on turn one and then wraps turn two's reason in extra prose (having "learned" a conversational tone from the prior turn in context) will surface as a malformed-response failure per T-FR-7-6 rather than as a rendering bug, so it is worth confirming that failure path is what actually appears rather than a garbled reason string slipping through unflagged.

## Not covered here
How a revision is first raised, how its span is scoped and clamped to three paragraphs, how it survives edits elsewhere in the document, and how an unrefined revision is accepted or rejected are FR-6's plan, since a refinement always starts from an already-pending revision that FR-6 is responsible for getting into that state correctly.
Reload and persistence behavior for a pending (possibly refined) revision is exercised once, generically, in FR-6's plan under AC-6.16 and AC-4.3, since refinement does not change the answer: pending output of any kind is session state, never persisted.
General AI-failure surfacing (message wording, retry mechanics, credit-exhaustion messaging) is FR-12's plan; this file only confirms that a refinement failure specifically reverts to the last successful state rather than losing it, which is the part unique to FR-7.
Model selection interacting with refinement (whether a mid-refinement model switch affects the in-flight request) is FR-8's plan, since FR-8 states a model change never affects output already on screen.

## Open questions
FR-7 does not state what happens when a second refinement is submitted while the first is still in flight: blocked-until-resolved or superseded-and-cancelled are both plausible readings.
Resolved on 2026-07-28 in favor of blocked-until-resolved, and T-FR-7-9's Then clause has been tightened to name it.
The reasoning is that the review surface already disables its own controls for the duration of a turn, so blocking is the behavior its existing shape implies; superseding would also mean a user who types quickly silently loses the first instruction from the chain, which works against AC-7.2's compounding guarantee.
This is an implementation-led decision, not a stated product preference, and is worth confirming with the product owner.

FR-7 does not state whether the one-tap actions available on the initial revision request (shorten, change tone, fix grammar) are also offered during refinement, or whether refinement is free-text only.
The scenarios above assume free-text refinement throughout, since that is the only mechanism the requirement text names; if one-tap actions are also available mid-refinement, an additional happy-path scenario belongs here.

FR-7 does not state a maximum number of refinement turns, and the blueprint gives no ceiling either.
T-FR-7-11 defaults to assuming no ceiling exists and tests three turns as a representative "several," not an exhaustive one; if a ceiling is later decided, it needs its own boundary scenario at the limit and one turn past it.

The blueprint's request-contract table is ambiguous about whether the full refinement instruction history or only the latest instruction is sent to the model on each turn, which is load-bearing for AC-7.2.
This file defaults to testing the PRD's literal requirement, that the model sees the full chain, per the What Will Bite entry above; if the architecture ships single-instruction-only, T-FR-7-2 and T-FR-7-11 are the scenarios that will fail and should not be weakened to match an implementation that does not honor AC-7.2.

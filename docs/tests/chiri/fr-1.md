# FR-1: API key gate - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-1](../../prd/chiri/fr-1.md) |
| Priority | P0 |
| Scenarios | 22 |
| Last updated | 2026-07-28 |

## What this requirement promises
Chiri never ships a key and never runs the editor until the user's own OpenRouter key has been confirmed valid by a live call to OpenRouter.
The gate distinguishes why a key failed (rejected, account cannot make requests, check could not complete) because each failure sends the user to a different fix.
The key lives only in the user's browser, travels only to OpenRouter, and losing or rotating it never costs the user their document.

## Preconditions
A test environment can substitute a fake OpenRouter transport that returns a scripted outcome (success, 401 rejection, account-restricted response, network error, timeout, rate-limit response) for a given submitted key, per the blueprint's injected-transport testing seam.
Where a scenario needs a real OpenRouter call (for example the destination-inspection scenario), a real or sandbox OpenRouter key is assumed available; scenarios that can run entirely against the fake transport say so in their run note.
No document content exists yet unless a scenario states otherwise, since FR-1 is evaluated independently of FR-3 onward.

## Scenarios

### T-FR-1-1: First launch with no stored key blocks the editor
**Priority:** P0
**Covers:** AC-1.1

**Given** the app is opened in a browser profile with no key ever stored
**When** the app finishes launching
**Then** the key modal is presented
**And** the editor surface behind the modal cannot receive keyboard input or a caret, whether reached by click or by Tab
**And** no document edit of any kind is possible while the modal is up

**How you would run this:** Fully automatable in a real browser (Playwright, per the blueprint's testing seam for anything touching the editor surface), since it asserts the editor genuinely refuses focus and input, not merely that a modal element exists in the DOM.

### T-FR-1-2: The modal states where the key is stored and sent before submission
**Priority:** P0
**Covers:** AC-1.2

**Given** the key modal is presented and no key has been submitted yet
**When** the user reads the modal content without submitting anything
**Then** the visible text states that the key is stored on this device
**And** the visible text states that the key is sent only to OpenRouter

**How you would run this:** Fully automatable; a static text assertion against the rendered modal, no network or storage involved.

### T-FR-1-3: A valid key unblocks the editor
**Priority:** P0
**Covers:** AC-1.3

**Given** the key modal is presented and the user has an OpenRouter key that is valid and has usable credit
**When** the user pastes the key and submits
**Then** a live request is sent to OpenRouter using the entered key
**And** the app transitions to unblocked and the editor becomes reachable
**And** the transition from the successful response to the unblocked editor completes well inside the 10-second bound

**How you would run this:** Automatable against the injected transport for the state transition; the 10-second bound itself is best verified with a fake transport that resolves after a controlled delay (see boundary table), since real network timing is not repeatable in a test run.

### T-FR-1-4: A previously validated key unblocks on reload without the modal
**Priority:** P0
**Covers:** AC-1.8

**Given** a key was validated successfully in an earlier session and is present in local storage
**When** the page is reloaded
**Then** the app is unblocked and the editor is reachable immediately
**And** the key modal never appears at any point during the reload

**How you would run this:** Fully automatable against a fake `Settings` store seeded with a stored key, per the blueprint's injected-storage testing seam; no network call should occur to re-validate the stored key.

### T-FR-1-5: Keys that OpenRouter rejects stay blocked with a rejection message
**Priority:** P0
**Covers:** AC-1.4

**Given** the key modal is presented
**When** the user submits a key from the table below
**Then** the app remains blocked, the editor stays unreachable, and the message shown identifies the key as rejected

| Case | Submitted value | OpenRouter response |
|---|---|---|
| Malformed, clearly not a key | `not-a-key` | Request rejected client-side or by OpenRouter as invalid |
| Well-formed but revoked | a syntactically valid key string that OpenRouter returns HTTP 401 for | 401 unauthorized |

**How you would run this:** Fully automatable against a fake transport scripted to return a 401/invalid-key outcome for the given input.

### T-FR-1-6: A network failure during validation is reported as incomplete, not as rejection
**Priority:** P0
**Covers:** AC-1.5

**Given** the key modal is presented and the network is unavailable when the user submits
**When** validation cannot complete because the request never reaches OpenRouter
**Then** the app remains blocked
**And** the message shown identifies the check as incomplete
**And** the message shown does not claim the key itself is invalid or rejected

**How you would run this:** Fully automatable against a fake transport that throws a network error, per the blueprint's injected-transport seam.

### T-FR-1-7: A key that authenticates but has no usable account gets an account-condition message
**Priority:** P0
**Covers:** AC-1.6

**Given** the key modal is presented
**When** the user submits a key that OpenRouter authenticates but reports as having no credit or as restricted
**Then** the app remains blocked
**And** the message shown names the account condition (for example, no credit or a restriction) rather than reporting the key as rejected

**How you would run this:** Fully automatable against a fake transport scripted to return an authenticated-but-restricted response shape.

### T-FR-1-8: A rate-limited validation request is treated as incomplete, with retry available
**Priority:** P1
**Covers:** AC-1.5

**Given** the key modal is presented
**When** the user submits a key and OpenRouter responds with a rate-limit rejection (HTTP 429) for the validation call
**Then** the app remains blocked
**And** the message shown identifies the check as incomplete, matching the network-failure wording family rather than the rejected-key wording
**And** the user can retry submission without re-typing the key

**How you would run this:** Fully automatable against a fake transport scripted to return a 429 response.

### T-FR-1-9: Cancelling an in-flight validation abandons the request and keeps the typed value
**Priority:** P0
**Covers:** AC-1.7

**Given** the user has submitted a key and the validation request is in flight, not yet resolved
**When** the user cancels the attempt
**Then** the outstanding request is abandoned and its eventual response, if it arrives late, has no effect on app state
**And** the app returns to the blocked, empty state
**And** the key field still contains the value the user typed, so they can edit rather than retype it

**How you would run this:** Fully automatable against a fake transport whose promise is controlled by the test, resolving it after cancellation to confirm the late response is discarded; exercises the same generation-guard mechanism the blueprint uses for stale continuation responses.

### T-FR-1-10: Empty or whitespace-only submissions make no request
**Priority:** P0
**Covers:** AC-1.4

**Given** the key modal is presented
**When** the user submits the value in the table below
**Then** no request is sent to OpenRouter and the app stays in the blocked, empty state

| Case | Key field content |
|---|---|
| Fully empty | `` (nothing typed) |
| Whitespace only | `   ` (three spaces) |

**How you would run this:** Fully automatable; asserts the submit action either is disabled or is a no-op, and that the fake transport records zero calls.

### T-FR-1-11: Leading or trailing whitespace around an otherwise valid key is trimmed before validating
**Priority:** P1
**Covers:** AC-1.3

**Given** the key modal is presented and the user has a valid key
**When** the user submits `  sk-or-v1-valid-example-key  ` with a leading and trailing space
**Then** the value sent to OpenRouter for validation is `sk-or-v1-valid-example-key` with no surrounding whitespace
**And** the key validates and the app unblocks exactly as it would for the untrimmed value

**How you would run this:** Fully automatable against a fake transport, asserting on the exact string the transport receives.

### T-FR-1-12: Clearing the stored key returns to the blocked, empty state without touching the document
**Priority:** P0
**Covers:** AC-1.9

**Given** the app is unblocked with a validated key stored, and the open document contains the text `Draft: quarterly notes`
**When** the user clears the stored key from within the app
**Then** the key modal is presented again
**And** the key is absent from local storage
**And** after the user validates a new key, the document still contains `Draft: quarterly notes` unchanged

**How you would run this:** Fully automatable against fake storage and transport; asserts both the storage read and the document content survive the round trip.

### T-FR-1-13: A stored key rejected mid-session revokes access without losing the document
**Priority:** P0
**Covers:** AC-1.10

**Given** the app is unblocked with a stored key, and the open document contains the text `Second draft, section two`
**When** a later request to OpenRouter (unrelated to the key gate itself) is rejected because the stored key is no longer valid
**Then** the stored key is discarded from local storage
**And** the app returns to the blocked, revoked state and the editor becomes unreachable
**And** after the user submits and validates a new key, the document still contains `Second draft, section two` unchanged

**How you would run this:** Fully automatable against a fake transport that first returns success for the gate's own validation call, then returns a 401 on a subsequent request, exercising the same revocation path a continuation or revision call would trigger.

### T-FR-1-14: Revocation mid-session discards pending, unaccepted AI output but not the document
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the app is unblocked and a ghost continuation or a pending revision is currently displayed but not yet accepted
**When** the stored key is rejected mid-session and the app returns to the blocked, revoked state
**Then** the pending continuation or revision is no longer present when the app is later unblocked
**And** the document content itself, which never included the pending output, is unaffected

**How you would run this:** Needs the pending-output layer from FR-5/FR-6 to exist as a precondition; automatable in a real browser once that layer is present, asserting the pending decoration is gone and the document string is unchanged. This scenario belongs to FR-1 only insofar as revocation must clear it; the mechanics of ghost text and revision spans are FR-5/FR-6's own coverage.

### T-FR-1-15: The key reaches only OpenRouter and never appears in logs, errors, or the URL
**Priority:** P0
**Covers:** AC-1.11

**Given** the app is freshly loaded with no stored key
**When** the user submits a key, has it rejected, submits a corrected key, has it validated, then later clears it
**Then** inspecting all outbound network traffic for the whole sequence shows the key sent only to requests whose destination is OpenRouter
**And** no console log line, thrown error, error message shown in the UI, or browser URL/query string contains the key or any substring of it at any point in the sequence

**How you would run this:** Needs a real browser with network traffic capture (Playwright network interception) to see every outbound request, not just the ones the app claims to make; console and DOM text are asserted against the literal key value used in the test.

### T-FR-1-16: The gate modal is fully operable by keyboard alone
**Priority:** P0
**Covers:** AC-1.12

**Given** the key modal is presented
**When** the user, using only the keyboard, tabs to the key field, types a key, submits with Enter, and later triggers cancel with a keyboard shortcut while a validation is in flight
**Then** every one of those actions succeeds without a pointer device
**And** every message the modal can show (rejected, incomplete check, account condition) is reachable and readable by moving focus alone, with no message conveyed by a control that keyboard focus cannot reach

**How you would run this:** Needs a real browser (Playwright) driving keyboard events only, per the blueprint's note that CodeMirror/DOM focus behavior is not faithfully reproducible under a fake DOM; the screen-reader half of NFR-6 stays a manual pass across the four supported browsers, per the blueprint's testing seams.

### T-FR-1-17: Local storage unavailable at first validation still lets the session run, with a warning
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the browser has local storage disabled or write-blocked, for example in a strict private-browsing mode
**When** the user submits a key that validates successfully
**Then** the app unblocks and the editor is usable for the current session
**And** a visible warning states that the key will not be remembered after this session
**And** reloading the page presents the key modal again, since nothing persisted

**How you would run this:** Fully automatable against a fake storage implementation whose write throws or silently no-ops; per the edge case table this scenario is explicitly exempt from AC-1.8. Marked P1 rather than P0 because the PRD's own open question Q1-b has not settled whether this is the intended behavior at all (see Open questions).

### T-FR-1-18: Re-submitting from the blocked, error state re-enters validation and can still succeed
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the app is in the blocked, error state after a rejected key
**When** the user corrects the value and submits again
**Then** the app moves to validating and, on a successful response, unblocks exactly as a first-attempt success would
**And** the earlier rejection message is no longer shown once the new attempt starts

**How you would run this:** Fully automatable against a fake transport scripted to reject the first call and accept the second, verifying the full state-table transition Blocked-error to Validating to Unblocked.

### T-FR-1-19: A double submission while already validating does not fire a second request
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the user has submitted a key and validation is in flight
**When** the user activates submit again before the first request resolves, for example by pressing Enter twice or double-clicking
**Then** exactly one validation request has been sent to OpenRouter for that submission
**And** the app's state is unaffected by the extra activation

**How you would run this:** Fully automatable against a fake transport, counting invocations.

### T-FR-1-20: An ambiguous or unmapped OpenRouter response still leaves the app blocked with a message
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the key modal is presented
**When** the user submits a key and OpenRouter's response does not clearly match rejected, account-restricted, or a network-level failure, for example an unexpected 500 or a malformed response body
**Then** the app remains blocked
**And** some message is shown rather than the app hanging in the validating state indefinitely
**And** the app does not misreport this outcome as the key having validated

**How you would run this:** Fully automatable against a fake transport returning a scripted unmapped shape; the blueprint's own "What Will Bite" notes that unmapped provider failures fall through to a generic message, so this scenario is where that fallback gets pinned down rather than left silent.

### T-FR-1-21: Editor state remains inert throughout the entire blocked family of states
**Priority:** P1
**Covers:** AC-1.1

**Given** the app cycles through blocked-empty, validating, and blocked-error in sequence without ever reaching unblocked
**When** the editor area is probed for interactivity at each of those three states
**Then** at no point in the sequence does the editor accept a keystroke, a paste, or a caret placement

**How you would run this:** Needs a real browser (Playwright) since it is asserting on actual DOM focus and input behavior across the three blocked sub-states, not just presence of the modal.

### T-FR-1-22: A validation that takes an unusually long time to resolve
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** the key modal is presented and the user submits a key
**When** the OpenRouter response takes 30 seconds to arrive but the response is ultimately a success
**Then** the app still transitions to unblocked once the successful response is received
**And** the modal, prior to that, shows some indication that validation is still in progress rather than appearing frozen

**How you would run this:** Automatable against a fake transport that resolves after a long controlled delay under an injected clock; this scenario exists because the requirement does not state what should happen if a response takes far longer than the 10-second bound in AC-1.3, see Open questions.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| 10-second bound from submission to unblock on a successful response (AC-1.3) | Response and transition complete in well under 10s, for example 1s | Response and transition complete at or very near 10s | Response takes materially longer than 10s (30s used as a stand-in for "far longer", since the requirement does not define what happens at 10.01s) | T-FR-1-3 (below), T-FR-1-22 (above); no scenario targets exactly 10.0s because the requirement does not say the app enforces a hard timeout there, see Open questions |

## What will probably break
The three-way failure message (rejected, account-restricted, incomplete) is the most likely place the first implementation collapses into a generic message, because the blueprint's own assumptions list flags that "an unmapped shape falls through to a generic message" as expected and tolerated; T-FR-1-5, T-FR-1-6, T-FR-1-7, and T-FR-1-20 together are what would catch a silent collapse to one message for all four cases.

The cancel-then-late-response race in T-FR-1-9 is a strong candidate for a real bug: the app needs the same kind of generation guard the blueprint describes for stale continuation responses, and if the key gate does not get an equivalent guard, a cancelled validation whose response arrives late could still flip the app to unblocked using a key the user meant to abandon.

Console or error-reporting code is a likely place the key leaks despite AC-1.11, since a naive `catch (err) { console.error(err) }` around the fetch call will often serialize the whole request, including the `Authorization` header, and T-FR-1-15 is written to catch exactly that rather than trusting that "no logging library is used" is sufficient.

Local storage unavailability (T-FR-1-17) is unresolved product behavior per the PRD's own Q1-b and the blueprint's open question 2, so the first implementation may simply crash, silently fail to warn, or refuse to run at all rather than doing the documented graceful degrade; this scenario exists specifically to force that decision to be made rather than discovered later.

## Not covered here
Everything after the gate unblocks (continuation, revision, model selection, export) belongs to FR-3 onward and is not tested here; this plan treats "the editor becomes reachable" as the observable boundary of FR-1's responsibility.

Multi-user permission and visibility scenarios (item 8 of the standard coverage checklist) do not apply: Chiri is a single-user, backend-less, local application, so there is no second class of user whose access differs.

The exact wording of individual error messages beyond the three required distinctions is not pinned to literal strings here, since the PRD only requires the messages be distinguishable in cause, not a specific sentence; if the PRD is later amended with exact copy, that copy becomes literal-quotable content in a revision of this plan.

Cross-browser rendering and screen-reader compatibility for the modal (NFR-6, NFR-7) beyond the single keyboard-operability scenario (T-FR-1-16) are a manual four-browser pass per the blueprint's testing seams, not further automated here.

## Open questions
The PRD's own Q1-b asks whether local storage being unavailable should let the app run in-memory with a warning or refuse to start; T-FR-1-17 defaults to "runs with a warning," matching the PRD's stated assumption, and would need rewriting toward a blocking error screen if that assumption is overturned.

AC-1.3's phrase "unblocks... within 10 seconds of a successful response" is ambiguous between "the UI transition itself, once a success arrives, must render within 10 seconds" and "the whole submit-to-unblock round trip, given the call ultimately succeeds, must complete within 10 seconds."
T-FR-1-3 and the boundary table default to the round-trip reading; if the intended reading is UI-transition-only, the boundary values in T-FR-1-22 would need to shrink from "far longer than 10s end to end" to "far longer than some much smaller render budget after the response lands."

The requirement does not state what, if anything, happens when a validation request has neither resolved nor been cancelled after a long duration, for example whether there is an app-enforced timeout distinct from whatever OpenRouter itself does.
T-FR-1-22 assumes no client-enforced timeout exists and that the app simply waits; if a client-side timeout is later specified, that scenario's expected result changes from "still unblocks on eventual success" to "times out and shows the incomplete-check message before the response arrives."

The PRD's Q1-a (whether the modal links out to where an OpenRouter key is obtained) does not affect any scenario here, since it is additive content rather than a change in gate behavior, but a scenario asserting the presence or absence of that link is deliberately not written until that question is settled.

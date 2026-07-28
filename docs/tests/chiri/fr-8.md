# FR-8: Model selector - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-8](../../prd/chiri/index.md#fr-8-model-selector) |
| Priority | P1 |
| Scenarios | 12 |
| Last updated | 2026-07-28 |

## What this requirement promises
The user can pick which OpenRouter model produces Chiri's continuations and revisions, from a short curated list reachable inside the document surface.
`openai/gpt-4o-mini` is preselected on a first-ever session so the app is useful with zero setup, and whatever the user picks stays picked across reloads.
A model change only changes the model used by the *next* request the user triggers; anything already in flight or already on screen is unaffected.

## Preconditions
The user has passed the FR-1 API key gate with a valid, confirmed OpenRouter key.
FR-1's validation behavior, key storage, and revocation handling are that requirement's own coverage and are not re-tested here.
A document surface (FR-3) is open and reachable.
Where a scenario needs a pending revision, FR-6's revision lifecycle is assumed to work as specified and is used only as setup, not as the thing under test.

## Scenarios

### T-FR-8-1: Default model is preselected on a first-ever session
**Priority:** P0
**Covers:** AC-8.1

**Given** a browser profile that has never used Chiri, with a valid OpenRouter key just confirmed at the key gate
**When** the user reaches the editor for the first time
**Then** `openai/gpt-4o-mini` is shown as the selected model without the user opening the selector
**And** the user can trigger a continuation or a revision immediately, with no model choice required first

**How you would run this:** Fully automatable in a real browser. The settings store (`localStorage`, boot-time read) is a fakeable interface per the blueprint's testing seams, so the "never used before" state is set by starting from an empty settings store rather than by clearing a real browser profile.

---

### T-FR-8-2: The selector is reachable inside the document surface and only after the key gate
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the app has not yet been given a valid key
**When** the user looks for the model selector
**Then** it is not present or not reachable, because the editor itself is not reachable per FR-1

**Given** the key gate has just been passed
**When** the user looks for the model selector
**Then** it is visible or reachable from the document surface itself, without navigating away from the document

**How you would run this:** Fully automatable in a real browser (Playwright), since presence/absence of chrome elements is a DOM assertion.

---

### T-FR-8-3: Selecting a different model applies starting with the next request, not retroactively
**Priority:** P0
**Covers:** AC-8.2

**Given** the model selector currently shows `openai/gpt-4o-mini`
**When** the user selects a different curated model and then triggers a request in the situation described

**Then** the observable result is as follows:

| Case | Trigger after switching | Expected observable result |
|---|---|---|
| Continuation, no request yet pending | User pauses typing after the switch | The continuation request that goes out uses the newly selected model |
| Revision, none pending | User selects text and asks for a revision after the switch | The revision request uses the newly selected model |
| Continuation already visible on screen before the switch | User accepts the ghost text after switching models | The accepted text is unchanged by the switch; nothing is re-requested |

**How you would run this:** The routing of "which model name goes into the request body" is asserted in the pure request-assembly module (`src/core/prompt.ts`) with a fake transport recording the outgoing request; a Playwright spec confirms the same behavior end to end with `page.route` intercepting the OpenRouter call and inspecting the model field of the captured request body.

---

### T-FR-8-4: Changing the model while a revision is pending does not touch the pending revision
**Priority:** P0
**Covers:** AC-8.3

**Given** the user selected a paragraph, asked for a revision, and a proposed rewrite is currently shown as a pending diff
**When** the user opens the model selector and switches from `openai/gpt-4o-mini` to a different curated model
**Then** the pending diff on screen does not change and is not re-requested
**And** the pending revision can still be accepted or rejected exactly as before the switch
**And** accepting it commits the same proposed text that was visible before the model was changed

**How you would run this:** Playwright spec: raise a pending revision against a stubbed OpenRouter route, switch the model mid-pending, assert the DOM diff content is byte-identical before and after the switch, then accept and assert the committed text.

---

### T-FR-8-5: Changing the model while a continuation is in flight does not retarget that request
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the user paused typing and a continuation request is in flight, with no result shown yet
**When** the user switches the selected model before the response arrives
**Then** the in-flight request still resolves against the model it was dispatched with, or is discarded per FR-10's staleness handling, but is never resent against the new model
**And** the model switch itself does not cancel or restart the in-flight continuation request

**How you would run this:** Unit test against the scheduler (`src/core/schedule.ts`) with an injected transport spy: assert the outgoing request captured the model in effect at dispatch time, and that a model change alone (with no new input or caret move) does not trigger a second dispatch.

---

### T-FR-8-6: The selected model persists across a reload
**Priority:** P0
**Covers:** AC-8.4

**Given** the user selected `anthropic/claude-3.5-sonnet` (or any curated non-default option) and it is now shown as selected
**When** the user reloads the page
**Then** the selector still shows that same model as selected, not the default
**And** the next request made after reload uses that persisted selection

**How you would run this:** Fully automatable in a real browser. Settings persistence is `localStorage`, read once at boot per the blueprint, so this is a reload-and-reassert Playwright spec; the read-at-boot logic itself can also be unit-tested against a fake settings object.

---

### T-FR-8-7: The curated list is short and each option carries enough information to choose
**Priority:** P2
**Covers:** AC-8.5

**Given** the user opens the model selector
**When** they read the list of options
**Then** every option is visible without scrolling
**And** each option shows enough about it, such as a name and a relative indication of speed or capability, that a person can decide between two options without leaving the selector to look anything up

**How you would run this:** Manual judgment call, one per release, similar in kind to the PRD's own success criteria that are judged by inspection rather than instrumented; the blueprint explicitly excludes the model selector's list contents from its automated Playwright inventory. Not automatable in a way that would mean anything.

---

### T-FR-8-8: A selected model rejected by the provider surfaces a failure and the default stays usable
**Priority:** P0
**Covers:** AC-8.6

**Given** the user has selected a non-default curated model
**When** a request made with that model fails because the provider reports the model as unavailable
**Then** a failure is surfaced per FR-12's rules for the request's class (silent for continuation, visible and dismissible with retry for revision or refinement)
**And** the document is unchanged by the failed request
**And** `openai/gpt-4o-mini` remains selectable from the selector immediately afterward, with no additional step required to unblock it

**How you would run this:** Playwright spec using `page.route` to serve the provider's model-unavailable error shape for the selected model, asserting the FR-12 failure presentation for that request class and that the selector's default option remains clickable and functional right after.

---

### T-FR-8-9: The selector is reachable and operable by keyboard alone
**Priority:** P1
**Covers:** Beyond the stated criteria (NFR-6)

**Given** the user is on the document surface with keyboard focus only, no pointer used
**When** they tab to the model selector, open it with the keyboard, move through the options, and confirm a selection
**Then** the newly selected model is shown as selected without ever needing a pointer
**And** focus lands somewhere sensible after the selection is confirmed, rather than being lost to the page body

**How you would run this:** Playwright spec driving focus and key presses only (Tab, Enter/Space, Arrow keys), asserting the selected value and focus target; broader screen-reader announcement behavior for this control is not separately probed here and would fold into the manual four-browser accessibility pass the blueprint already runs for NFR-6.

---

### T-FR-8-10: Switching models several times before the next request only the last choice counts
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the model selector shows `openai/gpt-4o-mini`
**When** the user switches to model A, then to model B, then to model C, all before triggering any request
**Then** the selector shows model C as selected
**And** the next request made uses model C, with no trace of A or B in the request

**How you would run this:** Unit test against the settings store plus request assembly: three synchronous selection changes, one dispatched request, assert the request body's model field.

---

### T-FR-8-11: A persisted model that has since been removed from the curated list is handled without crashing the selector
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the user previously selected a curated model that has since been removed from the curated list (the curated set changed between sessions)
**When** the user reloads and the selector loads the persisted selection
**Then** the selector does not crash, render blank, or silently send requests against an unlisted model
**And** the selector shows a recognizable state, either the persisted value shown as no longer available or a fallback to the default `openai/gpt-4o-mini`, and either way the next request goes out against a model actually present in the current curated list

**How you would run this:** Unit test against the settings-read boot logic with a fake settings object holding a model id not present in a fake curated list; asserts no exception is thrown and the resolved model used for the next request is one of the currently curated ones. Exact fallback behavior depends on the open question below, so this scenario's expected result is deliberately loose until that is answered.

---

### T-FR-8-12: An empty document with the default model still produces a continuation
**Priority:** P1
**Covers:** Beyond the stated criteria (interaction with AC-8.1)

**Given** a brand-new session with the default model selected and an empty document
**When** the user types the opening of a sentence and pauses
**Then** a continuation request is issued using `openai/gpt-4o-mini` with no prior visit to the selector
**And** this is indistinguishable, from the request's point of view, from a returning user who explicitly re-selected the default

**How you would run this:** Playwright spec with `page.route` capturing the outgoing request body's model field on a first-ever session.

## Boundaries checked

No numeric or size limits are stated as acceptance criteria in this requirement.
The PRD's prose uses "a list of five" as an illustrative comparison against "a list of hundreds," not as a stated limit, so no boundary table entry is written for curated-list length; T-FR-8-7 covers the qualitative "short enough to scan" bar by inspection instead, and the exact count is an open question below.

## What will probably break
A persisted model selection that no longer exists in the curated list, because the requirement never says who decides the curated membership is stable across a release, and the boot-time settings read is exactly the kind of code that assumes its stored value is always still valid; T-FR-8-11 is written to catch this.
The model change taking effect immediately on an in-flight request instead of waiting for the next one, because the natural first implementation is to read the currently-selected model at send time for whatever request object already exists in memory rather than snapshotting it at dispatch; T-FR-8-4 and T-FR-8-5 are the scenarios that would catch this.
AC-8.5's "enough information to choose between speed and capability" landing as a bare list of raw OpenRouter model IDs with no speed or capability cue, since that is the cheapest thing to ship and the requirement gives no minimum format; T-FR-8-7 is a manual check for exactly this and will likely fail on a first pass.
Per-model output shape differences (a missing sentinel line, an unexpected preamble, a blown sentence ceiling) surfacing only once a user actually switches away from `openai/gpt-4o-mini`, per the blueprint's own "What Will Bite" note that response normalization was only proven against the default model; this is not a scenario owned by this file since it is FR-5/FR-6's malformed-response handling, but switching models in T-FR-8-3 is the trigger condition that would first expose it.

## Not covered here
FR-1's key gate mechanics (validation, revocation, storage) are that requirement's plan, referenced here only as a precondition.
FR-12's general failure taxonomy (network unreachable, rate limit, credit exhaustion, malformed response) is tested once in FR-12's own plan; T-FR-8-8 only checks that a model-unavailable failure is routed through that same mechanism, not the mechanism itself.
The exact membership of the curated list, and whether continuation and revision get one shared selector or two independent ones, are architecture-document scope per the PRD and are recorded as open questions below rather than guessed at.
NFR-1 suggestion latency is not re-verified per model here; it is judged once, by hand, against the default model per NFR-1's own note, and any per-model latency difference is a product judgment call outside this file's scope.

## Open questions
The PRD says continuation and revision "may use different models, and if they do, the selector states which selection applies to what," which leaves it open whether FR-8 ships as one selector governing both request types or two independent selectors.
T-FR-8-3 and T-FR-8-4 are written against the single-selector reading, since that is what AC-8.2 and AC-8.3 read most naturally as; if the shipped design uses two independent selectors, those two scenarios need a second set of rows, one per selector.
The technical blueprint's own open question 3 leaves the curated list's exact membership undecided, so T-FR-8-1 and T-FR-8-6 use `openai/gpt-4o-mini` and a placeholder second model name (`anthropic/claude-3.5-sonnet`) that may not match the shipped list; the scenario's shape does not change, only the literal model id used as test data.
Whether a persisted-but-now-uncurated model (T-FR-8-11) falls back to the default or is shown as a disabled/stale option is not decided by the PRD or the blueprint; the scenario is written to accept either outcome as long as the app does not crash or silently call an unlisted model, and should be tightened once that product decision is made.
Whether the selector is a single control or is visually split so it can "state which selection applies to what" per the PRD's own conditional clause affects the keyboard-operability scenario (T-FR-8-9), which currently assumes one control to tab to.

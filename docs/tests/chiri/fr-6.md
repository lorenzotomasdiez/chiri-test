# FR-6: Selection-triggered AI revisions - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-6](../../prd/chiri/fr-6.md) |
| Priority | P0 |
| Scenarios | 24 |
| Last updated | 2026-07-28 |

## What this requirement promises

Chiri never touches text the user already wrote unless the user selects it and asks, through a floating action bar that offers one-tap actions and a free-text field.
The response comes back as an inline tracked-change diff over exactly the selected span, with a reason, and the user accepts, rejects, or refines it before it can ever reach the document.
Nothing here fires on a timer, an idle period, or a background scan, and at most one such revision is pending at a time.

## Preconditions

The user has passed the FR-1 key gate and has a valid OpenRouter key configured, so a revision request is able to be dispatched.
A document with existing written text is open and rendered per FR-3, since this requirement only ever acts on text the user has already committed.
Where a scenario needs a specific document shape (a given number of paragraphs, a fenced code block, prior text), that shape is stated in the scenario itself.

## Scenarios

### T-FR-6-1: No revision is ever proposed without a selection, across a full editing session
**Priority:** P0
**Covers:** AC-6.1

**Given** a document containing several written paragraphs and no active selection
**When** the user types new text, pauses for over a minute, lets the app sit idle, and finishes a section, all without selecting anything
**Then** no revision, diff, or action bar tied to existing text appears at any point in that session
**And** the only visible change to the document is the user's own typing.

**How you would run this:** Playwright, run for the length of a realistic session with the clock advanced rather than truly waited out where the harness allows; assert no revision-related DOM node ever appears and no request-shaped call is intercepted at the OpenRouter route.

---

### T-FR-6-2: Selecting text raises the action bar with all three entry points
**Priority:** P0
**Covers:** AC-6.2

**Given** the document contains the sentence "The report was late because the team was busy." rendered as plain paragraph text
**When** the user selects "the team was busy" and the selection settles
**Then** a floating action bar appears anchored near that selection
**And** the bar shows an "Ask AI" affordance, a set of one-tap actions (improve the writing, make it shorter, change the tone, fix grammar and spelling), and a free-text instruction field
**And** the bar does not cover any part of the selected text.

**How you would run this:** Playwright, driving the selection through CM6 selection state rather than a raw mouse drag, and reading bar position via the same `coordsAtPos` values the app uses.

---

### T-FR-6-3: A one-tap action produces a revision within the latency bar
**Priority:** P0
**Covers:** AC-6.4

**Given** the sentence "The report was late because the team was busy." is selected in full
**When** the user clicks "Improve the writing" on the action bar
**Then** within the NFR-1 latency bar a revision renders inline over exactly that span
**And** the rendered revision shows the existing text, the proposed replacement text, and a reason.

**How you would run this:** Playwright with `page.route` serving a scripted SSE body for the OpenRouter endpoint standing in for the model, since a real model call is not deterministic enough to assert timing against in this suite; the wall-clock budget itself is the NFR-1 bar, checked by hand per the blueprint's testing notes rather than asserted here.

---

### T-FR-6-4: A free-text instruction produces a revision reflecting that instruction, over the same span
**Priority:** P0
**Covers:** AC-6.5

**Given** the paragraph "We think the results are good but more testing may be needed." is selected in full
**When** the user types "make this sound more confident" into the free-text field and submits
**Then** a revision renders over exactly the selected span
**And** the proposed text is a rewrite of that span rather than of any other part of the document.

**How you would run this:** Playwright with a scripted SSE response echoing a rewrite; the pure `src/core/prompt.ts` piece of "does the request carry the instruction and only the span" is additionally covered by a fast unit test against the request-building module.

---

### T-FR-6-5: Clearing the selection dismisses the bar without issuing a request
**Priority:** P0
**Covers:** AC-6.3

**Given** the action bar is visible over a selection
**When** the user clicks elsewhere in the document, collapsing the selection to zero width, without choosing any action
**Then** the bar disappears
**And** no request is sent to the model
**And** no revision appears.

**How you would run this:** Playwright, asserting the bar element leaves the DOM and that no call was intercepted at the OpenRouter route in the window following the click.

---

### T-FR-6-6: Accepting a pending revision commits exactly the proposed text and nothing else
**Priority:** P0
**Covers:** AC-6.6, AC-6.8

**Given** a pending revision proposes replacing the selected span "was late because the team was busy" with "slipped due to competing team priorities"
**And** the rest of the document is unrelated, unchanged text
**When** the user accepts the revision
**Then** the document contains exactly the proposed text at that span
**And** every other character in the document is unchanged from before the request
**And** invoking undo once reverts the entire change back to the pre-accept text in a single step, with no intermediate state reachable.

**How you would run this:** Playwright, comparing `view.state.doc.toString()` before the request, after accept, and after one Ctrl/Cmd+Z.

---

### T-FR-6-7: Rejecting a pending revision leaves the document byte-identical
**Priority:** P0
**Covers:** AC-6.7

**Given** a pending revision is shown over a selected span, with the document's full text captured beforehand
**When** the user rejects the revision
**Then** the revision is removed from view
**And** the document's full text is byte-identical to the captured pre-request text.

**How you would run this:** Playwright, string-comparing the captured snapshot against `view.state.doc.toString()` after rejection.

---

### T-FR-6-8: A model response touching text outside the selected span is discarded entirely
**Priority:** P0
**Covers:** AC-6.9

**Given** the user selected only the second sentence of a two-sentence paragraph and requested a revision
**When** the scripted model response includes a proposed change that also rewrites the first sentence
**Then** nothing is rendered as a pending revision
**And** the document remains exactly as it was before the request
**And** the user sees this treated as a declined result rather than a silently narrowed one.

**How you would run this:** Playwright with `page.route` serving a response shaped to include an out-of-span edit; the span-containment check itself is also covered by a fast unit test against `src/core/revision.ts`'s out-of-span rejection logic, using a scripted response object with no browser involved.

---

### T-FR-6-9: A selection over more than three paragraphs is refused, not silently clamped
**Priority:** P0
**Covers:** AC-6.10

**Given** a document with five consecutive paragraphs of prose
**When** the user selects all five paragraphs and requests a revision, by one-tap action or free text
**Then** a visible message declines the request
**And** no revision, partial or otherwise, is rendered
**And** no request is sent to the model.

**How you would run this:** Fast and fully automatable against `src/core/revision.ts`'s paragraph-count guard with a scripted selection shape; a Playwright pass confirms the same refusal surfaces visibly when driven through a real five-paragraph selection.

---

### T-FR-6-10: Editing inside a pending revision's span invalidates it silently
**Priority:** P0
**Covers:** AC-6.11

**Given** a revision is pending over the selected span "the team was busy"
**When** the user places the caret inside that span and types "the deadline was unrealistic"
**Then** the pending revision disappears with no message or confirmation prompt
**And** the user's typed edit is applied to the document exactly as if no revision had been pending.

**How you would run this:** Playwright, matching testing.md's pending-span tracking spec: type inside the span and assert the revision decoration is gone and the typed text is present.

---

### T-FR-6-11: Editing outside a pending revision's span leaves it pending and its target text unchanged
**Priority:** P0
**Covers:** AC-6.12

**Given** a revision is pending over a span in the third paragraph of the document
**When** the user places the caret in the first paragraph and types an added sentence
**Then** the revision remains pending
**And** it still targets the same words in the third paragraph, at their shifted position
**And** accepting it afterward still replaces exactly those words and nothing in the newly typed first-paragraph sentence.

**How you would run this:** Playwright, matching testing.md's pending-span tracking spec: type above the span, then accept, and assert the mapped range moved with the edit rather than staying at a stale numeric offset.

---

### T-FR-6-12: A second revision request while one is pending is refused with an explanation
**Priority:** P0
**Covers:** AC-6.13

**Given** a revision is already pending over one selected span
**When** the user selects a different, unrelated span and requests another revision
**Then** the second request is not sent
**And** the user is shown a message stating the pending revision must be resolved first
**And** the original pending revision is still shown, unchanged.

**How you would run this:** Playwright; also covered as a fast unit test on `src/core/revision.ts`'s reducer, asserting a `Requested` action is refused while state is already `Pending`.

---

### T-FR-6-13: Clearing the selection while a request is in flight cancels it
**Priority:** P0
**Covers:** AC-6.14

**Given** the user has just submitted a revision request and the response has not yet arrived
**When** the user clears the selection before any content streams back
**Then** the in-flight request is cancelled
**And** nothing renders, even if the scripted response arrives afterward
**And** the action bar is gone.

**How you would run this:** Playwright with a scripted SSE response delayed long enough to clear the selection first; assert the underlying fetch's `AbortSignal` was aborted and that late-arriving scripted chunks produce no DOM change.

---

### T-FR-6-14: The entire revision flow is operable by keyboard alone
**Priority:** P0
**Covers:** AC-6.15

**Given** a user operating the editor with no pointer device
**When** they extend the selection with Shift+arrow keys, raise the action bar, choose an action with the keyboard, and then read and act on the resulting revision
**Then** the action bar receives focus and is operable via keyboard navigation
**And** the reason and proposed text are reachable by a screen reader or by tabbing through the revision's controls
**And** accept, reject, and refine are each triggerable without a pointer.

**How you would run this:** Playwright driving selection and activation entirely through keyboard events, matching the NFR-6 focus-management notes in the blueprint; the screen-reader announcement half of this stays a manual four-browser pass, not an automated assertion, per the blueprint's testing seams.

---

### T-FR-6-15: A pending revision does not survive a page reload
**Priority:** P0
**Covers:** AC-6.16

**Given** a revision is pending over a selected span, not yet accepted or rejected
**When** the user reloads the page
**Then** no revision is present after reload
**And** the document's text is exactly what it was before the request was made, with no trace of the proposed text.

**How you would run this:** Playwright, matching testing.md's reload-durability approach: reload and read `view.state.doc.toString()` plus assert no revision decoration exists.

---

### T-FR-6-16: Typing elsewhere in the document stays responsive while a revision is pending
**Priority:** P1
**Covers:** AC-6.17

**Given** a revision is pending over a span in one part of the document
**When** the user types continuously in an unrelated part of the document
**Then** each keystroke is reflected on screen within the NFR-2 latency bar
**And** the pending revision continues to render without interrupting input.

**How you would run this:** Manual check with the browser performance panel during a sustained typing burst, per the blueprint's note that a p95 latency assertion in a headless browser is not reliable; a Playwright spec can assert no input is blocked or dropped, short of measuring the exact millisecond bar.

---

### T-FR-6-17: A whitespace-only or zero-width selection raises no bar and issues no request
**Priority:** P1
**Covers:** AC-6.2

**Given** the document contains a run of spaces between two words
**When** the user's selection collapses to zero width, or covers only whitespace with no visible characters
**Then** no action bar appears
**And** no request is issued.

**How you would run this:** Playwright, selecting a whitespace-only range and asserting the bar element never appears in the DOM.

---

### T-FR-6-18: A selection crossing into a fenced code block still produces a revision over exactly that selection
**Priority:** P1
**Covers:** AC-6.5

**Given** a paragraph immediately followed by a fenced code block, with a selection starting in the paragraph and ending partway into the code block's contents
**When** the user requests a revision by free text
**Then** the revision's span is exactly the user's selection, including the part inside the code block
**And** the proposed text does not extend beyond that selection into the rest of the code block or the paragraph.

**How you would run this:** Playwright, since this depends on real CM6 span mapping across a language-aware region; scripted SSE response standing in for the model.

---

### T-FR-6-19: A result identical to the selected text is not shown, and the user is told nothing needed changing
**Priority:** P1
**Covers:** AC-6.4

**Given** the user selects a sentence and requests "improve the writing"
**When** the scripted model response returns text identical to the current selection
**Then** no diff is rendered
**And** the user sees a message indicating nothing needed to change
**And** the revision lifecycle returns to Idle rather than staying Pending.

**How you would run this:** Playwright with a scripted SSE response equal to the selected text; the equality check itself is also covered by a fast unit test against `src/core/revision.ts`.

---

### T-FR-6-20: The target span disappearing before the response arrives is treated as a failed request
**Priority:** P1
**Covers:** AC-6.11

**Given** the user requested a revision over a selected span
**When**, before the scripted response arrives, an edit removes the entire selected text (for example the user pastes over the whole paragraph containing it)
**Then** the request is treated as failed
**And** a visible message is shown, consistent with the general failure surfacing this requirement always uses when a requested revision cannot complete
**And** nothing is rendered as a pending revision.

**How you would run this:** Playwright, deleting the span mid-flight before the scripted SSE response completes, then asserting the failure message appears; the underlying failed-request surfacing mechanism itself belongs to FR-12's plan and is not re-verified here beyond "a message appears".

---

### T-FR-6-21: A request failure or unreachable network always shows a visible, dismissible message with retry
**Priority:** P0
**Covers:** Beyond the stated criteria

**Given** the user requested a revision by a one-tap action
**When** the OpenRouter route responds with a network failure (connection refused) in one run, and with an HTTP 401 in another
**Then** in both cases a visible, dismissible message appears explaining the request did not complete
**And** a retry affordance is offered
**And** nothing is rendered as if a revision were pending.

**How you would run this:** Playwright with `page.route` aborting the request for the network case and returning a 401 body for the auth case, per the testing seams' documented provider-error interception approach.

---

### T-FR-6-22: Malformed model output is treated as a failed request, not rendered
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the user requested a revision
**When** the scripted response omits the sentinel line the reason/body parser expects, or returns a body the parser cannot split into a reason and a replacement
**Then** the request is treated as failed
**And** a visible message is shown
**And** no partial or garbled revision is rendered.

**How you would run this:** Fast unit test against `src/core/provider.ts`'s reason/sentinel/body splitter using a scripted malformed string, with one Playwright pass confirming the visible failure message end to end.

---

### T-FR-6-23: The action bar is never modal and never blocks continued typing
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** the action bar is visible over a selection
**When** the user ignores it and keeps typing elsewhere in the document instead of choosing an action
**Then** the bar disappears as the selection is superseded
**And** the user's typing is applied normally with no dialog, focus trap, or blocking overlay at any point.

**How you would run this:** Playwright, asserting typed characters land in the document and no modal or focus trap intercepts the keystrokes.

---

### T-FR-6-24: The action bar repositions to never obscure the selection across scroll and wrapped lines
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a selection spanning four visually wrapped lines near the bottom of the viewport
**When** the action bar is raised for that selection
**Then** the bar does not overlap any part of the selected text
**And** if the viewport is then scrolled, the bar either tracks the selection or disappears rather than being left floating over unrelated text.

**How you would run this:** Playwright, checking bounding-box overlap between the bar element and the selection's rendered rectangles before and after a scroll, matching the "What Will Bite" entry on action bar placement in the technical blueprint.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Selection paragraph span for refusal | 2 paragraphs selected (allowed) | 3 paragraphs selected (allowed) | 4 paragraphs selected (refused) | T-FR-6-9 |
| Selection width | Zero-width / collapsed (no bar) | 1 character selected (bar appears) | N/A, no upper character bound stated | T-FR-6-2, T-FR-6-17 |
| Pending revisions in flight | 0 pending (request proceeds) | 1 pending (blocks a second) | Attempted 2nd while 1 pending (refused) | T-FR-6-12 |

## What will probably break

Span tracking through concurrent edits is the most likely first-implementation bug: the blueprint's own "What Will Bite" section names exactly this, because a revision's span must follow edits outside it and self-destruct on edits inside it, and a numeric-offset implementation will drift or survive when it should not.
T-FR-6-10 and T-FR-6-11 are the pair that would catch this, run in the order the blueprint recommends (above, then inside).

The action bar's mouse-only wiring is a second likely miss, since the blueprint calls out that code hung off `mouseup` produces no bar at all for a keyboard-made selection.
T-FR-6-14 and T-FR-6-2 (run with a keyboard-driven selection, not a mouse drag) are what would catch a bar that only responds to pointer events.

Model output that ignores the requested span, or wraps the proposed text in quotes or a preamble sentence, is named directly in the blueprint as something that "re-bites" per model.
T-FR-6-8 covers the out-of-span case; a preamble or quote-wrapped response passing through as if it were clean proposed text is not separately scenario'd here because the stripping itself belongs to the pure `src/core/provider.ts` module's own test coverage, not this requirement's behavior contract, but a first pass through T-FR-6-3 or T-FR-6-4 with a deliberately preamble-wrapped scripted response would likely expose it if that stripping is missing.

The "declined, not silently clamped" refusal at more than three paragraphs is easy to implement as a silent truncation instead, since silently narrowing to three paragraphs would still look plausible in a quick manual check.
T-FR-6-9 specifically asserts nothing partial renders, which is the detail a rushed implementation is most likely to get wrong.

## Not covered here

FR-7's refinement flow (submitting a refine instruction against a pending revision and getting revised proposed text back) is that requirement's own plan; this file only asserts that the review surface offers a refine control, inside T-FR-6-3, T-FR-6-4, and T-FR-6-14.

FR-5's continuation-suppression behavior (continuation prediction going silent while a selection is active or while a revision is pending over the caret's span, AC-5.8 and AC-5.11) is FR-5's acceptance criteria and its plan's responsibility, even though the PRD describes the interaction from this requirement's side.

The general failed-request surfacing mechanism (message wording, dismissal, retry semantics as a cross-cutting behavior) is FR-12's plan; T-FR-6-20 and T-FR-6-21 only assert that a message appears for revisions specifically, not the mechanism's own contract.

The design document's ownership of the bar's exact placement, sizing, motion, and wording, per the PRD's explicit statement that these are "owned by the future design document," is deliberately not tested here beyond the behavioral floor (does not obscure the selection, appears and disappears correctly).

NFR-1's exact latency figure is unverified per the technical blueprint's probe 2 (inconclusive, no API key available at blueprint time); T-FR-6-3 asserts a revision renders "within the latency bar" but the bar's numeric value and its enforcement is a manual/performance-panel concern noted in the blueprint, not a hard automated assertion in this plan.

Screen-reader announcement content under NFR-6 is a manual four-browser pass per the blueprint's testing seams, referenced in T-FR-6-14 but not independently scenario'd here.

## Open questions

Whether the revision's reason is drawn from a fixed taxonomy or is free model text (PRD Q6-a) is unresolved.
Default assumed here: the reason is treated as an opaque, non-empty string in every scenario ("Then...showing...a reason"), so no scenario asserts specific reason wording or a category enum.
If a fixed taxonomy is chosen, T-FR-6-3 and T-FR-6-4 would gain an assertion that the reason is one of a known set of values, and the malformed-output scenario T-FR-6-22 would gain a case for an unrecognized taxonomy token.

Whether choosing "change the tone" prompts for a target tone or lets the AI infer one (PRD Q6-b) is unresolved.
Default assumed here: T-FR-6-3's one-tap action table treats "change the tone" the same as the other one-tap actions, with no second input step.
If a tone submenu is added, a new scenario is needed covering the submenu's keyboard model and its own request contract, and T-FR-6-14's keyboard-only flow would need to include operating that submenu.

Whether partial acceptance of a revision returns in a later version (PRD Q6-c) is explicitly deferred product scope in the blueprint and is not tested here at all, since v1 only supports accepting or rejecting the whole revision.

What exact visible message text is shown for the "more than three paragraphs" refusal, the "already pending" refusal, and the "nothing needed changing" case is not specified in the PRD beyond behavior.
Scenarios T-FR-6-9, T-FR-6-12, and T-FR-6-19 assert that a message appears with the described meaning, not literal wording, since no literal string is given in the requirement to quote.

# FR-5: Inline continuation prediction - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-5](../../prd/chiri/fr-5.md) |
| Priority | P0 |
| Scenarios | 30 |
| Last updated | 2026-07-28 |

## What this requirement promises
While the writer pauses at the end of a paragraph or list item, Chiri offers a short grey continuation of at most two sentences at the caret, generated from the text already there.
Nothing enters the document until the writer explicitly accepts, in whole or by the next word only, and any other keystroke or caret move dismisses the offer without a trace.
The continuation only ever proposes forward, on text that does not exist yet, and it never touches, replaces, or comments on text already written.

## Preconditions
FR-1's key gate has been passed, so a working OpenRouter key is configured.
FR-10's request discipline (settle debounce, single in-flight continuation, token bucket, caret-generation guard) governs when a request is allowed to leave; this plan assumes FR-10 behaves as specified and does not re-test its internals, only FR-5's use of it.
The document contains at least one non-empty paragraph or list item, and the editor has focus.
Continuation prediction is at its default setting (on) unless a scenario states otherwise.

## Scenarios

### T-FR-5-1: A continuation appears after the writer pauses at the end of a paragraph
**Priority:** P0
**Covers:** AC-5.1

**Given** the document contains the paragraph `The cabin sat quiet under the first snow of the season, and` with the caret at the end of it
**When** the writer stops typing and the settle threshold elapses
**Then** grey ghost text appears at the caret proposing a plausible continuation
**And** the proposed text is not part of the document's saved content
**And** the first visible content of the continuation appears within the latency bar stated in NFR-1, or nothing is shown at all.

**How you would run this:** Playwright against a real `EditorView`, per the blueprint's testing seams, with `page.route` serving a canned SSE body; the ghost widget's presence is asserted in the DOM while its absence from `view.state.doc.toString()` is asserted the same way as the blueprint's ghost-text spec.

### T-FR-5-2: A continuation appears after the writer pauses at the end of a list item
**Priority:** P0
**Covers:** AC-5.1, `Beyond the stated criteria`

**Given** a list item `- Pack the tent, the stove, and` with the caret at the end of it
**When** the writer stops typing and the settle threshold elapses
**Then** grey ghost text appears at the caret in the same manner as the paragraph case.

**How you would run this:** Playwright, same seam as T-FR-5-1.

### T-FR-5-3: Accepting the full continuation inserts it and clears the ghost text
**Priority:** P0
**Covers:** AC-5.2

**Given** the continuation ` the pot for coffee.` is shown at the caret after `Pack the tent, the stove, and`
**When** the writer presses the accept key
**Then** the full continuation text is inserted into the document at the caret
**And** the ghost text is no longer present anywhere in the editor
**And** the caret sits immediately after the last inserted character.

**How you would run this:** Playwright, using the blueprint's ghost-text spec pattern: assert presence in `view.state.doc.toString()` after the keypress and the new caret offset.

### T-FR-5-4: Accepting the next word only inserts one word and leaves the remainder shown
**Priority:** P0
**Covers:** AC-5.3

**Given** the continuation ` the pot for coffee.` is shown at the caret
**When** the writer presses the accept-word key once
**Then** exactly the word `the` (plus its leading space, per how the document already reads) is inserted into the document
**And** the remaining ghost text ` pot for coffee.` is still shown at the new caret position.

**How you would run this:** Playwright, same seam; assert document text after one accept-word press and that a ghost widget is still present.

### T-FR-5-5: Repeated accept-word presses consume the continuation one word at a time
**Priority:** P1
**Covers:** AC-5.3, `Beyond the stated criteria`

**Given** the continuation ` the pot for coffee.` is shown
**When** the writer presses the accept-word key four times in a row
**Then** after each press one further word is committed to the document and removed from the ghost text
**And** after the fourth press no ghost text remains and the document reads `...the stove, and the pot for coffee.`

**How you would run this:** Playwright, same seam, asserting document text after each of the four presses.

### T-FR-5-6: Typing a character other than an accept key dismisses the continuation and inserts only what was typed
**Priority:** P0
**Covers:** AC-5.4

**Given** a continuation is shown after `Pack the tent, the stove, and`
**When** the writer types the letter `s`
**Then** the ghost text disappears entirely
**And** the document now reads `...the stove, ands` with no part of the continuation inserted.

**How you would run this:** Playwright, same seam.

### T-FR-5-7: Moving the caret with an arrow key dismisses the continuation without changing the document
**Priority:** P0
**Covers:** AC-5.5

**Given** a continuation is shown at the end of a paragraph
**When** the writer presses the Left arrow key once
**Then** the ghost text disappears
**And** the document text is byte-identical to what it was before the arrow press.

**How you would run this:** Playwright, same seam.

### T-FR-5-8: Clicking elsewhere dismisses the continuation without changing the document
**Priority:** P0
**Covers:** AC-5.5

**Given** a continuation is shown at the end of the second paragraph of a two-paragraph document
**When** the writer clicks into the middle of the first paragraph
**Then** the ghost text disappears
**And** the document text is unchanged
**And** the caret is now at the clicked position, not where the continuation was offered.

**How you would run this:** Playwright, same seam.

### T-FR-5-9: A response that arrives after the caret has moved is discarded silently
**Priority:** P0
**Covers:** AC-5.5, `Beyond the stated criteria` (FR-10's AC-10.3 as observed from FR-5's side)

**Given** a continuation request was issued for the caret position at the end of paragraph one
**When** the writer moves the caret to paragraph two before the response arrives, and the delayed response then arrives
**Then** no ghost text appears anywhere in the document
**And** no error or notification is shown.

**How you would run this:** Playwright with `page.route` delaying the SSE response past a caret move scripted in the same test.

### T-FR-5-10: An unaccepted continuation leaves no trace after export
**Priority:** P0
**Covers:** AC-5.6

**Given** a continuation is shown but not accepted
**When** the writer triggers export
**Then** the exported Markdown contains no part of the shown continuation text.

**How you would run this:** Playwright; one manual export pass per the testing seams' note that export plumbing itself is not otherwise asserted, combined with a DOM-state assertion that the continuation was never in `view.state.doc.toString()`.

### T-FR-5-11: An unaccepted continuation leaves no trace after reload
**Priority:** P0
**Covers:** AC-5.6

**Given** a continuation is shown but not accepted, at the end of a saved paragraph
**When** the page is reloaded
**Then** the restored document contains no part of the previously shown continuation
**And** the restored document matches exactly what had been explicitly written and saved before reload.

**How you would run this:** Playwright, real IndexedDB, matching the blueprint's reload-durability spec pattern.

### T-FR-5-12: No continuation is requested or shown inside a fenced code block
**Priority:** P0
**Covers:** AC-5.7

**Given** the caret sits inside an open fenced code block after the line `const x = 1;`
**When** the writer pauses past the settle threshold
**Then** no network request for a continuation is issued
**And** no ghost text appears.

**How you would run this:** Playwright, asserting no matching request was recorded by `page.route`, and no ghost widget present.

### T-FR-5-13: No continuation is requested or shown while a selection is active
**Priority:** P0
**Covers:** AC-5.8

**Given** the writer has selected the phrase `first snow` within a paragraph
**When** the writer pauses past the settle threshold with the selection still active
**Then** no continuation request is issued
**And** no ghost text appears.

**How you would run this:** Playwright, same assertion pattern as T-FR-5-12.

### T-FR-5-14: Accepting a continuation commits it as one undo unit
**Priority:** P0
**Covers:** AC-5.9

**Given** a continuation was accepted in full, adding ` the pot for coffee.` to the document
**When** the writer invokes undo once
**Then** the entire accepted continuation is removed in a single step
**And** the document returns exactly to its state before acceptance
**And** no partial fragment of the continuation remains.

**How you would run this:** Playwright, matching the blueprint's ghost-text spec: accept, then Ctrl/Cmd+Z once, assert full removal.

### T-FR-5-15: Undo after a partial (accept-word) acceptance removes only what was committed, as one unit
**Priority:** P1
**Covers:** AC-5.9, `Beyond the stated criteria`

**Given** the writer accepted only the next word `the` via accept-word
**When** the writer invokes undo once
**Then** the word `the` is removed from the document as a single step
**And** the document returns to its state before that acceptance.

**How you would run this:** Playwright, same seam as T-FR-5-14.

### T-FR-5-16: A model response of more than two sentences is truncated before display
**Priority:** P0
**Covers:** AC-5.10

**Given** a scripted model response of three sentences: `The trail climbs steeply here. Bring extra water for the ridge. You will not regret the view.`
**When** the response is received and would be shown
**Then** the ghost text displayed contains only the first two sentences, `The trail climbs steeply here. Bring extra water for the ridge.`
**And** the third sentence never appears in the ghost text at any point, including mid-stream.

**How you would run this:** Fully automatable and fast against `src/core/continuation.ts`'s pure truncation function, per the testing seams; the display-side confirmation is a Playwright check that the third sentence never renders.

### T-FR-5-17: Truncation lands on a sentence boundary, not mid-sentence
**Priority:** P0
**Covers:** AC-5.10

**Given** a scripted response `Turn left at the fork. Then follow the creek until` (an incomplete third fragment with no terminal punctuation)
**When** the response would be shown
**Then** the displayed continuation ends at `Turn left at the fork. Then follow the creek until` is not shown as a dangling fragment; the shown text stops at the last complete sentence boundary within the two-sentence ceiling.

**How you would run this:** Fully automatable and fast, pure unit test against the truncation function.

### T-FR-5-18: A response that duplicates the text already after the caret is not shown as a duplicate
**Priority:** P1
**Covers:** `Beyond the stated criteria` (edge case table row: "Response duplicates text already after the caret")

**Given** the caret sits mid-paragraph with the text ` and the mountains` already present immediately after it
**When** the scripted response proposes ` and the mountains, too`
**Then** the shown continuation excludes the duplicated leading tail, showing only `, too`, or nothing is shown at all.

**How you would run this:** Fully automatable and fast, pure unit test against the duplicate-tail suppression function named in the testing seams.

### T-FR-5-19: An empty or whitespace-only response shows nothing and no error
**Priority:** P1
**Covers:** AC-12.1 (edge case table)

**Given** a scripted response body that is an empty string, and separately one that is only spaces and newlines
**When** the response is received
**Then** no ghost text appears for either case
**And** no error message or notification is shown.

**How you would run this:** Fully automatable and fast, pure unit test on the sanitizer, with one Playwright confirmation that the UI stays silent.

### T-FR-5-20: A failed request or unavailable network shows nothing and does not interrupt typing
**Priority:** P0
**Covers:** AC-12.1 (edge case table)

**Given** the writer pauses at an eligible caret position and the continuation request fails
**When** the failure occurs (network error, or the endpoint is unreachable)
**Then** no ghost text appears
**And** no error banner or modal interrupts the editor
**And** the writer can keep typing without any visible sign that a request was made.

**How you would run this:** Playwright with `page.route` aborting the request or returning a network error, asserting silence and continued editability.

### T-FR-5-21: A caret inside a link target does not trigger a continuation
**Priority:** P1
**Covers:** AC-5.7 (edge case table row: link target)

**Given** the caret sits inside the URL portion of `[the trailhead](https://exam` (an in-progress Markdown link target)
**When** the writer pauses past the settle threshold
**Then** no continuation request is issued
**And** no ghost text appears.

**How you would run this:** Fully automatable and fast, pure unit test against the eligibility function in `src/core/continuation.ts`.

### T-FR-5-22: A caret in the middle of an existing word does not trigger a continuation
**Priority:** P1
**Covers:** AC-5.7 (edge case table row: mid-word)

**Given** the caret sits between `moun` and `tain` inside the already-written word `mountain`
**When** the writer pauses past the settle threshold
**Then** no continuation request is issued
**And** no ghost text appears.

**How you would run this:** Fully automatable and fast, pure unit test against the eligibility function.

### T-FR-5-23: No continuation is requested within the span of a pending revision
**Priority:** P0
**Covers:** AC-5.11

**Given** a revision proposed by FR-6 is pending over the span `the first snow of the season`, and the caret sits at the end of that same span
**When** the writer pauses past the settle threshold
**Then** no continuation request is issued for that span.

**How you would run this:** Playwright, raising a pending revision first, then pausing at the in-span caret and asserting no matching request fired.

### T-FR-5-24: Continuation remains available elsewhere while a revision is pending
**Priority:** P1
**Covers:** AC-5.11, `Beyond the stated criteria`

**Given** a revision is pending over a span in paragraph one
**When** the writer pauses at the end of paragraph three, outside the pending span
**Then** a continuation is shown normally at that unrelated location.

**How you would run this:** Playwright, same setup as T-FR-5-23 with the pause moved outside the span.

### T-FR-5-25: Continuation prediction is active by default on a first-ever session
**Priority:** P0
**Covers:** AC-5.12

**Given** a fresh browser profile with no prior Chiri settings stored
**When** the writer starts writing and pauses at an eligible position
**Then** a continuation is shown without the writer having opened any settings or toggled anything.

**How you would run this:** Playwright, clearing storage before the test, matching the blueprint's settings shape (`continuationEnabled` defaulting true when unset).

### T-FR-5-26: Turning continuation off suppresses every future continuation, and no request is issued
**Priority:** P0
**Covers:** AC-5.13

**Given** continuation prediction has been turned off in settings
**When** the writer writes and pauses at eligible positions in several different places in the document
**Then** no ghost text is ever shown
**And** no continuation network request is issued at any pause.

**How you would run this:** Playwright, toggling the setting off, asserting no matching requests across multiple pauses, and that the off state is read from `localStorage` per the blueprint's settings persistence.

### T-FR-5-27: The off state persists across a reload
**Priority:** P1
**Covers:** AC-5.13, `Beyond the stated criteria`

**Given** continuation prediction was turned off in a previous session
**When** the page is reloaded
**Then** continuation prediction is still off
**And** pausing at an eligible position shows no continuation.

**How you would run this:** Playwright, reload between toggle and assertion.

### T-FR-5-28: A shown continuation is announced to assistive technology and operable without a pointer
**Priority:** P0
**Covers:** AC-5.14

**Given** a continuation is shown at the caret
**When** the writer, using only the keyboard, queries the current state of the editor via a screen reader
**Then** the presence of the continuation is announced
**And** the writer can accept the continuation using only the keyboard
**And** the writer can dismiss the continuation using only the keyboard, without a pointer at any point.

**How you would run this:** Manual four-browser pass with VoiceOver and NVDA per the blueprint's open question 7; the Tab-focus-traversal half (does Tab still leave the editor with no ghost text shown, and accept when ghost text is shown) is covered by the automated Playwright spec named in the testing seams, run in Chrome, Safari, and Firefox.

### T-FR-5-29: Nothing Chiri shows while idle alters, replaces, or annotates already-written text
**Priority:** P0
**Covers:** AC-5.15

**Given** a document of several paragraphs already written, with the caret placed mid-document and no selection active
**When** the writer pauses anywhere in the document, whether or not a continuation appears
**Then** every character that existed before the pause is still present, unchanged, in the same order
**And** no highlighting, strikethrough, comment, or annotation appears over any already-written span.

**How you would run this:** Playwright, snapshotting `view.state.doc.toString()` before and after the pause and diffing for equality outside any newly-inserted ghost region.

### T-FR-5-30: A pending continuation is suppressed for the whole document while text is selected anywhere, not just at the selected span
**Priority:** P2
**Covers:** AC-5.8, `Beyond the stated criteria`

**Given** a shown continuation exists at the caret before the writer makes a selection elsewhere in the document
**When** the writer creates a text selection
**Then** the previously shown continuation disappears
**And** no new continuation request is issued while any selection remains active, even if the caret subsequently appears to be at a different eligible position within the selection's anchor logic.

**How you would run this:** Playwright, selecting text after a continuation is already shown and asserting the ghost widget clears immediately.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Continuation length ceiling of two sentences | One sentence shown (within limit, not a boundary edge) | Exactly two complete sentences returned by the model | Three sentences returned by the model, truncated to two | T-FR-5-16, T-FR-5-17 |
| NFR-1 latency bar for first visible content (2.0s p95) | Not separately re-verified here; owned by NFR-1's own bar, referenced from AC-5.1 | Continuation appears within the stated bar or nothing at all | Not applicable; a slow response is a failure/timeout case, covered by T-FR-5-20's silence contract | T-FR-5-1 |
| Accept-word repeated to consume a multi-word continuation | Zero accept-word presses (full ghost text still shown) | One accept-word press (first word only) | Enough presses to exhaust the whole continuation | T-FR-5-4, T-FR-5-5 |

## What will probably break
The accept keystroke is an open product decision (Q5-a) with a known collision risk against Tab's dual role as focus traversal and CM6's indent binding; T-FR-5-28's keyboard-only path and the blueprint's Tab-focus-traversal spec are what would catch a binding that traps focus in one browser but not another.
Stale-response handling is easy to get right in the common case and wrong under real latency: a response arriving a few hundred milliseconds after the caret has already moved twice is the scenario T-FR-5-9 targets, and it is also the scenario most likely to be skipped if the scheduler's generation counter is tested only in isolation from FR-5's display layer.
Truncation and duplicate-tail suppression are both string heuristics facing an untrusted model, per the blueprint's "What Will Bite" entry on model output ignoring instructions; T-FR-5-16 through T-FR-5-18 are the ones most likely to reveal a model that returns a continuation already containing a heading, a preamble like "Sure, here's more:", or text that restates rather than continues, none of which the two-sentence truncation alone would catch.
Suppression during a pending revision (AC-5.11) depends on FR-6's span tracking staying accurate through concurrent edits, per the blueprint's span-tracking risk; if that tracking drifts, T-FR-5-23 would pass on a static document but a version of it done with an edit made above the pending span first would not, and that variant is worth adding once FR-6's span behavior is implemented.

## Not covered here
The settle debounce timing, the token bucket ceiling, the single-in-flight rule, and the caret-generation staleness guard themselves are FR-10's requirement and are tested there; this plan only asserts that FR-5 behaves correctly given FR-10 permits or denies a request.
The pending-revision span's own tracking through edits (does it follow edits outside it, does it invalidate on edits inside it) is FR-6's requirement; T-FR-5-23/24 only assert FR-5's suppression behavior given a pending span exists, not the span's own correctness.
Rate-limit recovery behavior (AC-10.4, AC-12.3) belongs to FR-10 and FR-12 respectively; this plan does not add a dedicated scenario for it beyond noting continuation silently does not appear while a request is disallowed.
General keyboard accessibility of the editor outside continuation (e.g. the key gate, the model selector) belongs to FR-1 and FR-8's own plans.
The NFR-2 typing-latency bar under a 20,000-character document is checked by hand per the blueprint's testing seams and is not re-asserted here since it is not specific to continuation.

## Open questions
Q5-a from the PRD is unresolved: which exact keystrokes accept the full continuation and the next word.
T-FR-5-3, T-FR-5-4, T-FR-5-5, and T-FR-5-28 are written against "the accept key" and "the accept-word key" as named roles rather than concrete keys; once Q5-a is answered, these scenarios would be updated to name the actual keys and re-checked against the four target browsers' default bindings.
Q5-b from the PRD is unresolved: whether the two-sentence ceiling applies to list items or whether a list item gets one item's worth instead.
T-FR-5-2 currently assumes list items follow the same two-sentence rule as prose, per the blueprint's stated default ("until it is answered, list items get the same two-sentence rule as prose"); if the answer differs, a dedicated truncation-boundary scenario for list items would be needed alongside T-FR-5-16/17.
Whether "moving the caret" in AC-5.5 includes caret movement caused by an external event (for example, a document restore firing mid-session) or only user-initiated movement is not stated; T-FR-5-7 and T-FR-5-8 test only explicit arrow-key and click movement, the two cases the PRD names, and no scenario is written for programmatic caret movement since none is described in the requirement.

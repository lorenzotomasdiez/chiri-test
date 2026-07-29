# FR-4: Local persistence of the document - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-4](../../prd/chiri/index.md#fr-4-local-persistence-of-the-document) |
| Priority | P0 |
| Scenarios | 12 |
| Last updated | 2026-07-28 |

## What this requirement promises
Chiri keeps the one document saved on the user's machine continuously as the user types, with no save button and no explicit save action anywhere.
Closing the tab, reloading, or the browser crashing loses no more than a couple of seconds of the most recent typing, and on return the user lands back in the same document with the caret in a sensible place.
Anything the AI has proposed but the user has not accepted is never part of what gets saved, so a reload never resurrects a ghost continuation or a pending revision as if it were the user's own text.

## Preconditions
The key gate (FR-1) has already been passed, so the editor (FR-3) is reachable.
A single Markdown document surface (FR-3) exists and is the thing being persisted.
Unless a scenario states otherwise, the browser profile already has a document saved from a prior session.

## Scenarios

### T-FR-4-1: Typing is saved with no explicit save action
**Priority:** P0
**Covers:** AC-4.1

**Given** an empty document
**When** the user types `## Release notes` followed by two sentences of body text, with no save button pressed and no keyboard shortcut for saving used
**And** the page is reloaded
**Then** the document shown after reload is identical, character for character, to the document that was on screen immediately before the reload
**And** no save affordance was ever presented or required to reach that state

**How you would run this:** Fully automatable, but this scenario exercises the real `EditorView` and real IndexedDB, so it needs a real browser (per the blueprint's testing seams, `EditorView`-touching tests run under Playwright rather than a faked DOM).

### T-FR-4-2: A character survives the durability floor
**Priority:** P0
**Covers:** AC-4.2, NFR-5

**Given** a document containing `Draft intro paragraph.`
**When** the user types the character `x` and then waits before reloading, per the row below
**Then** the presence of `x` in the reloaded document matches the row below

| Case | Idle time before reload | Expected result |
|---|---|---|
| Just below the floor | 1.9 seconds | `x` may or may not be present; loss of input this recent is within the NFR-5 allowance and is not asserted either way |
| At the floor | 2.0 seconds | `x` is present in the reloaded document |
| Just above the floor | 2.1 seconds | `x` is present in the reloaded document |

**How you would run this:** In a real browser against real IndexedDB, by reading the persisted record back directly and asserting the character is in it within the floor of the keystroke that produced it.
An injected clock is the wrong instrument here despite being the convenient one: the floor is a wall-clock promise about the debounce *plus* the real storage round trip, and a fake-timer test can only ever observe the debounce constant it was handed, which makes it restate its own input rather than measure the promise.
Keep the below-the-floor case unasserted in either direction, per the table.

### T-FR-4-3: A pending continuation is never restored
**Priority:** P0
**Covers:** AC-4.3

**Given** the user has typed `The weather today was` and a grey continuation suggestion is showing at the caret, not yet accepted
**When** the page is reloaded before the suggestion is accepted or dismissed
**Then** the reloaded document contains exactly `The weather today was` and nothing from the suggested continuation
**And** no ghost text is shown after reload, because there was nothing pending to restore

**How you would run this:** Needs a real browser for the `EditorView` and the ghost-text decoration; the AI response can be a fake/canned suggestion since only the persisted-document boundary is under test, not the model call itself.

### T-FR-4-4: A pending revision diff is never restored
**Priority:** P0
**Covers:** AC-4.3

**Given** the user selected a paragraph and a pending revision diff is showing over that span, not yet accepted or rejected
**When** the page is reloaded while the revision is still pending
**Then** the reloaded document contains the original, pre-revision text of that paragraph
**And** no proposed replacement text, reason line, or diff markup appears anywhere in the reloaded document

**How you would run this:** Needs a real browser for the diff decoration; the revision response can be canned.

### T-FR-4-5: The document survives the browser being fully closed and reopened
**Priority:** P0
**Covers:** AC-4.4

**Given** a document containing three paragraphs was written in a session that ended normally
**When** the browser application itself is closed entirely and later reopened, and Chiri is opened again in the same browser profile
**Then** the same three paragraphs are present
**And** the document is immediately editable, with no gate, spinner, or blocking state standing between opening the tab and typing

**How you would run this:** Needs a real browser instance restarted between steps (or an equivalent close-and-relaunch simulation), since this is distinct from a same-process page reload and is exercising a colder start path.

### T-FR-4-7: The caret returns to a sensible position, not an arbitrary offset
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document of four paragraphs where the user's caret was resting inside the third paragraph, between the words `quick` and `fox`, at the moment the tab was closed
**When** the user reopens Chiri in the same browser profile
**Then** the caret is placed at that same position inside the third paragraph, not at the start of the document and not at the end
**And** typing a character at that point inserts it exactly where the user left off, splitting `quickfox` into `quickXfox` for a typed `X`

**How you would run this:** Needs a real browser for caret placement and coordinate assertions; the persisted document shape in the blueprint carries a `caretOffset` alongside the text, which is what this scenario is checking against observed caret placement, not the stored field itself.

### T-FR-4-8: A document emptied by deleting all content persists as empty
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document containing `Temporary notes to be discarded.`
**When** the user selects all and deletes the content, leaving the document empty
**And** the page is reloaded after the 2-second durability window
**Then** the reloaded document is empty
**And** it is not the pre-deletion text that reappears

**How you would run this:** Fully automatable in a real browser, same seam as T-FR-4-1.

### T-FR-4-9: Persistence holds at the document size ceiling named by the product
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document built from repeated paragraphs of ordinary prose
**When** the document is grown to the size in the row below and then left idle past the durability window before reloading
**Then** the reload result matches the row below

| Case | Document size | Expected result |
|---|---|---|
| Just below the ceiling | 19,999 characters | Full content present after reload, byte for byte |
| At the ceiling | 20,000 characters | Full content present after reload, byte for byte |
| Just above the ceiling | 20,001 characters | Full content present after reload, byte for byte; no truncation and no error surfaced to the user |

**How you would run this:** Needs a real browser and real IndexedDB; this is a correctness check on the write-and-restore path at size, not a timing check, so it does not need to also assert the NFR-2 50ms typing-latency bar, which belongs to FR-3's plan.

### T-FR-4-10: An unexpected termination loses no more than the durability floor
**Priority:** P0
**Covers:** NFR-5

**Given** the user typed `Final thought before the crash.` and the last keystroke landed 2.5 seconds before termination
**When** the browser process is killed abruptly (not a normal tab close and not a graceful navigation) and Chiri is reopened in the same profile
**Then** `Final thought before the crash.` is present in the reopened document
**And** whatever was typed in the 2 seconds immediately preceding the last saved point is the only text that may be missing, never anything typed earlier in the session

**How you would run this:** Needs real infrastructure that can simulate a hard process kill rather than a clean `beforeunload`/`pagehide` path, since the blueprint's forced-flush hooks (`pagehide`, `visibilitychange: hidden`) are exactly what a graceful close would trigger and this scenario exists to catch the case where they do not run.
This is a strong candidate for a manual pass per release rather than a routine automated one, since reliably killing a real browser process mid-write is not the same as simulating an unload event.

### T-FR-4-11: A fast burst of edits settles on the final state, not an intermediate one
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** an empty document
**When** the user types the sentence `The quick brown fox jumps over the lazy dog.` at a fast, continuous pace with no pauses long enough to be a natural stop, and reloads once the whole sentence is on screen and the durability window has elapsed
**Then** the reloaded document contains the whole sentence exactly as typed
**And** it does not contain a partial or out-of-order fragment from mid-burst

**How you would run this:** Fully automatable with a scripted rapid-keystroke sequence in a real browser; useful for catching a write scheduler that saves an intermediate snapshot out of order.

### T-FR-4-12: Two tabs open on the same document do not corrupt the saved state
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** the same browser profile's document is open in two separate tabs at once, both showing the same starting content, `Shared draft.`
**When** the user types `A` in the first tab, waits past the durability window, then types `B` in the second tab and waits past the durability window, then closes both tabs
**Then** reopening Chiri shows a single coherent document, not a corrupted or partially-merged mix of both edits
**And** the specific outcome of which tab's edit wins is recorded as an open question below rather than asserted here

**How you would run this:** Needs two real browser contexts or two real tabs against the same profile's storage; this is an exploratory scenario, not a strict pass/fail against a stated rule, since the PRD does not define multi-tab behavior.

### T-FR-4-14: A corrupted or unreadable persisted record does not crash the editor
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** the browser profile's stored document record is malformed, for example truncated mid-write or holding a value that does not match the expected shape
**When** the app loads
**Then** the editor still becomes usable rather than showing a blank crashed screen or an unrecoverable error
**And** the user can type and the app resumes normal autosave behavior from that point forward

**How you would run this:** Needs real IndexedDB seeded with a deliberately malformed record before load; the blueprint's `DocumentStore` interface makes this fakeable at the interface boundary if a lower-level integration test is preferred over corrupting the real database file.
The exact fallback content shown (empty document vs. some partial-recovery attempt) is an open question below, so this scenario only asserts the app does not crash and remains usable, not which specific fallback content appears.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Durability floor (seconds of typing that may be lost) | 1.9s idle before interruption | 2.0s idle before interruption | 2.1s idle before interruption | T-FR-4-2 |
| Document size ceiling named by the product (characters) | 19,999 chars | 20,000 chars | 20,001 chars | T-FR-4-9 |

## What will probably break
The blueprint's `idb-keyval` write is 800ms debounced with a forced flush on `pagehide`/`visibilitychange: hidden`, but a real hard process kill or an OS-level crash does not run either of those event handlers, so the actual loss window on a genuine crash is likely wider than the 2-second floor the PRD promises; T-FR-4-10 is the scenario built specifically to catch this gap, and per the blueprint's own open question 6, the 1.5-seconds-before-kill survival case has not been probed at all.
Caret restoration (T-FR-4-7) is the kind of feature that works for a caret sitting in plain prose and breaks for a caret sitting inside a hidden Markdown marker (for example, right after a heading's `#` character) or at a position that no longer exists because the document changed shape between save and reload; this interacts with the live-preview marker-hiding work described in the blueprint's "What Will Bite" section and is worth checking against a caret positioned inside or adjacent to a heading, list marker, or emphasis marker specifically, not just inside plain paragraph text.
Multi-tab behavior (T-FR-4-12) has no stated contract at all, so whatever the first implementation happens to do (last-write-wins by debounce timing, silent overwrite, or a stale-tab read clobbering a newer save) is likely to be surprising to whoever built it, since nothing in the PRD or blueprint discusses it.
The empty-document persistence path (T-FR-4-8) is a natural place for an off-by-one in "is the document empty" logic, since an implementation that treats an empty string as "nothing to save" rather than as "save the empty state" would silently resurrect old content on reload instead of showing the empty document the user actually left.

## Not covered here
The mechanics of what makes text "pending" versus "committed" (the ghost continuation and the revision diff lifecycle themselves) belong to FR-5 and FR-6's plans; this file only tests that whatever is pending is excluded from what gets saved and restored.
The onboarding cue and the empty first-session state belong to FR-11's plan.
A scenario for the first-ever session in a fresh profile used to live here as T-FR-4-6, but everything it could actually observe - an empty document, the onboarding cue, a usable editor - holds identically whether or not anything is persisted, so it proved nothing about this requirement and was removed rather than kept as coverage that was not real.
Export and the clipboard/download round trip belong to FR-9's plan; this file only concerns the automatic local save, not any user-initiated copy of the document leaving the browser.
General AI failure and offline behavior for continuation and revision requests (rate limits, credit exhaustion, malformed responses) belong to FR-12's plan.
Offline behavior of the document itself is not covered here either: the offline-degradation requirement it used to test was removed from the PRD, so nothing in this plan asserts what happens with the network unavailable.
The 50ms per-keystroke input-latency bar (NFR-2) is FR-3's concern; T-FR-4-9 checks that a 20,000-character document still saves and restores correctly, not that typing in it stays fast.

## Open questions
The requirement does not say what happens when two browser tabs on the same profile edit the document concurrently; T-FR-4-12 is written to only assert no corruption rather than a specific winner, and if a last-write-wins or single-tab-lock rule gets decided, that scenario should be tightened to assert the specific outcome.
The requirement does not say what happens when the underlying storage is unavailable at boot (private browsing, a full quota, a blocked IndexedDB) beyond noting it as the technical blueprint's own unresolved open question 2 (in-memory fallback with a banner, versus a blocking refusal screen); no scenario here asserts a specific outcome for that case, and T-FR-4-14 deliberately only tests the narrower case of a corrupted existing record rather than storage being entirely unreachable.
Whether a "sensible" caret position on return (T-FR-4-7) tolerates the document having changed shape since the save (for example, an accepted AI change shifted every offset after it) is not addressed by the requirement text; the default assumed here is that the caret lands at the same character position in the saved text, and if the document cannot have changed shape between save and load in practice, this scenario's premise should be revisited.


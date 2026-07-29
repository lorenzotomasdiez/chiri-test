# Chiri PRD

| Field | Value |
|---|---|
| Status | Draft |
| Owner | Lorenzo Tomas Diez |
| Last updated | 2026-07-28 |

## 1. Summary

Writers who draft in Markdown lose momentum at two moments: when they stall mid-sentence, and when they reread a paragraph they know is wrong but do not want to rewrite from scratch.
Chiri is a single-page browser editor holding exactly one Markdown document, where an AI co-author works inside the document surface rather than in a chat panel.

Chiri helps in two ways, and the difference between them is the whole product.
Ahead of the caret, it predicts: as the writer types, the next span of text appears in grey, taken with one keystroke or dismissed by typing past it.
Behind the caret, it waits: text already written changes only when the writer selects it and asks, through a small action bar that appears at the selection.

The human remains the author at all times, because nothing enters the document without an explicit accept and nothing already written is touched without an explicit invitation.
Success means someone can open Chiri, enter an OpenRouter key, start typing, and get useful help without reading any documentation.

## 2. Problem and Context

Markdown drafting today splits attention across two surfaces.
The writer types in an editor and then copies text into a chat assistant, describes what they want, reads a wall of regenerated prose, and pastes something back.
That loop is expensive in attention and it quietly transfers authorship: the assistant returns a whole rewritten document, and the writer's job degrades from writing to approving.

Existing in-editor AI tools fail in one of two directions.
Most reproduce the chatbot in a sidebar, so the writer must stop writing, form a request in words, and wait.
The rest overcorrect into unsolicited rewriting, flagging and reworking finished paragraphs the writer never asked about, which is the fastest way to make someone turn the feature off.

Chiri's position is that the direction of the help determines whether it is welcome.
Forward, into text that does not exist yet, prediction is free: a suggestion the writer types past costs nothing and interrupts nothing.
Backward, over text the writer has already committed, help must be invited, because unrequested rewrites of finished work take authorship away from the person they are meant to serve.

Two things make this buildable now.
Fast instruction-following models are available through a single provider API that a browser can call directly, so no backend is required to ship a credible product.
And both interactions, grey ghost text and a selection action bar, are already familiar from code editors and modern document tools, so neither needs explanation.

## 3. Goals

1. A first-time user goes from cold open to accepted AI help without instructions, tutorials, or documentation.
2. Prediction ahead of the caret is effortless and constant, so the writer never has to compose a prompt to keep moving.
3. Existing text is never altered without the user selecting it first, so finished writing stays finished.
4. Asking for a revision costs one selection and one click, so the invited path is faster than switching to a chat tool.
5. The human retains authorship, verifiably, because every change to the document originates from an explicit human accept.
6. Every change the AI offers is reviewable at a glance, so the writer can judge it without rereading the whole document.
7. The product surface stays quiet and small, so nothing competes with the document for attention.

## 4. Non-Goals

1. Unsolicited rewriting of text the user has already written.
   The AI never scans the document for weak paragraphs, never proposes revisions on idle or on a timer, and never annotates finished text.
   This is the interaction the product is explicitly designed against, and it is rejected rather than deferred.
2. Multi-human real-time collaboration.
   Presence, remote cursors, and conflict resolution are a different product with a different architecture, and one human plus one AI is the collaboration model being built here.
3. Accounts, login, profiles, or any server-side identity.
   There is no server of ours to authenticate against, and an account gate would block the first-run experience Goal 1 depends on.
4. Multiple documents, a file tree, or a document list.
   The product's claim is depth of collaboration inside one document, and navigation chrome would dilute the single-surface experience.
5. Version history or a document timeline.
   Editor undo and redo cover reversal for a single-session, single-document product, and a timeline is a large surface for a small benefit at this scope.
6. A chat panel or conversational sidebar.
   The chat interaction pattern is the other thing this product is arguing against.
7. Importing an existing `.md` file.
   The single document is strictly one the user types into, and an import path would reintroduce file management to a product whose value is having none.
8. Any display of cost, spend, token usage, or remaining provider credit.
   The user's budget is their own business and surfacing it would put a meter next to a writing surface, which is the opposite of quiet.
   Credit exhaustion still surfaces as an actionable error, per AC-12.5, because that is a failure the user must be able to fix.
9. Telemetry, analytics, or usage data collection of any kind.
   There is no backend to receive it, and the privacy guarantee in NFR-3 and NFR-4 is stronger and simpler if the answer is none.
10. Server-side persistence, sync, or cross-device continuity.
    There is no backend in scope, so the local copy is the only copy and export covers the durability need.
11. Rich text output formats such as PDF, DOCX, or HTML export.
    Markdown is the format the user works in, and other formats add conversion surface without changing the core interaction.
12. Model providers other than OpenRouter.
    The supplied credential is an OpenRouter key, and a provider abstraction would be speculative generality.

## 5. Users and Use Cases

**Primary user: the drafting writer.**
Someone producing a README, a spec, a post, or documentation in Markdown, working alone, in a desktop browser, in one sitting of roughly fifteen to ninety minutes.
They know what they want to say and are fluent enough to reject a bad suggestion instantly.
They care about keeping momentum and about the text still sounding like them.

**Secondary user: the evaluator.**
Someone opening Chiri to judge it in under ten minutes, with an OpenRouter key in hand and no patience for setup.
They will test whether the AI feels like a collaborator or a gimmick, and they will notice if the product asks them to read anything before it works.

**Journey: the drafting writer.**

1. The user opens Chiri and sees the Chiri mark while the app initializes.
2. The app asks for an OpenRouter API key, the user pastes one, and the app confirms it is valid before letting them in.
3. The user lands in an empty document with a single quiet cue telling them to start typing.
4. The user writes a heading and the opening of a paragraph.
5. As they pause, Chiri offers the rest of the sentence in grey at the caret, and the user takes it with one keystroke or keeps typing to dismiss it.
6. The user drafts three more paragraphs this way, and Chiri says nothing about any of them, because the user never asked.
7. Rereading, the user decides the second paragraph is too long, selects it, and a small action bar appears at the selection.
8. The user clicks "Make it shorter" and a tracked-change diff appears in place over that paragraph, with a one-line reason.
9. The user accepts it, then selects another sentence, types "less formal" into the same bar, and refines the result twice before accepting.
10. The user switches to a stronger model for a final pass over a difficult section.
11. The user copies the Markdown to the clipboard and closes the tab, and on returning later the document is still there.

**Journey: the evaluator.**

1. The evaluator opens the app, enters a key, and types two paragraphs of deliberately mediocre prose.
2. They notice the grey continuation appearing as they write, and take one.
3. They confirm that nothing rewrites their existing prose while they are typing.
4. They select a paragraph, ask for a change, accept one result, reject another, and refine a third.
5. They form a judgment about whether the AI read the document or merely reworded a span.

## 6. Success Criteria

Chiri ships with no telemetry and no backend, so there is nothing to instrument and no dashboard to read.
Success is judged by using the product and by watching someone else use it.
Each criterion below is written so a person can reach a verdict in a single session.

| # | Criterion | How it is judged |
|---|---|---|
| SC-1 | A first-time user reaches useful AI help without being told how | Sit someone down with a key and no instructions, and watch whether they accept a continuation or ask for a revision unprompted |
| SC-2 | Continuation arrives while it is still wanted | Type normally and confirm the grey text appears during the pause rather than after typing has resumed, per NFR-1 |
| SC-3 | Continuations are worth taking often enough to be habit, not novelty | Draft a real document end to end and confirm suggestions are accepted routinely rather than dismissed as a reflex |
| SC-4 | The AI stays silent about finished text | Write for a full session without selecting anything and confirm nothing about already-written text ever changes or is annotated, per AC-6.1 |
| SC-5 | Asking for a revision is faster than switching tools | Time selection to accepted result and confirm it is a small number of seconds and two interactions |
| SC-6 | Revisions are legible without rereading | Confirm the diff and its reason answer what changed and why, at a glance, without re-reading the surrounding paragraph |
| SC-7 | The document still sounds like the person who wrote it | Read the finished document aloud and confirm the voice is the author's throughout |
| SC-8 | Accepted changes are not regretted | Confirm accepts are rarely followed immediately by undo, which would mean the diff was not legible enough to judge before accepting |
| SC-9 | The key gate is passed without hesitation | Watch a first-time user reach the editor without abandoning at the modal or asking where their key is going |

**The authorship principle.**
The human is the author of the document and the AI is not.
This is judged by inspection, not measured: if a finished Chiri document reads as something the AI wrote and the user approved, the product has failed, no matter how well every other criterion scores.
The three structural guarantees that hold this in place are that continuations are at most two sentences, that revisions are confined to the span the user selected, and that nothing at all enters the document without an explicit accept.

## 7. Functional Requirements

| ID | Title | Priority | Implementation | Detail |
|---|---|---|---|---|
| FR-1 | API key gate | P0 | Built, partially verified | [fr-1.md](./fr-1.md) |
| FR-2 | Launch identity | P2 | Built | Below |
| FR-3 | Single Markdown document surface | P0 | Built and verified | Below |
| FR-4 | Local persistence of the document | P0 | Built | Below |
| FR-5 | Inline continuation prediction | P0 | Not started | [fr-5.md](./fr-5.md) |
| FR-6 | Selection-triggered AI revisions | P0 | Built, partially verified | [fr-6.md](./fr-6.md) |
| FR-7 | Refine a revision in place | P0 | Not started | Below |
| FR-8 | Model selector | P1 | Built, partially verified | Below |
| FR-9 | Export the document | P1 | Built, partially verified | Below |
| FR-10 | Prediction request discipline | P0 | Not started | Below |
| FR-11 | Empty-document onboarding cue | P1 | Not started | Below |
| FR-12 | AI failure and offline behavior | P0 | Not started | Below |

`Implementation` tracks whether the code exists and what proves it, and is separate from the `Status` field above, which tracks the maturity of this document.
`Built and verified` means every scenario the requirement's test plan marks automatable is automated and passing.
`Built, partially verified` means the feature works but a named subset of its plan is still unwritten, and the requirement names which.

### FR-1: API key gate

**Priority:** P0
**Depends on:** None
**Implementation:** Built, partially verified.
8 of the 22 test-plan scenarios are automated: T-FR-1-1, 3, 4, 5, 6, 7, 9, and 10.
T-FR-1-2, T-FR-1-8, and T-FR-1-11 through T-FR-1-22 are not yet written, so mid-session revocation and key clearing rest on the implementation rather than on a passing test.

Chiri requires the user's own OpenRouter API key, entered at runtime in a modal, and validates it with a live call to OpenRouter before unblocking the app.
No key ships in the build, the key is stored only on the user's machine, and the app sends it nowhere except OpenRouter.
Until a key is confirmed valid, the editor is not reachable.

Modal states, validation outcomes, mid-session key revocation, and key clearing: [fr-1.md](./fr-1.md).

### FR-2: Launch identity

**Priority:** P2
**Depends on:** None

Chiri shows its logo when the application starts, before the editor is interactive, so the product identifies itself once and then gets out of the way.
The launch state is bounded in time and never becomes a thing the user waits behind.

The mark is shown from application start until the app is ready to present either the key gate (FR-1) or the editor (FR-3).
It is shown for a minimum dwell so it does not flash, and it is never held artificially once the app is ready beyond that minimum.
The launch state is non-interactive and carries no controls, no marketing copy, and no dismissal affordance.

**Acceptance criteria**

AC-2.1 Given a cold app load, when the application starts, then the Chiri logo is visible before any editor content or modal is presented.
AC-2.2 Given the app becomes ready in under the minimum dwell, when the ready signal fires, then the logo remains visible until the minimum dwell elapses and then transitions once, without flicker or a second transition.
AC-2.3 Given the app is ready, when the launch state ends, then the next surface presented is the key gate if no valid key is stored, or the editor if one is.
AC-2.4 Given the launch state is on screen, when the user clicks or types, then nothing is dismissed and no input is lost to the transition.

The exact minimum dwell value, the mark rendering, and the transition treatment are owned by the future design document.

**Tests:** [FR-2 test plan](../../tests/chiri/fr-2.md)

### FR-3: Single Markdown document surface

**Priority:** P0
**Depends on:** FR-1
**Implementation:** Built and verified.
Every scenario the test plan marks automatable is automated and passing across Chromium, Firefox, and WebKit.
T-FR-3-4 and T-FR-3-12 remain manual by the plan's own direction.
Two of T-FR-3-7's five application states are deferred until FR-5 and FR-6 exist to produce them, and T-FR-3-5, T-FR-3-6 and T-FR-3-9 stage their accepted AI edits directly until the same two land.

Chiri presents exactly one Markdown document, occupying the primary surface of the application, with no file tree, document list, tabs, or sidebar.
The user writes Markdown and sees it rendered as structured text as they write, so the document reads as the thing it will become rather than as source code.
This surface is where all AI collaboration happens, which is why nothing else is allowed to compete with it for space.

The editor supports the Markdown constructs a drafting writer uses: headings, paragraphs, bold and italic, ordered and unordered lists, links, inline code, fenced code blocks, blockquotes, and horizontal rules.
The user can produce every supported construct using standard Markdown syntax typed directly into the document, without needing a toolbar.
The document's canonical form is Markdown text, and what the user copies or downloads in FR-9 round-trips back into the editor as the same document.
The editor provides undo and redo covering both human edits and accepted AI changes, in a single ordered history.

**Acceptance criteria**

AC-3.1 Given an empty document, when the user types Markdown syntax for any supported construct, then the construct is applied in the document as the user types.
AC-3.2 Given a document containing every supported construct, when the user exports it per FR-9 and the exported text is pasted back into an empty Chiri document, then the resulting document is structurally identical to the original.
AC-3.3 Given the user has accepted AI output, when the user invokes undo, then the accepted change is reverted as a single unit and the document returns to its pre-accept state.
AC-3.4 Given the user reverted an accepted change, when the user invokes redo, then it is reapplied.
AC-3.5 Given the application is open at any point after the key gate, when the user inspects the interface, then no file tree, document list, document switcher, or chat panel is present.
AC-3.6 Given the user types continuously for 60 seconds, when they observe the editor, then input is never blocked or delayed by an in-flight AI request, per NFR-2.

The editor library, the document model, and the Markdown parse and serialize path are owned by the future architecture document.
Typography, spacing, and the visual treatment of each construct are owned by the future design document.

**Tests:** [FR-3 test plan](../../tests/chiri/fr-3.md)

### FR-4: Local persistence of the document

**Priority:** P0
**Depends on:** FR-3

Chiri keeps the single document on the user's machine so that closing the tab, reloading, or crashing the browser does not lose work.
Persistence is local only: there is no server-side copy, no sync between browsers, and no sync between devices.
This is the durability floor, and export in FR-9 is how the user gets a copy that outlives the browser profile.

The document is saved automatically as the user writes, with no explicit save action anywhere in the interface.
Pending AI output is not part of the persisted document, because anything unaccepted is not the user's text.
On return, the user lands in the same document with the caret restored to a sensible position rather than at an arbitrary offset.

**Acceptance criteria**

AC-4.1 Given a document with content, when the user reloads the page, then the document content is identical to what was on screen before the reload.
AC-4.2 Given the user typed a character, when 2 seconds pass with no further input, then that character is present in local storage and survives a reload.
AC-4.3 Given a continuation or a pending revision is on screen, when the user reloads, then the document contains no part of it and none is restored.
AC-4.4 Given the browser is closed and reopened after a session, when the user returns to Chiri in the same browser profile, then the document is present and editable.
AC-4.5 Given the user has never used Chiri in this browser profile, when the app loads, then the document is empty and FR-11 applies.

The storage mechanism, write scheduling, and quota handling are owned by the future architecture document.

**Tests:** [FR-4 test plan](../../tests/chiri/fr-4.md)

### FR-5: Inline continuation prediction

**Priority:** P0
**Depends on:** FR-1, FR-3, FR-10

While the user writes, Chiri offers the next span of text in grey at the caret, which the user takes with a single keystroke or dismisses by continuing to type.
The continuation is short by design, because the AI is finishing the user's thought rather than writing the next section for them.
Nothing enters the document until the user accepts.

This is the only thing Chiri does without being asked, it is on by default, and it operates strictly forward on text that does not exist yet.
It never alters text the user has already written.

Trigger conditions, acceptance granularity, dismissal, and the off switch: [fr-5.md](./fr-5.md).

### FR-6: Selection-triggered AI revisions

**Priority:** P0
**Depends on:** FR-1, FR-3

Text the user has already written changes only when the user selects it and asks.
Selecting text raises a small floating action bar at the selection, offering "Ask AI", a few one-tap actions such as shorten or change tone, and a free-text instruction field.
The result appears inline as a tracked-change diff over exactly the selected span, which the user accepts, rejects, or refines.

There is no idle trigger, no timer, and no background scan of the document.
A user who never selects anything never sees a revision.

The action bar, revision lifecycle, scoping rules, and conflict handling: [fr-6.md](./fr-6.md).

**Implementation:** Built, partially verified.
The action bar, the request path, the inline review surface, accept, reject, the span tracking through concurrent edits, the out-of-span containment check, and the paragraph-count refusal are all built and covered by [the test plan](../../tests/chiri/fr-6.md): T-FR-6-2, 3, 6, 7, 9, 10, and 11 are automated and passing on Chromium.

Seventeen of the plan's twenty-four scenarios are unwritten, and these P0 ones name real gaps in the code rather than merely missing tests:
T-FR-6-12 (a second request while one is pending is refused) and T-FR-6-13 (clearing the selection cancels an in-flight request) have no implementation at all - `SelectionActionBar` guards re-entry with a local `busy` flag and passes no `AbortSignal`.
T-FR-6-21 (a visible, dismissible failure message with retry) surfaces a plain line of text with no retry affordance.
T-FR-6-1 (no revision ever appears without a selection), T-FR-6-4 (the free-text instruction path), T-FR-6-5 (clearing the selection dismisses the bar), T-FR-6-8 (an out-of-span response is discarded), T-FR-6-14 (keyboard-only operation), and T-FR-6-15 (a pending revision does not survive reload) are unverified.
Firefox and WebKit have not been run at all; every result above is Chromium only.

### FR-7: Refine a revision in place

**Priority:** P0
**Depends on:** FR-6

When a revision is nearly right, the user gives a short instruction attached to it and receives a revised result in the same place, without opening a chat panel and without losing the original.
Refinement is multi-turn, so "make it shorter" can be followed by "now less formal" and each turn builds on the last.
This is how the user steers the AI without becoming its prompt engineer.

A refinement instruction is scoped to the pending revision and applies to that revision's span only.
Each refinement replaces the visible proposed text with a new result over the same span, and the pre-revision original text remains the reject target throughout.
Refinement history for a given revision is retained for the life of that revision, so the model sees prior instructions in the same chain.
The refinement input is dismissible without cancelling the underlying revision.
Accepting after any number of refinements commits exactly the currently visible proposed text.

**Acceptance criteria**

AC-7.1 Given a pending revision, when the user submits a refinement instruction, then a revised result replaces the visible proposed text over the same span and the original text is still shown as the removal side of the diff.
AC-7.2 Given the user has refined a revision once, when they submit a second instruction, then the result reflects both instructions in sequence rather than only the most recent one.
AC-7.3 Given a refinement is in flight, when the user rejects the revision, then the in-flight request is cancelled and the document is unchanged.
AC-7.4 Given a refined revision, when the user accepts it, then the document contains exactly the currently visible proposed text and nothing from earlier refinement turns.
AC-7.5 Given the user opens the refinement input, when they dismiss it without submitting, then the revision remains pending and unchanged.
AC-7.6 Given a refinement request fails, when the failure is surfaced, then the revision reverts to its last successful state and remains acceptable or rejectable, per FR-12.

Conversation state handling and request construction are owned by the future architecture document.
The refinement input's placement, affordance, and copy are owned by the future design document.

**Tests:** [FR-7 test plan](../../tests/chiri/fr-7.md)

### FR-8: Model selector

**Priority:** P1
**Depends on:** FR-1
**Implementation:** Built, partially verified.
11 of the 12 test-plan scenarios are automated and passing: T-FR-8-1 through T-FR-8-6 and T-FR-8-8 through T-FR-8-12.
T-FR-8-7 is the plan's one manual-judgment scenario and is not automatable in a way that would mean anything.
T-FR-8-3, T-FR-8-4, T-FR-8-8, and T-FR-8-12 are covered at the request-assembly and scheduler layer only.
Their browser halves need a request the user can trigger from the UI, and src/core/schedule.ts is not yet wired into the editor, so they are owed once FR-5, FR-6, and FR-12 land.

The user chooses which OpenRouter model powers Chiri's output, from a control in the application surface.
The default is `openai/gpt-4o-mini`, preselected, because it is fast enough for continuation to arrive during a natural pause and capable enough for revision work.
The default exists so the user never has to make a model decision to get value, and the selector exists so a user hitting a hard paragraph can reach for something stronger.
The selection persists across reloads.

The selector offers a small curated list of OpenRouter models rather than the full provider catalog, because a list of hundreds is a worse decision surface than a list of five and the product has no need to expose every option.
The selector is available once the key gate is passed and is reachable without leaving the document surface.
Changing the model takes effect on the next request and does not affect output already on screen.
Continuation prediction (FR-5) and revisions (FR-6) may use different models, and if they do, the selector states which selection applies to what.

**Acceptance criteria**

AC-8.1 Given a first-ever session, when the user reaches the editor, then `openai/gpt-4o-mini` is already selected and AI output can be produced without the user opening the selector.
AC-8.2 Given the user selects a different model, when the next request is made, then that request uses the newly selected model.
AC-8.3 Given the user selects a different model while a revision is pending, when the change is made, then the pending revision is unaffected and remains acceptable.
AC-8.4 Given the user selected a non-default model, when they reload the page, then the same model is still selected.
AC-8.5 Given the user opens the selector, when they read it, then each option carries enough information to choose between speed and capability, and the curated list is short enough to scan without scrolling a long list.
AC-8.6 Given a selected model is rejected by the provider as unavailable, when a request fails for that reason, then the failure is surfaced per FR-12 and the default model remains selectable.

The curated list's exact membership, and the request wiring behind it, are owned by the future architecture document.

**Tests:** [FR-8 test plan](../../tests/chiri/fr-8.md)

### FR-9: Export the document

**Priority:** P1
**Depends on:** FR-3
**Implementation:** Built, partially verified.
8 of the 17 test-plan scenarios are automated: T-FR-9-1, 2, 3, 4, 7, 8, 9, and 15, running as 11 cases because T-FR-9-3 is table-driven over five headings.
They pass on Chromium and Firefox.
On WebKit the four scenarios that read the clipboard back (T-FR-9-1, 2, 8, 15) fail on `NotAllowedError`, because WebKit does not support granting `clipboard-read` to a context the way Chromium does; this is a harness limit, not a defect, but it does mean AC-9.1 is unproven on Safari, which the test plan explicitly calls out as the browser most likely to differ.
T-FR-9-5 and T-FR-9-6, the pending-output exclusion scenarios behind AC-9.5, are owed once FR-5 and FR-6 land in the editor.
T-FR-9-10 through T-FR-9-14 are unwritten filename and determinism edge cases, and T-FR-9-16 and T-FR-9-17 are manual-only.

Because there is no account and no server copy, export is how the user's work leaves the browser.
Chiri offers copy-to-clipboard and download as a `.md` file, both producing the canonical Markdown of the current document.
Export never includes pending AI output, because that is not the user's text.

Both export paths produce byte-identical Markdown for the same document state.
The downloaded file has a `.md` extension and a filename derived from the document's first heading, falling back to a fixed default when the document has no heading.
Export is available at any time after the key gate, including when the document is empty.

**Acceptance criteria**

AC-9.1 Given a document with content, when the user copies to clipboard, then the clipboard contains the document's Markdown and a confirmation is shown.
AC-9.2 Given a document with content, when the user downloads, then a `.md` file is saved whose contents are byte-identical to the clipboard output for the same document state.
AC-9.3 Given a document whose first line is a heading, when the user downloads, then the filename is derived from that heading text.
AC-9.4 Given a document with no heading, when the user downloads, then the filename is the fixed default and the download still succeeds.
AC-9.5 Given a continuation or a pending revision is on screen, when the user exports by either path, then the output contains the current document text and no part of the pending output.
AC-9.6 Given the clipboard is unavailable in the browser, when the user attempts to copy, then a failure is surfaced per FR-12 and download remains available.

The clipboard and download mechanisms are owned by the future architecture document.
The confirmation treatment is owned by the future design document.

**Tests:** [FR-9 test plan](../../tests/chiri/fr-9.md)

### FR-10: Prediction request discipline

**Priority:** P0
**Depends on:** FR-5

Continuation fires without the user asking, which makes request timing a quality problem.
A request sent mid-keystroke returns a suggestion for a sentence the user has already moved past, so it arrives stale, lands as visual noise, and trains the user to ignore grey text.
Chiri therefore speaks to the model only when the user has actually paused, and throws away work the user has already made irrelevant.

This requirement is about responsiveness and suggestion quality, not about cost.
Provider spend is not a product constraint and is not surfaced anywhere, per Non-Goal 8.

Chiri does not issue a prediction request on every keystroke.
Requests are issued only after the user's input has settled, and a new request supersedes and cancels any in-flight request for the same purpose.
When the user's caret moves away from the region a request was made for, that request is cancelled and its result is discarded rather than shown, because a suggestion for a position the user has left is worse than no suggestion.
Chiri enforces a ceiling on concurrent outbound requests and a ceiling on requests per minute, so that fast typing cannot flood the provider and degrade latency for the request that matters.
Dropping a prediction is silent, because a warning about a request the user never asked for is noise.
Continuation prediction is on by default and can be turned off by the user, and the off state persists across reloads.

Requests originating from FR-6 are user-initiated and are not debounced or dropped, because the user is waiting for them.

**Acceptance criteria**

AC-10.1 Given the user types continuously, when 60 seconds of typing elapse without a pause exceeding the settle threshold, then no continuation request is issued.
AC-10.2 Given a prediction request is in flight, when the user types again, then that request is cancelled before a new one is issued and at most one continuation request is in flight at any time.
AC-10.3 Given a request whose result arrives after the caret has left its region, when the response arrives, then nothing is displayed and the document is unchanged.
AC-10.4 Given the per-minute request ceiling is reached, when another prediction would be triggered, then no request is sent and no error is shown to the user.
AC-10.5 Given the user turns continuation prediction off, when they reload the page, then it is still off and no continuation requests are issued.
AC-10.6 Given continuation prediction is off, when the user selects text and asks for a revision, then FR-6 works normally.

Debounce values, cancellation mechanism, and concurrency control are owned by the future architecture document.

**Tests:** [FR-10 test plan](../../tests/chiri/fr-10.md)

### FR-11: Empty-document onboarding cue

**Priority:** P1
**Depends on:** FR-3

A first-time user lands in an empty document and must know what to do within a second, without a tour, a modal, or sample content.
Chiri shows a single quiet cue in the empty document that invites the user to start writing and names the one interaction they cannot guess: that a grey suggestion is taken with a keystroke.
The cue disappears the moment the user starts, and never returns for a non-empty document.

The document starts empty, with no seeded sample text, because the user's first act must be writing their own words.
The cue conveys, at minimum, that the user should start typing and how to accept a continuation when one appears.
The cue is not interactive and never blocks input.

**Acceptance criteria**

AC-11.1 Given a first-ever session, when the editor is presented, then the document is empty and contains no sample or placeholder content in the exported Markdown.
AC-11.2 Given an empty document, when the user views the editor, then the cue is visible and states how to begin and how to accept a continuation.
AC-11.3 Given the cue is visible, when the user types the first character, then the cue is no longer shown and the typed character is present in the document.
AC-11.4 Given a user deletes all content from a previously non-empty document, when the document becomes empty, then the cue may reappear and typing dismisses it again with no content loss.

The cue's wording, placement, and treatment are owned by the future design document.

**Tests:** [FR-11 test plan](../../tests/chiri/fr-11.md)

### FR-12: AI failure and offline behavior

**Priority:** P0
**Depends on:** FR-1, FR-5, FR-6

The AI is a network dependency and the document is not, so failures in the former must never damage or block the latter.
Chiri degrades to a plain Markdown editor when the model is unreachable, and tells the user only when they asked for something that did not happen.
An unexplained silence after an explicit request is the failure mode to avoid.

Failures fall into two classes and are treated differently, and the split follows exactly the same line as the product itself.
Continuation failures are silent, because the user did not ask and surfacing an error for unrequested work is noise.
Revision and refinement failures are always visible, dismissible, and offer a retry, because the user selected text, clicked, and is waiting.
Authentication failures are the exception to silence: a rejected key returns the app to the key gate per FR-1 regardless of what triggered the request.

| Condition | Expected behavior | Criterion |
|---|---|---|
| Network unreachable, continuation | No result, no message, editing continues | AC-12.1 |
| Network unreachable, revision or refinement | Visible dismissible failure message with retry | AC-12.2 |
| Provider returns rate-limit response | Continuation pauses and resumes automatically, revisions report a retryable failure | AC-12.3 |
| Provider rejects the key mid-session | App returns to the key gate per FR-1, document preserved | AC-12.4 |
| Provider reports insufficient credit | Visible message naming credit as the cause, editing continues | AC-12.5 |
| Response is malformed or empty | Treated as a failed request for its class, document unchanged | AC-12.6 |

**Acceptance criteria**

AC-12.1 Given the network is unavailable, when the user types continuously, then no error is shown, no continuation appears, and every keystroke is retained in the document.
AC-12.2 Given the network is unavailable, when the user requests a revision over a selection, then a dismissible failure message with a retry action appears within 10 seconds and the document is unchanged.
AC-12.3 Given the provider returns a rate-limit response, when the condition clears, then continuation resumes without the user reloading the page.
AC-12.4 Given the provider rejects the stored key mid-session, when the rejection is received, then the app presents the key gate and the document content is intact when the gate is passed again.
AC-12.5 Given the provider reports insufficient credit, when a request fails for that reason, then the message names credit exhaustion as the cause and the editor remains fully usable for writing.
AC-12.6 Given any failed request of any class, when the failure resolves, then the document contains exactly the text it contained before the request.

Retry policy, error classification, and provider response mapping are owned by the future architecture document.
Message placement and wording are owned by the future design document.

**Tests:** [FR-12 test plan](../../tests/chiri/fr-12.md)

## 8. Non-Functional Requirements

NFR-1 Suggestion latency: the first visible content of any AI output appears within 2.0s at p95 and 4.0s at p99 on the default model, measured client-side from request dispatch to first render.
This is judged by hand against SC-2 rather than instrumented, since no telemetry ships.
The mechanism reaching this target, including streaming and model choice, is owned by the future architecture document.

NFR-2 Input responsiveness: keystroke-to-render latency stays under 50ms at p95 in a document of 20,000 characters, and never degrades while an AI request is in flight.
AI work must not occupy the main thread in a way that blocks typing.

NFR-3 Key handling: the API key is stored only on the user's device and is transmitted to exactly one destination, OpenRouter.
Chiri has no backend and no analytics, so there is no other destination it could reach.
The key never appears in a log line, an error report, or a URL.

NFR-4 Content privacy: document text is transmitted to exactly one destination, OpenRouter, and only as part of a continuation or revision request the user's own activity triggered.
Chiri collects no usage data, sends nothing to any analytics service, and has no server of its own to send anything to.

NFR-5 Durability: no more than 2 seconds of typed input is lost in an unexpected browser termination, per AC-4.2.

NFR-6 Accessibility: all interactive controls are reachable and operable by keyboard alone, the selection action bar can be raised and used without a pointer, every revision can be accepted, rejected, and refined without a pointer, and the appearance and resolution of AI output is announced to assistive technology.
Color is never the sole carrier of the distinction between added and removed text in a diff, and grey continuation text meets contrast requirements while remaining visually distinct from committed text.
Target is WCAG 2.1 AA for contrast and keyboard operability.

NFR-7 Browser support: the app functions on current Chrome, Safari, Firefox, and Edge on desktop.
Mobile browsers render a usable editor but are not a design target, and no acceptance criterion is gated on mobile.

NFR-9 Localization: the interface ships in English only in v1, and the model may produce output in whatever language the document is written in.
No acceptance criterion depends on the interface being translated.

## 9. Dependencies and Integrations

| Dependency | Nature | What it blocks |
|---|---|---|
| OpenRouter API | Sole model provider, called directly from the browser with the user's key | FR-1, FR-5, FR-6, FR-7, FR-8, and therefore the entire AI value proposition |
| `openai/gpt-4o-mini` availability on OpenRouter | The pinned default model | FR-8, NFR-1 |
| OpenRouter browser CORS support for direct client calls | Confirmed available, and what makes the no-backend architecture possible | Every AI requirement, per A-2 |
| Browser local storage | Document and settings persistence | FR-4, FR-8 persistence, FR-10 preference persistence |
| Prebuilt Markdown editor library | Editing surface, inline grey ghost text, inline diff decorations, selection-anchored floating UI | FR-3, FR-5, FR-6 |
| Chiri brand mark | Launch identity asset | FR-2 |

Nothing here depends on an internal team, since the product ships without a backend.
The editor library choice is owned by the future architecture document, but three of its capabilities are product requirements rather than implementation preferences, because FR-5 and FR-6 are undeliverable without them: inline ghost text at the caret, inline tracked-change decorations, and a floating element anchored to a live text selection.

## 10. Assumptions

Each assumption below is a judgment call made in place of an answer, with what breaks if it is wrong.
Decisions that have been settled by the product owner are recorded as decisions, not assumptions, and appear in the requirements themselves.

A-1 OpenRouter is the only model provider in scope, and the model selector lists a curated set of OpenRouter models.
If a second provider becomes a requirement, FR-8 and the key gate in FR-1 both widen.

A-2 The app is a client-only single-page application with no backend of ours, and the browser calls OpenRouter directly.
Direct browser-to-OpenRouter calls are confirmed workable by the product owner, so this is a settled constraint rather than an open risk, and no proxy, gateway, or server-side component is required to ship.

A-3 The key is the user's own and is supplied at runtime, held in browser-local storage, and never transmitted anywhere except OpenRouter.
If a shared or embedded key were used instead, FR-1 disappears.

A-4 Key validation is a live call to OpenRouter at submit time, and anything short of a confirmed-valid response leaves the app blocked.
If live validation is unavailable, the gate becomes format-only and users will get past it with keys that do not work.

A-5 The product's value rests on the asymmetry between forward and backward help: prediction ahead of the caret is unrequested and constant, while any change to existing text requires an explicit selection.
If users turn out to want the AI to flag weak paragraphs on its own, this is the assumption that was wrong, and FR-6 would need an entirely different trigger model.

A-6 One-tap actions on the selection bar cover the majority of revision requests, with free text as the escape hatch.
If users type an instruction nearly every time, the one-tap set is wrong and should be replaced rather than extended.

A-7 The single document persists locally across reloads, with no server-side persistence and no cross-browser or cross-device sync.
If users expect their document on a second device, export in FR-9 is the only answer, and that may not be enough.

A-8 Collaboration means one human and one AI, with no multi-human real-time editing, presence, or CRDT sync.
If multi-human editing enters scope, the document model and conflict handling change fundamentally.

A-9 The target is current desktop Chrome, Safari, Firefox, and Edge, with mobile usable but not designed for.
If mobile becomes a primary surface, both the ghost-text interaction in FR-5 and the selection action bar in FR-6 need distinct designs, since neither maps cleanly to touch.

A-10 Request discipline in FR-10 is motivated by suggestion quality and responsiveness, not by cost.
Provider spend is not a constraint on this product at any budget.
If latency on the default model turns out to be well inside the settle threshold anyway, FR-10's ceilings could relax, though cancellation of stale requests would still be required.

A-11 The document starts empty with a light cue rather than sample content, so the user's first act is their own writing.
If a cold empty document turns out to make the first continuation useless for lack of context, FR-11 needs rethinking.

A-12 Export by clipboard copy and `.md` download is in scope, because with no account the local copy is the only copy.
If export were cut, an evicted browser storage entry would mean total data loss.

A-13 Version history is out of scope and editor undo and redo cover reversal.
If users accept many changes and then want to see how the document evolved, undo alone will feel thin.

A-14 Success can be judged by hand, without instrumentation, because the product ships no telemetry.
If a judgment call in section 6 turns out to be genuinely contested between reviewers, there is no data to settle it, and the disagreement has to be resolved by watching more users rather than by measuring.

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Continuation is wrong often enough that users learn to ignore grey text | Medium | High | Short two-sentence ceiling, suppression where continuation makes no sense per FR-5, stale-response discard in AC-10.3, and SC-3 as the judgment call on whether it became habit |
| Continuation arrives after the user has typed past it | Medium | High | Fast default model, settle-threshold triggering and aggressive cancellation in FR-10, and NFR-1 judged by hand against SC-2 |
| The selection action bar is missed entirely and users never discover revisions | Medium | High | The bar appears automatically on any selection rather than behind a menu, and SC-1 tests exactly this discovery on a first-time user |
| The AI drifts into ghostwriting and the document stops sounding like the user | Low | High | Structurally prevented: continuations capped at two sentences, revisions confined to the selected span per AC-6.9, explicit accept for every change, and SC-7 as the read-aloud check |
| Users find the selection bar intrusive while making ordinary selections for copy or delete | Medium | Medium | The bar is non-modal, never obscures the selected text, and disappears with the selection, per AC-6.3 |
| Browser storage is evicted and the user loses the only copy of the document | Low | High | Export in FR-9, and an onboarding expectation that the local copy is not a backup |
| The chosen editor library cannot do inline ghost text, inline tracked changes, and selection-anchored floating UI together | Medium | Critical | Treat all three as hard selection criteria, flagged in Dependencies, and validate them before any other AI work starts |
| Users paste a key into a modal they do not trust and abandon | Medium | Medium | State plainly at the gate that the key stays on the device and goes only to OpenRouter, and judge it against SC-9 |
| With no telemetry, a quality regression ships unnoticed | Medium | Medium | Section 6 criteria are cheap enough to run by hand before each release, and the product surface is small enough that a single session covers all of them |

## 12. Open Questions

Everything the product owner needed to decide has been decided.
What remains are the two companion documents this PRD defers to, plus per-requirement questions recorded in the split files.

| # | Question | Owner | Blocks | Needed by |
|---|---|---|---|---|
| 1 | The future architecture document needs a section covering direct-from-browser OpenRouter calls, streaming, cancellation, and request ceilings | Engineering | NFR-1, NFR-2, FR-10 | Before implementation starts |
| 2 | The future design document needs sections covering the key gate, the launch state, grey continuation text, the selection action bar, and inline diff presentation | Design | FR-1, FR-2, FR-5, FR-6, NFR-6 | Before implementation starts |

Per-requirement questions live with their requirements: Q1-a and Q1-b in [fr-1.md](./fr-1.md), Q5-a and Q5-b in [fr-5.md](./fr-5.md), and Q6-a through Q6-c in [fr-6.md](./fr-6.md).

## 13. Out of Scope and Future Work

The feature set described in this document is closed.
Chiri is a single-document, frontend-only Markdown editor with a predictive co-author, and it is not intended to grow into anything else.

Future work is user experience and interface refinement only: the quality of the continuation, the feel and placement of the selection action bar, the legibility of diffs, the typography of the document, and the restraint of everything around it.
No new capability is planned, and requests for one should be treated as a change to this document's scope rather than as an increment to it.

Everything previously considered and rejected is recorded in section 4, Non-Goals, with the reason for each.
Nothing is parked in a "later" list, because a later list implies a roadmap this product does not have.

## 14. Related Documents

- [FR-1: API key gate](./fr-1.md)
- [FR-5: Inline continuation prediction](./fr-5.md)
- [FR-6: Selection-triggered AI revisions](./fr-6.md)

There is no architecture document and no design document for Chiri yet.
Sections routed out of this PRD name their future owner in prose, and Open Questions 1 and 2 track the handoffs those documents need to carry.

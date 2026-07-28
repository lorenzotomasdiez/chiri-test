# FR-5: Inline continuation prediction

| Field | Value |
|---|---|
| Parent | [PRD](./index.md) |
| Priority | P0 |
| Status | Draft |
| Depends on | FR-1, FR-3, FR-10 |
| Tests | [FR-5 test plan](../../tests/chiri/fr-5.md) |

## Summary

While the user writes, Chiri proposes the next span of text as ghost text at the caret, which the user takes with a single keystroke or dismisses by continuing to type.
The continuation is short by design, because the AI is finishing the user's thought rather than writing the next section for them.
Nothing enters the document until the user accepts.

This is the only thing Chiri does without being asked, and it works strictly forward, on text that does not exist yet.
It never alters text the user has already written.

## User Stories

As a writer mid-sentence, I want the rest of my sentence offered to me when I pause, so that I keep momentum instead of stalling on phrasing.

As a writer with a specific voice, I want to take only the part of a suggestion that sounds like me, so that accepting help does not mean accepting someone else's wording wholesale.

As a writer who does not want help right now, I want to ignore a suggestion by simply continuing to type, so that dismissing costs me nothing.

## Behavior

### What is proposed

A continuation is a short span of text that would plausibly follow the caret, generated with the surrounding document as context.
The continuation is bounded: it completes the current sentence, and at most extends into the following one.
It never proposes a new heading, a new section, or more than two sentences, because a proposal that large is authorship rather than assistance and violates the authorship principle in section 6 of the index.

Continuation is offered only where a continuation makes sense.
It is offered when the caret sits at the end of a paragraph or list item with a non-empty preceding context.
It is not offered inside a fenced code block, inside a link target, in the middle of an existing word, or when the caret is inside a selection.

### Trigger and lifecycle

| State | Entered when | Exits when |
|---|---|---|
| Idle | No continuation shown and none requested | The user pauses at an eligible caret position |
| Requested | Input has settled at an eligible position and FR-10 permits a request | A response arrives, the request is cancelled, or it fails |
| Shown | A response arrives while the caret is still where it was requested | The user accepts, dismisses, or moves the caret |
| Accepted | The user presses the accept key | Immediately, into Idle, with the text committed |

A request is issued only after typing settles, never per keystroke, per FR-10.
At most one continuation is shown at a time.
A continuation whose response arrives after the caret has moved is discarded silently, per AC-10.3.

### Acceptance granularity

The user accepts the whole continuation with a single dedicated keystroke.
The user can also accept only the next word of the continuation with a distinct keystroke, leaving the remainder shown and still acceptable.
Partial acceptance exists because taking half of a suggestion is the most common way a writer keeps their own voice.

Accepted text enters the document as a single undoable unit, per AC-3.3.

### Dismissal

Typing any character that is not an accept key dismisses the continuation and inserts the typed character normally.
Moving the caret dismisses the continuation.
Pressing the dismiss key removes the continuation without inserting anything.
Dismissal is always silent and never asks the user to confirm.

### Relationship to selection-triggered revisions

Continuation is the only thing Chiri offers without being asked, and it only ever operates ahead of the caret, on text that does not exist yet.
It never modifies, replaces, or comments on text the user has already written.
Changing existing text requires the user to select it first, which is FR-6.

Continuation and revisions never occupy the same span at the same time.
Continuation is suppressed while a selection is active, and suppressed within the span of a pending revision, so the user is never asked to judge two overlapping AI outputs at once.
Continuation remains available elsewhere in the document.

### User control

Continuation prediction is on by default, so a first-time user sees the product's core interaction without configuring anything.
It can be turned off, and the off state persists across reloads, per AC-10.5.
With it off, FR-6 revisions continue to work on selection.

## Acceptance Criteria

AC-5.1 Given the caret is at the end of a non-empty paragraph, when the user stops typing and the settle threshold elapses, then a continuation is shown at the caret within the latency bar in NFR-1 or nothing is shown at all.
AC-5.2 Given a continuation is shown, when the user presses the accept key, then the full continuation text is inserted at the caret, the ghost text is cleared, and the caret sits at the end of the inserted text.
AC-5.3 Given a continuation is shown, when the user presses the accept-word key, then exactly the next word is inserted and the remainder of the continuation remains shown.
AC-5.4 Given a continuation is shown, when the user types any other character, then the continuation disappears and the typed character appears in the document with no continuation text inserted.
AC-5.5 Given a continuation is shown, when the user moves the caret with an arrow key or a click, then the continuation disappears and the document is unchanged.
AC-5.6 Given a continuation was never accepted, when the user exports or reloads, then no part of it is present in the document, per AC-4.3 and AC-9.5.
AC-5.7 Given the caret is inside a fenced code block, when the user pauses, then no continuation is requested and none is shown.
AC-5.8 Given a text selection is active, when the user pauses, then no continuation is requested and none is shown.
AC-5.9 Given a continuation was accepted, when the user invokes undo once, then the entire accepted continuation is removed as one unit.
AC-5.10 Given a model response proposes more than two sentences, when it would be shown, then the shown continuation is truncated to at most two sentences.
AC-5.11 Given a revision is pending over the span containing the caret, when the user pauses, then no continuation is requested within that span.
AC-5.12 Given a first-ever session, when the user starts writing, then continuation prediction is active without the user enabling anything.
AC-5.13 Given continuation prediction has been turned off, when the user writes anywhere in the document, then no continuation is ever shown and no continuation request is issued.
AC-5.14 Given a continuation is shown, when the user operates the editor with the keyboard only, then the presence of the continuation is announced to assistive technology and it can be accepted and dismissed without a pointer, per NFR-6.
AC-5.15 Given the user has written several paragraphs and pauses anywhere in the document, when no selection is active, then nothing Chiri shows alters, replaces, or annotates text already written.

## Edge Cases and Error States

| Condition | Expected behavior | Criterion |
|---|---|---|
| Response arrives after the caret moved | Discarded silently, nothing shown | AC-5.5, AC-10.3 |
| Response is empty or whitespace only | Nothing shown, no error | AC-12.1 |
| Response duplicates text already after the caret | Shown continuation excludes the duplicated tail, or nothing is shown | AC-5.10 |
| Response exceeds two sentences | Truncated at a sentence boundary before display | AC-5.10 |
| Request fails or the network is unavailable | Silent, editing continues | AC-12.1 |
| Rate limit reached | No request issued, silent, resumes when clear | AC-10.4, AC-12.3 |
| Caret inside a code block, link target, or mid-word | No request, no display | AC-5.7 |
| Document is empty | No continuation, FR-11 cue applies instead | AC-11.2 |

## Open Questions

Q5-a Which keystrokes accept the full continuation and the next word, and how do they avoid colliding with editor and browser defaults across the four target browsers.
This is a product decision with an accessibility constraint, not a design detail, and it blocks AC-5.2 and AC-5.3.

Q5-b Does the two-sentence ceiling hold for list items, where a single item is often the natural unit.
Mirrored nowhere else because it affects only this requirement.

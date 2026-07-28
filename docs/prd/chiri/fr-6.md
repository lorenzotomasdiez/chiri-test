# FR-6: Selection-triggered AI revisions

| Field | Value |
|---|---|
| Parent | [PRD](./index.md) |
| Priority | P0 |
| Status | Draft |
| Depends on | FR-1, FR-3 |
| Tests | [FR-6 test plan](../../tests/chiri/fr-6.md) |

## Summary

Chiri changes text the user has already written only when the user selects that text and asks.
Selecting text raises a small floating action bar anchored to the selection, offering "Ask AI" plus a few one-tap actions and a free-text instruction.
The result comes back inline as a tracked-change diff over the selection, which the user accepts, rejects, or refines.

Nothing in this requirement ever fires on its own.
Unrequested AI output exists only ahead of the caret, as continuation in FR-5, over text that does not exist yet.

## The invitation rule

Chiri never proposes a change to text the user has already written unless the user selected that text first.

This is the product's central constraint, not a preference.
Forward, into text not yet written, the AI may anticipate freely, because a suggestion the user types past costs nothing.
Backward, over text the user has already committed, the AI is strictly invited, because unrequested rewrites of finished work are how an assistant takes authorship away from the person it is meant to be helping.

There is no idle trigger, no timer, no section-completion trigger, and no background scan of the document looking for weak paragraphs.
A user who never selects anything sees the document change only from their own typing and from continuations they accepted.

## User Stories

As a writer rereading a paragraph I know is weak, I want to select it and ask for a fix, so that I get help at the moment I decide I want it.

As a writer with a specific request, I want to select a passage and say what I want in my own words, so that I am not limited to whatever the AI thought to offer.

As a writer reviewing a result, I want to see exactly what would change, in place, so that I can judge it without rereading the paragraph from scratch.

As a writer who is deep in a draft, I want the AI to stay completely silent about what I already wrote until I ask, so that finished text stays finished.

## Behavior

### The selection action bar

When the user makes a non-empty text selection in the document, a small floating action bar appears anchored near that selection.
It is the only entry point to this requirement.

The bar offers a primary "Ask AI" affordance, a short set of one-tap actions, and a free-text field for an instruction in the user's own words.
The one-tap actions cover the common revisions so that the frequent case costs one click and no typing: improve the writing, make it shorter, change the tone, and fix grammar and spelling.
The free-text field covers everything else.

The bar appears on selection and disappears when the selection is cleared, without the user dismissing it.
It never obscures the selected text itself.
It is reachable and operable by keyboard alone, including raising it on a keyboard-made selection, per NFR-6.
It is not modal: the user can ignore it entirely and keep typing, and it goes away.

The bar's placement, dimensions, motion, and the exact wording of its actions are owned by the future design document.
The behavior above is product, not styling.

### What a revision is

A revision is a replacement of the selected span with proposed text, plus a short reason.
The reason exists because a diff without a rationale is a demand, and the user needs to know what problem the AI thinks it is solving before deciding.

The span of a revision is exactly the user's selection, clamped to the scoping rules below.
The AI never widens the span beyond what the user selected, and never returns changes to text outside it.
Whole-document rewrites are impossible by construction, because the user would have to select the whole document to ask for one.

A selection spanning more than three paragraphs is refused with a visible message rather than silently clamped, because silently acting on less than what the user selected is worse than declining.

At most one revision is pending at a time, because the user can only be asking about one selection at a time.
Requesting a revision while one is pending replaces the pending one only after the user resolves it; until then the new request is not issued and the user is told why.

### Revision lifecycle

| State | Entered when | Exits to |
|---|---|---|
| Idle | No revision requested or pending | Requested |
| Requested | The user submits an action or instruction from the action bar | Pending, or Failed |
| Pending | The result is rendered inline as a diff over the selection | Accepted, Rejected, Refining, or Invalidated |
| Refining | The user submits a refinement instruction per FR-7 | Pending, with revised proposed text |
| Accepted | The user accepts | Terminal, document changed |
| Rejected | The user rejects | Terminal, document unchanged |
| Invalidated | The user edits text inside the pending span, or the span is removed | Terminal, document unchanged, revision removed silently |
| Failed | The request errored | Terminal, visible message with retry, per AC-12.2 |

Accepting commits exactly the proposed text over exactly the selected span, as a single undoable unit.
Rejecting removes the revision and leaves the document untouched.
Because every revision was explicitly asked for, a failed request is always surfaced to the user, never silent.

### Review surface

A pending revision is shown inline at its span as a tracked change: the existing text and the proposed text are both visible, with removals and additions distinguishable without relying on color alone, per NFR-6.
The revision presents its reason and offers accept, reject, and refine, all reachable by keyboard.
The user can accept or reject the whole revision.
Partial acceptance within a revision is not supported in v1; the user refines instead.

The user continues writing anywhere in the document while a revision is pending, and a pending revision never blocks input, per NFR-2.

### Relationship to continuation

Continuation prediction in FR-5 is suppressed while a selection is active, per AC-5.8, and while a revision is pending over the span containing the caret, per AC-5.11.
The user is never asked to judge two AI outputs at once.

### Conflicts and invalidation

If the user edits text inside a pending revision's span, that revision is invalidated and removed without a message, because the user has answered it by rewriting.
If the user edits outside the span, the revision remains valid and its span position follows the edit.
If the selection is cleared while a request is in flight, the request is cancelled and nothing is shown.

### Persistence

Pending revisions are session state, not document state.
They are not persisted, not exported, and not restored on reload, per AC-4.3 and AC-9.5.

## Acceptance Criteria

AC-6.1 Given a document with written paragraphs, when the user writes, pauses, idles, or completes a section without selecting anything, then no revision to existing text is ever proposed, at any point in the session.
AC-6.2 Given the user makes a non-empty text selection, when the selection settles, then the action bar appears anchored near the selection, offering an "Ask AI" affordance, one-tap actions, and a free-text instruction field.
AC-6.3 Given the action bar is visible, when the user clears the selection, then the bar disappears and no request is issued.
AC-6.4 Given a selection, when the user chooses a one-tap action, then a revision for exactly that span appears inline within the latency bar in NFR-1, showing existing text, proposed text, and a reason, or a failure is surfaced per AC-12.2.
AC-6.5 Given a selection, when the user submits a free-text instruction, then the revision reflects that instruction over exactly that span.
AC-6.6 Given a pending revision, when the user accepts it, then the document contains exactly the proposed text over exactly that span and nothing else in the document changed.
AC-6.7 Given a pending revision, when the user rejects it, then the revision is removed and the document is byte-identical to its pre-request state.
AC-6.8 Given an accepted revision, when the user invokes undo once, then the entire change is reverted as a single unit.
AC-6.9 Given a model response containing changes to text outside the selected span, when it would be shown, then it is not shown and nothing is rendered.
AC-6.10 Given a selection spanning more than three paragraphs, when the user requests a revision, then a visible message declines the request and no revision is shown.
AC-6.11 Given a pending revision, when the user edits text inside its span, then the revision is removed with no message and the user's edit is applied normally.
AC-6.12 Given a pending revision, when the user edits text elsewhere in the document, then the revision remains pending and still targets the same text.
AC-6.13 Given a revision is pending, when the user selects other text and requests another, then the second request is not issued and the user is told the pending revision must be resolved first.
AC-6.14 Given a request is in flight, when the user clears the selection, then the request is cancelled and nothing is rendered.
AC-6.15 Given a selection made with the keyboard alone, when the user operates the editor without a pointer, then they can raise the action bar, choose an action, enter an instruction, read the reason, and accept, reject, or refine, all by keyboard, per NFR-6.
AC-6.16 Given a pending revision, when the user reloads the page, then no revision is present and the document is unchanged.
AC-6.17 Given a pending revision, when the user continues typing elsewhere, then keystroke latency stays within NFR-2.

## Edge Cases and Error States

| Condition | Expected behavior | Criterion |
|---|---|---|
| Selection is whitespace only or collapses to zero width | No action bar, no request | AC-6.2 |
| Selection spans more than three paragraphs | Visible refusal, nothing rendered | AC-6.10 |
| Selection crosses into a fenced code block | Revision permitted, span still exactly the selection | AC-6.5 |
| Result is identical to the selected text | Not shown, and the user is told nothing needed changing | AC-6.4 |
| Result changes text outside the selection | Discarded, nothing rendered | AC-6.9 |
| Target span no longer exists when the response arrives | Discarded, request treated as failed and surfaced | AC-6.11, AC-12.2 |
| User edits inside the span while a revision is pending | Revision invalidated silently | AC-6.11 |
| Selection cleared while the request is in flight | Cancelled, nothing rendered | AC-6.14 |
| A revision is already pending | Second request refused with a message | AC-6.13 |
| Request fails or the network is unavailable | Visible dismissible message with retry, always, since the user asked | AC-12.2 |
| Malformed model output | Treated as a failed request, visible message, nothing rendered | AC-12.6 |

## Open Questions

Q6-a Is the reason drawn from a fixed set of categories, such as clarity, concision, tone, or structure, or is it free text from the model.
A fixed set is predictable and easy to judge; free text is more informative.

Q6-b When the user picks "change the tone", does the bar ask which tone, or does the AI infer one from the document.
This is the only one-tap action that is under-specified without a second input.

Q6-c Does partial acceptance within a revision return in a later version, or is refinement the permanent answer.

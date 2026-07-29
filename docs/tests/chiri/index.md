# Chiri - Functional Test Plans

Natural-language test scenarios, one file per functional requirement.
These describe what to verify, not how to code it: they are written before the implementation exists, and are the contract the real tests get written against.

| Field | Value |
|---|---|
| PRD | [Chiri PRD](../../prd/chiri/index.md) |
| Technical blueprint | [Chiri Technical Blueprint](../../tech/chiri/index.md) |
| Requirements covered | 12 |
| Scenarios total | 200 |
| Last updated | 2026-07-28 |

## Plans

| Requirement | Title | Priority | Scenarios | P0 | Plan |
|---|---|---|---|---|---|
| FR-1 | API key gate | P0 | 22 | 12 | [fr-1.md](./fr-1.md) |
| FR-2 | Launch identity | P2 | 12 | 7 | [fr-2.md](./fr-2.md) |
| FR-3 | Single Markdown document surface | P0 | 13 | 7 | [fr-3.md](./fr-3.md) |
| FR-4 | Local persistence of the document | P0 | 13 | 5 | [fr-4.md](./fr-4.md) |
| FR-5 | Inline continuation prediction | P0 | 30 | 16 | [fr-5.md](./fr-5.md) |
| FR-6 | Selection-triggered AI revisions | P0 | 24 | 16 | [fr-6.md](./fr-6.md) |
| FR-7 | Refine a revision in place | P0 | 14 | 7 | [fr-7.md](./fr-7.md) |
| FR-8 | Model selector | P1 | 12 | 5 | [fr-8.md](./fr-8.md) |
| FR-9 | Export the document | P1 | 17 | 7 | [fr-9.md](./fr-9.md) |
| FR-10 | Prediction request discipline | P0 | 14 | 8 | [fr-10.md](./fr-10.md) |
| FR-11 | Empty-document onboarding cue | P1 | 10 | 6 | [fr-11.md](./fr-11.md) |
| FR-12 | AI failure and offline behavior | P0 | 18 | 11 | [fr-12.md](./fr-12.md) |

## Open questions across all plans

Every open question the plan writers recorded, grouped by requirement.
These are the ambiguities that would otherwise be resolved silently by whoever writes the code first, so they are the most useful thing on this page.

| Requirement | Question | Default assumed |
|---|---|---|
| FR-1 | Whether local storage being unavailable should let the app run in-memory with a warning (PRD Q1-b) or refuse to start | In-memory with a warning, per T-FR-1-17 |
| FR-1 | Whether AC-1.3's 10-second bound is measured from submission to unblock (round trip) or only from receipt of a successful response | Round-trip reading |
| FR-1 | Whether the app enforces its own client-side timeout on a validation request that never resolves | No client-enforced timeout exists, per T-FR-1-22 |
| FR-2 | The exact minimum dwell value D is not stated in the PRD | Deferred to the future design document; boundary scenarios written symbolically against D |
| FR-2 | Whether the launch dwell timer's clock is injectable | Assumed fakeable, per T-FR-2-2 |
| FR-2 | Whether AC-2.3's "app is ready" includes the FR-1 key-validity check resolving | Stricter reading: key-gate-vs-editor decision already known and correct at transition time, per T-FR-2-5 and T-FR-2-6 |
| FR-3 | Whether pasting external Markdown or plain text is parsed identically to typed input | Paste treated as Markdown source the same as typing |
| FR-3 | Whether malformed/incomplete Markdown syntax is auto-corrected | Retained as typed, never auto-corrected |
| FR-3 | Whether AC-3.2's "structurally identical" tolerates whitespace/line-ending differences from paste | Structural/rendered comparison, not byte comparison |
| FR-3 | Whether AI-origin undo steps from different source requirements behave identically as single undo units | All AI-accepted content is one undo step regardless of source |
| FR-4 | No stated contract for concurrent editing across two tabs on the same profile | T-FR-4-12 only asserts no corruption, not a specific resolution rule |
| FR-4 | No stated behavior for storage being entirely unavailable at boot | No scenario asserts a specific outcome; mirrors the blueprint's own unresolved open question 2 |
| FR-4 | Whether caret restoration must tolerate the document having changed shape between save and load | T-FR-4-7 assumes same-character-offset restoration |
| FR-5 | Q5-a: which keystrokes accept the full continuation vs the next word only | Scenarios written against role names "accept key" and "accept-word key" pending the answer |
| FR-5 | Q5-b: whether the two-sentence continuation ceiling applies inside list items | Same two-sentence rule as prose, per the blueprint's stated default |
| FR-5 | Whether AC-5.5's "moving the caret" covers programmatic caret movement (e.g. mid-session restore) | Only the two PRD-named cases are tested (arrow key, click) |
| FR-6 | Q6-a: whether the revision reason is a fixed taxonomy or free model text | Treated as an opaque non-empty string |
| FR-6 | Q6-b: whether "change the tone" prompts for a target tone or the AI infers one | No second input step assumed |
| FR-6 | Q6-c: whether partial acceptance returns in a later version | Deferred scope, not tested |
| FR-6 | Exact visible message text for refusal/pending/nothing-needed-changing cases is unspecified | Scenarios assert meaning rather than literal wording |
| FR-7 | Whether a second refinement submitted while the first is in flight is blocked-until-resolved or superseded-and-cancelled | T-FR-7-9 observes rather than asserts a specific outcome |
| FR-7 | Whether the one-tap actions are also offered during refinement, or refinement is free-text only | Free-text only |
| FR-7 | Whether there is a maximum number of refinement turns | None assumed; three turns tested as representative, per T-FR-7-11 |
| FR-7 | Whether the model receives the full refinement instruction history each turn or only the latest instruction | Defaults to the PRD's literal wording (full history), against the blueprint's ambiguous singular phrasing |
| FR-8 | Whether FR-8 ships as one selector governing both continuation and revision requests, or two independent selectors | Single-selector reading, per T-FR-8-3/T-FR-8-4/T-FR-8-9 |
| FR-8 | The curated model list's exact membership is undecided | Test data model names beyond the default are placeholders |
| FR-8 | Whether a persisted selection that has fallen out of the curated list falls back to default or shows as stale/disabled | T-FR-8-11 written to accept either outcome pending product decision |
| FR-9 | Exact filename derivation/slugification algorithm is unspecified | Scenarios assert observable derivation, not an exact string |
| FR-9 | The literal value of the fixed default filename is unspecified | Scenarios assert constancy and successful download, not literal text |
| FR-9 | AC-9.3's "whose first line is a heading" read literally | A heading elsewhere in the document does not count, per T-FR-9-13 |
| FR-9 | Whether repeated exports of an unchanged document must be byte-for-byte deterministic | Assumed yes, per T-FR-9-14 |
| FR-10 | Exact settle-threshold duration and exact concurrent/per-minute ceiling values are deferred to the future architecture document | Blueprint's stated starting values used illustratively (600ms, 1 concurrent, 20/minute), per T-FR-10-6 and T-FR-10-9 |
| FR-10 | Whether per-minute/concurrency ceilings apply to revision and refinement traffic at all | Full exemption assumed, per T-FR-10-10 |
| FR-10 | Whether a caret that leaves and returns to the same position before a response arrives counts as "moved away" | Any move invalidates the request, per T-FR-10-4 |
| FR-11 | Whether whitespace-only content counts as "empty" for the cue's show/hide logic | Any character, including whitespace, dismisses the cue |
| FR-11 | Whether the cue's visibility is a pure function of current document emptiness or a one-time-only onboarding flag | Pure function, per AC-11.4's wording |
| FR-12 | Whether insufficient credit on a continuation request is silent or always visible | Silent, per T-FR-12-9 |
| FR-12 | Whether a key rejection received while a revision failure message is on screen replaces it immediately or waits for dismissal | Immediate replacement, per T-FR-12-17 |
| FR-12 | Whether retrying a failed revision re-sends the exact same request or requires reselection | Re-send without reselection, per T-FR-12-12 |

## Requirements with no plan

None - every requirement has a plan.

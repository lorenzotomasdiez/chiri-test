# FR-3: Single Markdown document surface - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-3](../../prd/chiri/index.md#fr-3-single-markdown-document-surface) |
| Priority | P0 |
| Scenarios | 13 |
| Automated | 11 - T-FR-3-1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13 |
| Manual by design | 2 - T-FR-3-4 (round trip is identity by construction), T-FR-3-12 (latency at the 20,000-character ceiling) |
| Last updated | 2026-07-28 |

## What this requirement promises
Chiri shows exactly one Markdown document filling the whole application surface, with no file tree, document list, tabs, or sidebar competing for space.
Standard Markdown constructs are typed directly with no toolbar, and the document renders as structured text as the user types rather than as raw source.
Markdown text is the canonical form of the document, so what leaves through export and comes back through paste is the same document, and every edit, whether typed by the human or accepted from the AI, lives in one ordered undo and redo history.

## Preconditions
A valid OpenRouter key has already been accepted, per FR-1, so the editor surface is reachable.
The user is on one of the four supported desktop browsers: current Chrome, Safari, Firefox, or Edge.
Where a scenario needs an accepted AI revision or a rendered continuation, the mechanics that produce it are assumed to work as their own requirements (FR-5, FR-6) describe, and are not re-verified here; only what those accepted changes do to the single document and its undo history is in scope.
Where a scenario needs export or paste, the byte-level correctness of copy and download themselves is FR-9's concern; this plan only checks what a round trip does to document structure.

## Scenarios

### T-FR-3-1: Every supported Markdown construct renders as structured text as it is typed
**Priority:** P0
**Covers:** AC-3.1

**Given** an empty document
**When** the user types the Markdown syntax shown, character by character, with no toolbar or menu used
**Then** the construct renders as shown, in place, without the user pressing a separate "render" action

| Case | Markdown typed | Observable render result |
|---|---|---|
| Heading | `# Title` | A heading-styled line reading "Title"; the `#` marker is hidden while the caret is elsewhere on the line |
| Paragraph | `Just a sentence.` | Plain body text, no marker artifacts |
| Bold | `**strong**` | The word "strong" rendered in bold weight; the `**` markers are hidden while the caret is elsewhere on the line |
| Italic | `*emphasis*` | The word "emphasis" rendered in italic style; the `*` markers are hidden while the caret is elsewhere on the line |
| Unordered list | `- one` then Enter, `- two` | Two bulleted lines |
| Ordered list | `1. one` then Enter, `2. two` | Two numbered lines |
| Link | `[Chiri](https://example.com)` | The text "Chiri" rendered as a link; the bracket and URL syntax is hidden while the caret is elsewhere on the line |
| Inline code | `` `code` `` | The word "code" rendered in a monospace, code-styled span |
| Fenced code block | ```` ```\ncode line\n``` ```` | A distinct code block region containing "code line"; the fence markers remain visible per the live-preview scope |
| Blockquote | `> quoted text` | An indented, quote-styled line; the `>` marker remains visible per the live-preview scope |
| Horizontal rule | `---` on its own line | A visible horizontal rule; the `---` syntax remains visible per the live-preview scope |

**How you would run this:** Needs a real browser under Playwright, not a fake DOM; CodeMirror's decorations, marker hiding, and caret behavior only exist with real layout, per the blueprint's testing seams.
This is the "every-construct render" spec the blueprint names directly.

---

### T-FR-3-2: Nested constructs render together without corrupting each other
**Priority:** P0
**Covers:** AC-3.1, `Beyond the stated criteria`

**Given** an empty document
**When** the user types a blockquote containing a list item containing bold and italic text, for example `> - **bold** and *italic* inside a list inside a quote`
**Then** all four constructs render simultaneously and each retains its own styling
**And** no character adjacent to a hidden marker is missing or duplicated
**And** the caret can be placed on and moved through every part of the line without landing inside a hidden marker

**How you would run this:** Needs a real browser under Playwright; this is the specific case the blueprint's marker-hiding risk calls out because emphasis and list-mark hide ranges were never probed the way heading ranges were.

---

### T-FR-3-3: Malformed or incomplete Markdown syntax is retained as typed, not rejected or silently corrected
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** an empty document

| Case | Markdown typed | Observable result |
|---|---|---|
| Unmatched fence | ```` ```\ncode with no closing fence ```` | The typed characters remain in the document exactly as typed; the document is not truncated and no error is shown |
| Incomplete link | `[caption](` | The typed characters remain in the document exactly as typed, rendered as plain text rather than a link |
| Stray emphasis marker | `word *alone` | The typed characters remain in the document exactly as typed, rendered as plain text rather than italic |

**Then** in every case above, the user can keep typing and later close or correct the construct, at which point it renders normally

**How you would run this:** Needs a real browser under Playwright, since it depends on the live-preview decoration plugin's handling of an incomplete Lezer parse.

---

### T-FR-3-4: Exported Markdown pasted into a new document reproduces the original structurally
**Priority:** P0
**Covers:** AC-3.2

**Given** a document containing one instance of every construct from T-FR-3-1
**When** the user exports it per FR-9 and pastes the resulting text into a new, empty Chiri document
**Then** the pasted document renders every construct the same way the original did
**And** the constructs appear in the same order and nesting as the original

**How you would run this:** The blueprint treats this as not worth an automated assertion, because the document's in-memory form is the Markdown string itself, so round-trip is identity by construction rather than a serializer that could drift; one manual paste-back check during the first slice covers it, and the export mechanism itself is FR-9's test surface.

---

### T-FR-3-5: Undoing an accepted AI change reverts it as a single unit
**Priority:** P0
**Covers:** AC-3.3

**Given** a document containing the paragraph "The quick fox jumps." where an AI revision replacing it with "The quick brown fox leaps swiftly." has already been accepted, per FR-6
**When** the user invokes undo once
**Then** the document reads "The quick fox jumps." exactly as it did before the revision was accepted
**And** the reversion happens in one undo step, not one step per word or per character changed

**How you would run this:** Fully automatable in a real browser under Playwright; CodeMirror commits an accept as a single transaction, so this is a document-state assertion after one undo command.

---

### T-FR-3-6: Redoing a reverted accepted AI change reapplies it
**Priority:** P0
**Covers:** AC-3.4

**Given** the state at the end of T-FR-3-5, where the accepted revision has just been undone
**When** the user invokes redo once
**Then** the document reads "The quick brown fox leaps swiftly." again
**And** the reapplication happens in one redo step

**How you would run this:** Fully automatable in a real browser under Playwright, chained directly after T-FR-3-5's setup.

---

### T-FR-3-7: No navigation chrome is present anywhere in the application after the key gate
**Priority:** P0
**Covers:** AC-3.5

**Given** the key gate has been passed

| Case | Application state inspected | Expected result |
|---|---|---|
| Fresh editor | Immediately after landing in the editor | No file tree, document list, document switcher, tabs, or chat panel is present |
| Mid-typing | While the user is typing a paragraph | No file tree, document list, document switcher, tabs, or chat panel appears |
| Ghost text visible | While a continuation is shown in grey, per FR-5 | No file tree, document list, document switcher, tabs, or chat panel appears |
| Revision pending | While a tracked-change diff is shown, per FR-6 | No file tree, document list, document switcher, tabs, or chat panel appears |
| Model selector open | With the FR-8 selector open | No file tree, document list, document switcher, tabs, or chat panel appears alongside it |

**How you would run this:** Fully automatable, checking the absence of specific DOM regions or roles across each state; states beyond "fresh editor" reuse fixtures from FR-5's and FR-6's own suites rather than re-deriving them here.

---

### T-FR-3-8: Typing is never blocked or delayed while an AI request is in flight
**Priority:** P0
**Covers:** AC-3.6

**Given** the user begins typing continuously into the document and a continuation request, per FR-5, is dispatched and in flight partway through
**When** the user types for 60 consecutive seconds without stopping
**Then** every keystroke appears in the document with no observable delay attributable to the in-flight request
**And** no keystroke is dropped, reordered, or duplicated

**How you would run this:** The blueprint checks the underlying 50ms p95 keystroke-to-render bar (NFR-2) by hand with the browser performance panel rather than as an automated assertion, calling a latency assertion in a headless browser "flaky theater"; this scenario's functional half (nothing dropped or blocked) is automatable in Playwright, but the timing half is a manual pass.

---

### T-FR-3-9: Undo and redo form one ordered history across human and AI-origin edits
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** an empty document
**When** the user types "First line.", then accepts an AI continuation appending " Second part.", then types " Third line." by hand
**Then** three consecutive undo invocations remove, in order, the third typed text, then the accepted continuation, then the first typed text, regardless of which step was human-typed and which was AI-accepted
**And** the document is empty after the third undo

**How you would run this:** Fully automatable in a real browser under Playwright; this is a direct check of the "single ordered history" claim in the requirement's prose, not just of AC-3.3 and AC-3.4 in isolation.

---

### T-FR-3-10: Undo at the start of the document's history has no effect
**Priority:** P2
**Covers:** `Beyond the stated criteria`

**Given** a freshly opened document with no edits made yet in the current session
**When** the user invokes undo
**Then** the document is unchanged
**And** no error or visible feedback appears

**How you would run this:** Fully automatable in a real browser under Playwright.

---

### T-FR-3-11: A new edit after an undo clears the redo stack
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** the user typed "Draft one." then undid it, leaving the document empty with a pending redo available
**When** the user types "Draft two." instead of invoking redo
**Then** the document reads "Draft two."
**And** invoking redo afterward has no effect and does not resurrect "Draft one."

**How you would run this:** Fully automatable in a real browser under Playwright; this is standard editor history behavior implied by "a single ordered history" but not spelled out by any single AC, so it is worth pinning down explicitly.

---

### T-FR-3-12: Typing responsiveness holds as the document approaches the practical size ceiling
**Priority:** P1
**Covers:** `Beyond the stated criteria`

**Given** a document at each length in the table below, with the live-preview plugin, a visible ghost widget, and an active revision diff all present at once
**When** the user types one additional character
**Then** the character appears without a perceptible stall

| Case | Document length | Expected result |
|---|---|---|
| Just below the ceiling | 19,999 characters | No perceptible input stall |
| At the ceiling | 20,000 characters | No perceptible input stall |
| Just above the ceiling | 20,001 characters | Behavior is not specified by the requirement; observed only, not held to a bar |

**How you would run this:** Manual only, with the browser performance panel; per the technical blueprint, whether CM6 with the live-preview plugin plus an active ghost widget plus an active diff set keeps per-keystroke latency under the NFR-2 bar at 20,000 characters is an open, unprobed question, and the blueprint treats an automated p95 assertion in a headless browser as unreliable.

---

### T-FR-3-13: The empty document accepts the first keystroke immediately, with nothing pre-rendered
**Priority:** P1
**Covers:** AC-3.1, `Beyond the stated criteria`

**Given** a document that has never had content typed into it in this browser profile
**When** the user inspects the editor before typing anything
**Then** no construct, marker, or sample content is rendered
**And** the first character typed appears immediately, at the document's start position

**How you would run this:** Fully automatable in a real browser under Playwright; this is the zero-content boundary of AC-3.1's "as the user types" claim, distinct from FR-11's onboarding cue, which is a separate, non-document overlay.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Continuous typing duration for AC-3.6 | 59 seconds of continuous typing | 60 seconds of continuous typing | 61+ seconds of continuous typing | T-FR-3-8 |
| Document length ceiling tied to NFR-2 | 19,999 characters | 20,000 characters | 20,001 characters | T-FR-3-12 |
| Undo steps available in history | 0 steps (nothing has been edited) | 1 step (one accepted or typed change) | 2+ steps mixing human and AI origin | T-FR-3-10, T-FR-3-5, T-FR-3-9 |

## What will probably break
Live-preview marker hiding was only walked for heading tokens by the one probe that exists; emphasis and list-mark hide ranges are unverified and, per the blueprint, "almost certainly" need a different rule than headings, which is exactly what T-FR-3-1 and T-FR-3-2 are positioned to catch as either a dead-stopped caret or an eaten character.
The `EditorView.atomicRanges` facet is described as easy to omit and invisible on casual inspection, only surfacing as a caret that appears not to move on ArrowRight through a heading; T-FR-3-1's heading case and T-FR-3-13's fresh-caret case are the first places that would show it.
Undo and redo interacting with the AI overlay layer is a plausible seam even though the blueprint treats "accept commits as one transaction" as structural: T-FR-3-9's mixed-origin sequence is the scenario most likely to expose an off-by-one in history ordering if a continuation's ghost-text transaction is ever accidentally left in the undo stack instead of the pending-decoration layer.
NFR-2 at the 20,000-character ceiling with all three decoration layers active simultaneously is explicitly unprobed per the blueprint's open questions, so T-FR-3-12 is the scenario most likely to fail first, or to be quietly skipped, once a real 20k-character fixture exists.

## Not covered here
The mechanics of how a continuation is generated, triggered, or dismissed belong to FR-5's plan; this plan only uses an already-produced continuation as a precondition.
The mechanics of how a selection raises the action bar and produces a revision belong to FR-6's plan; this plan only uses an already-accepted revision as a precondition.
The write scheduling, debounce timing, and storage quota behavior behind local persistence belong to FR-4's plan; this plan assumes content typed is eventually saved and does not re-test the save path.
The correctness of the clipboard-copy and file-download mechanisms themselves belongs to FR-9's plan; T-FR-3-4 uses export only as a means to test document round-trip structure, not export's own acceptance criteria.
Full accessibility automation (screen-reader announcements, focus order through the selection bar and diff controls) belongs to FR-6's and FR-5's plans, where those controls exist; plain typed-Markdown entry has no bespoke keyboard interaction beyond standard text editing, so no separate accessibility scenario is written for it here.
Visual regression, typography, and spacing are explicitly deferred to the future design document and are not tested anywhere in this plan.

## Open questions
Whether pasting external, non-Chiri-authored Markdown or plain text into the document is supported, and if so whether it is parsed identically to typed input, is not addressed by FR-3's text; the default assumption used throughout this plan is that any text entering the document, however it arrives, is treated as Markdown source the same way typed characters are, and T-FR-3-4's paste-back scenario would need to change if pasted content is instead sanitized, escaped, or rejected.
Whether malformed or incomplete Markdown syntax is retained as literal text indefinitely, or is silently auto-closed or corrected at some point, is not stated; T-FR-3-3 defaults to "retained as typed, never auto-corrected," and would need rewriting if the intended behavior is to repair the syntax once it becomes unambiguous.
Whether AC-3.2's "structurally identical" tolerates whitespace or line-ending differences introduced by the paste operation itself, as opposed to requiring the same byte-for-byte string that FR-9's export produces, is not stated; T-FR-3-4 defaults to checking rendered structure and order rather than a byte comparison, and would tighten to a byte-identical check if that stricter reading is confirmed.
Whether the two-sentence continuation ceiling and other FR-5-owned behaviors that touch document content are expected to interact with undo granularity differently from a revision accept is not addressed here, since that boundary is FR-5's to define; T-FR-3-9 treats any accepted AI-origin text as one undo step regardless of its source requirement, and would need a second scenario per source if that turns out to differ.

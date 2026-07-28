# FR-9: Export the document - Test Plan

| Field | Value |
|---|---|
| Requirement | [FR-9](../../prd/chiri/index.md#fr-9-export-the-document) |
| Priority | P1 |
| Scenarios | 17 |
| Last updated | 2026-07-28 |

## What this requirement promises
Chiri lets the user get the current document out of the browser two ways, copy to clipboard and download as a `.md` file, and both must produce the same canonical Markdown for the same document state.
Nothing the AI has proposed but the user has not accepted is ever part of that output, and the downloaded file is named after the document's first heading, or a fixed default when there is none.
Export must keep working at any point after the key gate, including on an empty document, because with no account and no server copy it is the user's only way to keep their work.

## Preconditions
The user has passed the key gate (FR-1) and is on the single document surface (FR-3).
Local persistence (FR-4) is running normally unless a scenario says otherwise.
Unless a scenario states a specific document state, the document may be empty or hold arbitrary committed text; each scenario below states the state it needs.

## Scenarios

### T-FR-9-1: Copy to clipboard places the document's Markdown on the clipboard and confirms it
**Priority:** P0
**Covers:** AC-9.1

**Given** a document containing a heading, two paragraphs, and a bullet list, all committed (no pending AI output)
**When** the user triggers copy to clipboard
**Then** the system clipboard contains exactly the document's Markdown source
**And** a confirmation is shown to the user

**How you would run this:** Needs real infrastructure. Requires a real browser with clipboard permissions granted (Playwright can grant `clipboard-write`/`clipboard-read` and read `navigator.clipboard` via `page.evaluate`), since the pure core has no clipboard seam per the blueprint's testing seams.

### T-FR-9-2: Download and clipboard produce byte-identical Markdown for the same document state
**Priority:** P0
**Covers:** AC-9.2

**Given** a document containing a heading, mixed formatting (bold, italic, inline code), an ordered list, a fenced code block, and a blockquote
**When** the user copies to clipboard and then, without changing the document, downloads it
**Then** the downloaded file's contents are byte-for-byte identical to what was placed on the clipboard, including line endings and the presence or absence of a trailing newline

**How you would run this:** Needs real infrastructure. Requires a real browser to trigger and intercept a download alongside a clipboard read, since the two code paths (Clipboard API string, Blob-to-file download) are separate and this scenario exists specifically to catch them diverging.

### T-FR-9-3: The downloaded filename is derived from the document's first-line heading
**Priority:** P0
**Covers:** AC-9.3

**Given** a document whose first line is the stated heading
**When** the user downloads
**Then** the saved file has a `.md` extension and a filename that recognizably reflects the heading text below

| Case | First line | Expected filename property |
|---|---|---|
| Simple heading | `# Getting Started` | Recognizably derived from "Getting Started", ends in `.md` |
| Heading with a level 2 marker | `## Release Notes` | Recognizably derived from "Release Notes", ends in `.md` |
| Heading with trailing punctuation | `# What's New?` | Recognizably derived from "What's New?", ends in `.md`, still a valid filename on the host OS |
| Heading with extra internal spaces | `#   Draft   Plan` | Recognizably derived from "Draft Plan", ends in `.md` |

**How you would run this:** Needs real infrastructure. The download filename can only be observed from a real browser download event (Playwright's `download.suggestedFilename()`); the exact slugification rule is unspecified by the PRD, so this scenario asserts the derivation happened, not an exact string (see Open Questions).

### T-FR-9-4: The downloaded filename falls back to a fixed default when there is no heading
**Priority:** P1
**Covers:** AC-9.4

**Given** a document with no heading, as described below
**When** the user downloads
**Then** the download succeeds and the filename is the same fixed default in every case

| Case | Document content |
|---|---|
| Empty document | No text at all |
| Plain prose only | `"Just a paragraph, no heading."` |
| Heading marker with no text | `"# "` (hash, space, nothing else) |

**How you would run this:** Needs real infrastructure, same as T-FR-9-3.

### T-FR-9-5: A pending continuation is excluded from both export paths
**Priority:** P0
**Covers:** AC-9.5

**Given** a document with the committed text `"The weather today is"` and an unaccepted grey continuation suggestion currently displayed after it
**When** the user exports by copy and separately by download, without accepting or dismissing the suggestion
**Then** both outputs contain exactly `"The weather today is"` and none of the suggested continuation text

**How you would run this:** Needs real infrastructure. Requires a real `EditorView` to render ghost text and a real clipboard/download read, per the blueprint's note that CodeMirror is never faked; the exclusion is expected to hold by construction since ghost text lives only as a decoration, never as document text.

### T-FR-9-6: A pending revision, in either state, is excluded from both export paths
**Priority:** P0
**Covers:** AC-9.5

**Given** a paragraph is selected and a revision is pending over it, shown as a tracked-change diff with the original struck through and a proposed replacement shown
**When** the user exports by copy and separately by download while the revision is still pending, and again after submitting a refinement instruction so a second proposed version is showing
**Then** every export in both states contains only the original, pre-revision paragraph text
**And** none of the proposed replacement text, from either the first or the refined proposal, appears in any export

**How you would run this:** Needs real infrastructure, same as T-FR-9-5. This is the case most likely to catch a bug the ghost-text case would not, since a revision has two candidate texts (original and proposed) live at once rather than one.

### T-FR-9-7: Clipboard failure is surfaced with a retry, and download still works
**Priority:** P0
**Covers:** AC-9.6

**Given** the browser denies or lacks clipboard access
**When** the user attempts to copy to clipboard
**Then** a dismissible failure message appears, offering a retry, per FR-12's revision-failure treatment
**And** the document is unchanged
**And** the user can still successfully download the same document as a `.md` file

**How you would run this:** Needs real infrastructure. Requires a real browser with clipboard permission denied (Playwright can revoke `clipboard-write`) or a route that makes `navigator.clipboard.writeText` reject, to observe the failure path honestly.

### T-FR-9-8: Export is available on a completely empty document
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a first-ever session with no content typed yet
**When** the user copies to clipboard and separately downloads
**Then** copy places an empty string on the clipboard with a confirmation still shown
**And** download still succeeds, producing a file with the fixed default filename and empty (or newline-only) content

**How you would run this:** Needs real infrastructure, same as T-FR-9-1/T-FR-9-4. This is called out explicitly in the requirement text ("Export is available at any time after the key gate, including when the document is empty"), so it earns its own scenario rather than being folded into the no-heading case.

### T-FR-9-9: A heading containing filesystem-illegal characters still yields a usable filename
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document whose first line is `# Q1/Q2 Report: "Final" <v2>`
**When** the user downloads
**Then** the download succeeds with a `.md` file whose name contains no character illegal on the host filesystem (no `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, or `|`)
**And** the filename is still recognizably derived from the heading's readable words

**How you would run this:** Needs real infrastructure, same as T-FR-9-3. Predicted to be under-specified; see What will probably break.

### T-FR-9-10: An unusually long heading still produces a downloadable filename
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** a document whose first line is a heading 300 characters long
**When** the user downloads
**Then** the download succeeds
**And** the resulting filename does not exceed the host filesystem's filename length limit

**How you would run this:** Needs real infrastructure, same as T-FR-9-3.

### T-FR-9-11: A heading marker with no following text is treated as no heading
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document whose first line is exactly `"#"` with nothing after it, and no other content
**When** the user downloads
**Then** the filename is the fixed default, not an empty or malformed name

**How you would run this:** Needs real infrastructure, same as T-FR-9-4. This is folded conceptually into T-FR-9-4's table candidate but kept separate here because the marker-with-trailing-space case and the marker-with-nothing-at-all case are different literal inputs worth distinguishing.

### T-FR-9-12: Only the first heading drives the filename when the document has several
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** a document beginning `# Draft Title` followed by a paragraph and then a second heading `## Section Two`
**When** the user downloads
**Then** the filename is derived from "Draft Title" only
**And** "Section Two" plays no part in the filename

**How you would run this:** Needs real infrastructure, same as T-FR-9-3.

### T-FR-9-13: A heading that is not the document's first line does not drive the filename
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document beginning with a plain paragraph, `"Some notes before the title."`, followed on the next line by `# Actual Title`
**When** the user downloads
**Then** the filename is the fixed default, since the first line is not itself a heading

**How you would run this:** Needs real infrastructure, same as T-FR-9-4. See Open Questions: this scenario encodes the literal reading of AC-9.3 ("whose first line is a heading"), which may not match intent.

### T-FR-9-14: Repeated export of an unchanged document is deterministic
**Priority:** P2
**Covers:** Beyond the stated criteria

**Given** a document with content that is not modified between actions
**When** the user copies to clipboard, then downloads, then copies to clipboard again
**Then** all three outputs are byte-for-byte identical to each other

**How you would run this:** Needs real infrastructure, same as T-FR-9-2.

### T-FR-9-15: Non-ASCII document content survives both export paths intact
**Priority:** P1
**Covers:** Beyond the stated criteria

**Given** a document containing accented characters, an emoji, and a right-to-left script fragment, for example `"# Café Résumé 🎉 مرحبا"`
**When** the user copies to clipboard and separately downloads
**Then** both outputs reproduce every character exactly, with no substitution, mangling, or replacement character

**How you would run this:** Needs real infrastructure, same as T-FR-9-2. Encoding mismatches between the two export code paths are a plausible source of a byte-identical failure that plain-ASCII fixtures would not reveal.

### T-FR-9-16: Export controls are reachable by keyboard and the copy confirmation is announced
**Priority:** P1
**Covers:** Beyond the stated criteria (NFR-6)

**Given** a user navigating with keyboard only, with a screen reader active
**When** they tab to the copy control and the download control and activate each with the keyboard
**Then** both actions fire without a pointer
**And** the copy confirmation is announced to assistive technology, not shown as a purely visual toast

**How you would run this:** Manual only. The blueprint's testing seams limit automated accessibility coverage to one axe pass on the two main screens and note screen-reader behavior stays a manual four-browser pass; this scenario is judged by hand against NFR-6, not asserted.

### T-FR-9-17: Exporting a document at the practical size ceiling does not freeze the editor
**Priority:** P2
**Covers:** Beyond the stated criteria (NFR-2 adjacent)

**Given** a document of 20,000 characters, the practical ceiling named by NFR-2
**When** the user copies to clipboard and separately downloads
**Then** both complete and the editor remains responsive to typing immediately afterward, with no visible freeze

**How you would run this:** Manual only, or a rough Playwright timing check at best. The blueprint states NFR-2's latency bar is checked by hand with a 20,000-character paste and the browser performance panel, not asserted as a flaky headless-browser latency test, and export plumbing was not separately probed.

## Boundaries checked

| Value or limit | Just below | At | Just above | Scenario |
|---|---|---|---|---|
| Document size against NFR-2's practical ceiling | Not separately tested for export; export has no size limit of its own | 20,000 characters | Not tested; FR-9 states no upper bound | T-FR-9-17 |
| Heading presence on line 1 | Line 1 is prose, heading appears later | Line 1 is exactly a heading | Line 1 is a heading with trailing content on the same logical line | T-FR-9-3, T-FR-9-11, T-FR-9-13 |

FR-9 itself names no numeric limit, no character count, no timeout, and no file size cap; the one size figure that touches this requirement is NFR-2's 20,000-character document ceiling, which is cross-cutting rather than FR-9-specific.

## What will probably break
The byte-identical guarantee between clipboard and download (AC-9.2) is the likeliest first failure, because the two paths are structurally different (a string write to the Clipboard API versus a Blob turned into a file), and it is easy for one path to pick up a trailing newline, a different line ending, or a BOM that the other does not; T-FR-9-2 and T-FR-9-15 are built to catch exactly this.
Filename derivation is unspecified below the level of "derived from the heading," so the first implementation is likely to choke on characters that are legal in Markdown headings but illegal in filenames, or on Windows-specific quirks like a trailing dot or space; T-FR-9-9 and T-FR-9-10 target this.
The pending-AI-layer exclusion (AC-9.5) is described in the blueprint as holding "by construction" because unaccepted output is never document text, which is reassuring for ghost text but the revision case has two live candidate texts (original and proposed) rather than one, and a bug that accidentally commits the proposed side under refinement is the more dangerous failure; T-FR-9-6 is written to specifically probe the refined-revision case rather than only the simpler continuation case.
Clipboard permission behavior differs across the four NFR-7 browsers (some prompt, some silently no-op without a user gesture, Safari has stricter transient-activation rules), so the failure path in AC-9.6 may fire correctly in one browser and silently do nothing in another; T-FR-9-1 and T-FR-9-7 both need to be run across the supported browser matrix, not just once, to catch this.

## Not covered here
Export round-trip fidelity back into the editor (AC-3.2, "pasted back into an empty Chiri document, structurally identical") belongs to FR-3's test plan, since it is a claim about the editor's parse path, not about export itself; the technical blueprint also states this gets no automated assertion, treating it as identity by construction because CodeMirror's document is the Markdown string, with one manual export check standing in for it.
The exact wording and visual treatment of the copy confirmation is owned by the future design document and is not pinned here beyond "a confirmation is shown."
The exact slugification algorithm for turning heading text into a filename, and the literal value of the fixed default filename, are owned by the future architecture document; scenarios here test the observable shape of the behavior, not a specific string.
Model, key gate, and revision-lifecycle behavior are FR-1, FR-6, and FR-7's own test plans; this file only touches them at the point where their pending output must not leak into an export.

## Open questions
The exact filename derivation rule (case folding, word separator, character stripping) is not specified by the PRD and is explicitly deferred to the future architecture document.
Default interpretation used here: scenarios assert that the filename is recognizably derived from the heading and is a valid, downloadable filename, without pinning an exact string.
If the real algorithm is decided, T-FR-9-3, T-FR-9-9, T-FR-9-10, and T-FR-9-12 should be tightened to assert the exact output.

The fixed default filename's literal value is not specified.
Default interpretation used here: scenarios assert the default is constant across repeated runs and that download still succeeds, without naming the literal string.
If a specific default value is decided, T-FR-9-4, T-FR-9-8, and T-FR-9-11 should be tightened to assert it exactly.

AC-9.3 says "a document whose first line is a heading," which this plan reads literally: a heading elsewhere in the document that is not on line 1 does not drive the filename.
Default interpretation used here: T-FR-9-13 expects the fallback default in that case.
If the intent was instead "the first heading anywhere in the document," T-FR-9-13's expected result would flip to using "Actual Title," and this should be confirmed against product intent before implementation.

Whether repeated exports of an unchanged document must be byte-for-byte deterministic is not stated explicitly, only implied by "canonical Markdown."
Default interpretation used here: T-FR-9-14 treats determinism as expected.
If some non-deterministic element (a timestamp in the confirmation, for instance) is later introduced into the exported content itself rather than only the UI, this scenario would need to change.

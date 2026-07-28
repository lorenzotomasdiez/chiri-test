# Chiri: functional requirement to design screen map

Maps every functional requirement in [the PRD](../../prd/chiri/index.md) to the design-preview screen that illustrates it.
Use this when referencing a requirement so you can point at a concrete visual example instead of describing it.

Each screenshot was rendered from the actual HTML at 1440x900 and is stored alongside it in `shots/`.
The screenshots are viewport captures, not full-page, so content below 900px is noted where it matters.

## How to read these screens

**These screens are inspirational, not specification.**
They are AI-generated explorations of a visual direction, and the PRD remains the only source of truth for behavior.

Read them for layout, typography, density, tone, and the shape of each interaction.
Do not read their copy, labels, or invented affordances as requirements.
Where a screen shows something the PRD does not call for, the screen is wrong and the PRD wins.
The clearest example is the "SAVED TO CLOUD" pill on the export screen, which describes a feature Chiri does not have and never will.

Those divergences are called out below so nobody mistakes filler for intent, not as a defect list to go fix.

## The map

| FR | Title | Priority | Screen | Screenshot |
|---|---|---|---|---|
| FR-1 | API key gate | P0 | [api-key-gate.html](./screens/api-key-gate.html) | [png](./shots/api-key-gate.png) |
| FR-2 | Launch identity | P2 | [launch-splash.html](./screens/launch-splash.html) | [png](./shots/launch-splash.png) |
| FR-3 | Single Markdown document surface | P0 | [editor-continuation.html](./screens/editor-continuation.html) | [png](./shots/editor-continuation.png) |
| FR-4 | Local persistence of the document | P0 | none by design | see note below |
| FR-5 | Inline continuation prediction | P0 | [editor-continuation.html](./screens/editor-continuation.html) | [png](./shots/editor-continuation.png) |
| FR-6 | Selection-triggered AI revisions | P0 | [editor-revision-diff.html](./screens/editor-revision-diff.html) | [png](./shots/editor-revision-diff.png) |
| FR-7 | Refine a revision in place | P0 | [editor-revision-diff.html](./screens/editor-revision-diff.html) | [png](./shots/editor-revision-diff.png) |
| FR-8 | Model selector | P1 | [model-selector-open.html](./screens/model-selector-open.html) | [png](./shots/model-selector-open.png) |
| FR-9 | Export the document | P1 | [export-menu.html](./screens/export-menu.html) | [png](./shots/export-menu.png) |
| FR-10 | Prediction request discipline | P0 | none by design | see note below |
| FR-11 | Empty-document onboarding cue | P1 | [onboarding-empty-document.html](./screens/onboarding-empty-document.html) | [png](./shots/onboarding-empty-document.png) |
| FR-12 | AI failure and offline behavior | P0 | [revision-failure-state.html](./screens/revision-failure-state.html) | [png](./shots/revision-failure-state.png) |

## What each screen actually shows

### FR-1: API key gate

[api-key-gate.html](./screens/api-key-gate.html) | [screenshot](./shots/api-key-gate.png)

A centered card over a blurred, non-interactive editor, titled "Connect your OpenRouter key".
The subtitle states the privacy promise directly: "Your key is stored only on this machine and sent only to OpenRouter."
A masked key field showing the `sk-or-v1-` prefix pattern, a full-width black Connect button, and a "Clear stored key" link at the bottom.

Below a divider, a "STATE ILLUSTRATION" block stacks all three validation states at once for review purposes: the idle hint, the red rejection message, and the checking spinner.
That block is a design-review device, not a real screen state.
A real implementation shows exactly one of those three at a time.

### FR-2: Launch identity

[launch-splash.html](./screens/launch-splash.html) | [screenshot](./shots/launch-splash.png)

The Chiri lockup centered on the paper-texture background, with a fade-and-scale entrance and a hairline frame inset from the window edge.
No text, no controls, no dismissal affordance, which is what FR-2 asks for.

This screen previously rendered as a solid black square and was fixed.
The `<img>` carried `filter grayscale brightness-0 contrast-125`, and `brightness-0` drove every pixel to black.
Because the logo is an opaque JPEG with a baked-in off-white background rather than a transparent asset, the whole square went black instead of just the mark.
It now uses `filter brightness-110 mix-blend-multiply`, which clips the asset's near-white background to pure white and multiplies it away against the page.

A faint edge on the logo's bounding box is still visible up close, and that is a limit of the raster asset rather than the CSS.
A transparent PNG or a real vector would remove it outright.

### FR-3: Single Markdown document surface

[editor-continuation.html](./screens/editor-continuation.html) | [screenshot](./shots/editor-continuation.png)

The primary reference for document typography.
A centered measure of roughly 670px on a warm off-white page, a fixed 48px topbar, and no file tree, sidebar, tabs, or chat panel, which is what AC-3.5 requires.

The visible constructs are an H1, body paragraphs, an unordered list rendered with em-dash markers rather than bullets, and a fenced code block in mono.
Headings, bold, italic, links, blockquotes, and horizontal rules are not exercised on this screen, so it is not a complete typography specimen for AC-3.1.

### FR-4: Local persistence of the document

No dedicated screen, and the [gallery](./index.html) records this as deliberate.
Autosave has no save button and no specified saving indicator, so its only user-visible evidence is that the document is simply already there when the editor screens load.

**Ignore the "SAVED TO CLOUD" pill.**
[export-menu.html](./screens/export-menu.html) shows a floating status pill reading "642 WORDS, 4,120 CHARACTERS, SAVED TO CLOUD".
Chiri has no cloud, no account, and no server-side copy, so that label is generated filler rather than intent.
The word and character counts in the same pill are a reasonable idea worth keeping.
If a persistence indicator is wanted at all, it would say something local like "saved", and FR-4 does not currently ask for one.

### FR-5: Inline continuation prediction

[editor-continuation.html](./screens/editor-continuation.html) | [screenshot](./shots/editor-continuation.png)

Same screen as FR-3.
Note that the grey ghost-text continuation sits below the 900px fold, so it is not visible in the linked screenshot.
Open the HTML and scroll to see the actual treatment.

The "Predictions" toggle in the topbar, shown on, is the FR-5 off switch.

### FR-6: Selection-triggered AI revisions

[editor-revision-diff.html](./screens/editor-revision-diff.html) | [screenshot](./shots/editor-revision-diff.png)

The best single screen in the set, and the one that carries the core product loop.

A floating action bar sits over the selection with a black "Ask AI" pill followed by one-tap actions: Improve writing, Make shorter, Change tone, Fix grammar.
Beneath it, a free-text instruction field showing "make it more concrete".

The result appears as an inline tracked-change diff in a left-ruled block: the original text struck through in grey, the proposed replacement in solid black below it.
A "Reason: added concrete detail about timing expectations" line explains the change, with Accept, Reject, and Refine as text actions on the right.

### FR-7: Refine a revision in place

[editor-revision-diff.html](./screens/editor-revision-diff.html) | [screenshot](./shots/editor-revision-diff.png)

Same screen as FR-6.
The FR-7 element specifically is the indented row at the bottom of the revision block, with a turn arrow and the instruction "now less formal".
That row is what shows refinement as a chain attached to the pending revision rather than a chat panel, which is the point of AC-7.2.

### FR-8: Model selector

[model-selector-open.html](./screens/model-selector-open.html) | [screenshot](./shots/model-selector-open.png)

A dropdown from the topbar showing exactly three curated models, which satisfies the "short enough to scan" half of AC-8.5.
Each row carries a display name, a plain-language tradeoff descriptor, and the raw OpenRouter model id:

- GPT-4o mini, "fast, low cost", `openai/gpt-4o-mini`, checkmarked as selected
- Claude 3.5 Sonnet, "stronger reasoning, slower", `anthropic/claude-3.5-sonnet`
- Gemini 1.5 Pro, "large context", `google/gemini-1.5-pro`

The default matches the PRD.
The screen does not address the last sentence of FR-8, which says that if continuation and revisions use different models, the selector must state which selection applies to what.
This selector presents a single global choice.

### FR-9: Export the document

[export-menu.html](./screens/export-menu.html) | [screenshot](./shots/export-menu.png)

Both export paths live in the topbar as Copy and Download `.md`.
The screen captures the post-copy confirmation state, with a greyed "COPIED!" label next to the copy icon, which covers AC-9.1.

The derived filename is previewed in the top right as `why-remote-teams-struggle-with-async-communication.md`, slugged from the document's H1, which is exactly AC-9.3.

See the FR-4 note above for the "SAVED TO CLOUD" problem on this screen.

### FR-10: Prediction request discipline

No dedicated screen, and the [gallery](./index.html) records this as deliberate.
Debouncing, cancellation of stale requests, and the concurrency and per-minute ceilings are all specified as silent, and AC-10.4 explicitly requires that hitting the ceiling shows the user nothing.

The one visible surface FR-10 owns is the on/off state of continuation prediction, which is the "Predictions" toggle in the topbar.
That toggle appears on [editor-continuation.html](./screens/editor-continuation.html), [onboarding-empty-document.html](./screens/onboarding-empty-document.html), and [model-selector-open.html](./screens/model-selector-open.html).
No screen shows it in the off state.

### FR-11: Empty-document onboarding cue

[onboarding-empty-document.html](./screens/onboarding-empty-document.html) | [screenshot](./shots/onboarding-empty-document.png)

An otherwise empty page carrying one line of grey centered text: "Start writing. Press Tab to accept a suggestion when you see one."
That single sentence covers both halves of AC-11.2, since it says how to begin and names Tab as the accept keystroke.
There is no sample content, no modal, and no tour, which is what the requirement asks for.

This screen also doubles as the cleanest illustration of the empty state of the FR-3 surface.

### FR-12: AI failure and offline behavior

[revision-failure-state.html](./screens/revision-failure-state.html) | [screenshot](./shots/revision-failure-state.png)

Shows the two visible failure classes, correctly leaving the silent continuation failure invisible.

An inline dismissible banner under the highlighted selection reads "Couldn't complete that request. Try again?" with a black Retry button and an X, which is AC-12.2.
Lower on the page, a second banner reads "Out of credit on your OpenRouter account. Add credit to continue using AI features", naming credit as the cause per AC-12.5.

The document text around both banners is unchanged and still legible, which is the AC-12.6 promise.

## Orphan file

[document-editor-mid-draft-with-live-continuation-and-a-pending-revision.html](./document-editor-mid-draft-with-live-continuation-and-a-pending-revision.html) | [screenshot](./shots/document-editor-mid-draft-orphan.png)

This file sits at the root of the folder rather than in `screens/`, and is not referenced by the gallery.
It is an earlier exploration and it is off-brief in ways that make it actively misleading as a reference:

- The model selector reads "Chiri-1 (Pro)", implying a first-party model, which contradicts FR-8's OpenRouter-backed curated list.
- The sample document copy sells "rebuilt the core syncing engine, every keystroke preserved across devices" and lists "E2E encrypted collaborative editing", all of which contradict FR-4's local-only, no-sync persistence.
- The topbar uses an icon cluster with an overflow kebab menu rather than the labelled Copy and Download actions the other screens settled on.

It should either be deleted or moved out of the design-preview folder so it is not mistaken for current direction.

## Where the screens diverge from the PRD

Listed so the divergences are not mistaken for intent.
These are places to trust the PRD and disregard the picture.

1. **"SAVED TO CLOUD" describes a feature that does not exist.** On [export-menu.html](./screens/export-menu.html). Chiri is local-only per FR-4.
3. **The logo is duplicated in three topbars.** [export-menu.html](./screens/export-menu.html), [editor-revision-diff.html](./screens/editor-revision-diff.html), and [revision-failure-state.html](./screens/revision-failure-state.html) each place the logo image next to a text "Chiri" wordmark. Since the image is itself a full lockup containing the word "Chiri", the wordmark appears twice, and the image copy is squashed into a 20px square where it reads as an illegible smudge. The three screens that use text alone are the correct treatment.
4. **No screen covers FR-3's full construct set.** Bold, italic, links, blockquotes, and horizontal rules are never rendered, so there is no visual reference for them. This is a gap in the inspiration, not an error in it.
5. **The logo is a raster asset.** All logo instances point at a Google CDN URL serving a 512x512 JPEG, with no vector source anywhere in the repo. A local copy is saved at `public/logo-source.jpg`. Note that `public/favicon.svg` is unrelated scaffold artwork, not the Chiri mark.

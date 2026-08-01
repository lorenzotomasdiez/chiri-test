# Chiri Core Components

| Field | Value |
|---|---|
| Status | Draft |
| Owner | Lorenzo Tomas Diez |
| Last updated | 2026-07-28 |
| Source of truth for | The shared, always-present chrome of the application |
| Derived from | [PRD](../prd/chiri/index.md), [DESIGN.md](../design-preview/chiri/DESIGN.md), and the eight rendered screens in [`docs/design-preview/chiri/screens/`](../design-preview/chiri/screens/) |

## How to read this document

This document specifies the **core components**: the parts of Chiri that are the same on every screen and do not change in response to what the AI is doing.
The navbar, the wordmark, the writing column, the toggle, the buttons, the panels, the type scale, the motion.

It deliberately does not specify the **interaction components**: ghost continuation text, the selection action bar, the inline diff, the refinement input.
Those are behavioral surfaces driven by FR-5, FR-6, and FR-7, they change shape with the state of the AI, and they get their own document.
Where a core component has to make room for one of them, that is noted, but the interaction component itself is out of scope here.

Every component below is written as a set of **natural language tests**.
Each test is a statement that a person, or a later automated check, can hold against a running build and answer yes or no.
They are numbered `CC-<component>.<n>` so they can be cited from a task or a review.

Each component also names a **reference**: the exact rendered HTML file that got the component right, and should be opened and imitated once the implementation stack is chosen.
The references are design mockups, not code to copy.
They are Tailwind CDN prototypes with hardcoded content and non-functional scripts.
Take the visual result, the measurements, and the structure from them.
Do not take their markup, their inline scripts, or their dependency on `cdn.tailwindcss.com`.

**Important: the references disagree with each other.**
The eight screens were generated independently and a single reconciliation pass over them only partially took.
Where they disagree, this document picks a winner and says so.
The winner is binding and the loser is a rendering artifact to be ignored, no matter how many screens it appears on.

---

## 1. Foundations

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html), which is the most complete and internally consistent expression of the system.

### 1.1 Color

The system is monochrome.
There is exactly one chromatic decision, a near-black ink, and one exception, an error red.
Everything else is a step of that near-black or a step of the off-white paper.

| Role | Value | Used for |
|---|---|---|
| Ink (primary) | `#1D1D1F` | Body text, headings, wordmark, primary button fill, active toggle fill |
| Paper (background, surface) | `#FDF8F8` | The page, the top bar, the card surfaces |
| Muted ink | `#46464A` | Secondary UI labels, diff reason lines, model description text |
| Ghost / outline | `#77767B` | Continuation ghost text, list bullets, dropdown carets |
| Hairline | `#C7C6CA` | Every border in the product, always at reduced opacity |
| Container fill | `#F1EDEC` | Code block background, hovered dropdown row |
| Panel white | `#FFFFFF` | The fill of floating panels that sit above the paper |
| Error | `#BA1A1A` | The single error state color, text and icon only |

CC-COLOR.1 No hue other than the near-black ink and the single error red appears anywhere in the interface.
There is no blue, no green, no brand accent, and no status palette.

CC-COLOR.2 The ink value is `#1D1D1F`, matching the seed color in DESIGN.md.
Screens rendering the ink as `#030304` (`api-key-gate`, `model-selector-open`, `export-menu`, `revision-failure-state`, `editor-revision-diff`) are wrong and are not to be copied.
The difference is invisible at a glance, which is exactly why it has to be fixed once at the token layer rather than per screen.

CC-COLOR.3 Every distinction the interface draws is carried by weight, opacity, size, or structure, and never by hue alone.
This is a hard requirement from NFR-6, not a stylistic preference.

CC-COLOR.4 Error red is used for the text and the icon of a failure message only.
It never becomes a fill, a border, or a background tint.

CC-COLOR.5 The app is light mode only.
Any `dark:` variant found in the reference files is dead weight from generation and must not be carried into the implementation.

### 1.2 Typography

CC-TYPE.1 A single family, Inter, carries both the interface and the document.
No serif, no second sans, no display face.

CC-TYPE.2 There is no second family.
Public Sans appears in every reference file as a `label` font, but DESIGN.md specifies a single family and calls the non-pairing deliberate.
Micro-labels are Inter at small size, uppercase, with wide tracking, which produces the same result without a second webfont.
See CUT.1.

CC-TYPE.3 The document type is always larger and heavier than the interface type around it.
Document body is `18px` with a line height near `1.7`.
Interface labels are `14px` with tight tracking.
Micro-labels are `10px` to `11px`.
No interface text is ever as large as any heading inside the document.

CC-TYPE.4 The document H1 is `36px`, weight 700, letter spacing `-0.025em`, with `32px` of space beneath it.

CC-TYPE.5 Interface text uses tight letter spacing (`tracking-tight`).
The wordmark uses tighter still (`tracking-tighter`).

CC-TYPE.6 Font smoothing is antialiased.
`-webkit-font-smoothing` is non-standard, and the browsers disagree on what they report back: Blink and WebKit echo the declared `antialiased`, while Gecko normalises it to `grayscale`.
Both are the same smoothed rendering, so an automated check on this property must accept either value rather than treating Firefox as a failure.

### 1.3 Shape, hairlines, and elevation

CC-SHAPE.1 Edges are defined by 1px hairlines, never by shadow.
Every hairline in the product is the hairline color at 10% to 30% opacity, never at full strength.

CC-SHAPE.2 The radius scale is `4px` default, `8px` large, `12px` extra large, and full round reserved for the toggle pill and the toggle knob only.
Floating panels use `8px`.
Buttons and inputs use `4px`.

CC-SHAPE.3 Shadow, where it appears at all, is a whisper: the key gate card uses `0 4px 32px rgba(0,0,0,0.02)`.
Nothing in the product casts a shadow that reads as elevation at normal viewing distance.

CC-SHAPE.4 Spacing is generous and the density is low.
The horizontal gutter of the top bar is `24px`.
The gap between top bar control groups is `24px`.
The document column has `96px` of space above it and at least `128px` below it.

### 1.4 Iconography

CC-ICON.1 Icons are Material Symbols Outlined, unfilled, at `18px`, optical size 20, weight 300.
Weight 400 appears in some references and is acceptable, but one weight must be picked and used everywhere.

CC-ICON.2 Icons in the top bar never appear without their text label.
See CC-NAV.7.

CC-ICON.3 The icon set actually in use is small and closed: `expand_more`, `content_copy`, `download`, `check`, `error`, `info`, `close`, `subdirectory_arrow_right`.
`auto_awesome` is explicitly not in it, per CUT.4.
Adding an icon to this set is a design decision, not an implementation detail.

---

## 2. Application shell

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html).

The shell is a top bar and a single centered column, and nothing else.

CC-SHELL.1 The application is a single window with exactly two structural regions: a fixed top bar and a centered document column beneath it.

CC-SHELL.2 There is no sidebar, no tab strip, no file tree, no document list, no chat panel, and no secondary navigation anywhere in the application, in any state.
This is AC-3.5 and it is the product's central claim, so it is a test that must be run against every screen, not just the editor.

CC-SHELL.3 The page background is the paper color and it is unbroken.
No panel, card, or container is drawn behind the document to represent "the page".
The document sits directly on the app background.

CC-SHELL.4 The document column is `max-width: 42rem` (672px), horizontally centered, with `24px` of side padding at narrow widths.
It is the only column.

CC-SHELL.5 The column begins `96px` from the top of the viewport, which clears the `48px` top bar with `48px` of air, and ends with at least `128px` of trailing space so the last line never sits against the bottom edge.

CC-SHELL.6 The page never scrolls horizontally.
Code blocks scroll within themselves.

CC-SHELL.7 The scrollbar, if visible, is `6px` wide with a transparent track and a hairline-colored thumb.

CC-SHELL.8 Nothing floats over the document except the components this document or the interaction-components document explicitly defines.
Specifically rejected, having appeared in the references: a floating filename tooltip beneath the top bar, and a bottom status bar with word and character counts.
See CC-REJECT.

---

## 3. Top bar (navbar)

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html), lines 162 to 191.
This is the canonical navbar.
Four of the eight screens deviate from it and all four deviations are rejected below.

### Shape

CC-NAV.1 The top bar is fixed to the top of the viewport, spans the full width, is exactly `48px` tall, and sits above the document at a z-index that nothing in the document surface can exceed.

CC-NAV.2 Its background is the paper color, the same as the page, so it reads as the top of the sheet rather than as a separate bar.
It is separated from the document only by a single hairline along its bottom edge at 30% opacity.

CC-NAV.3 It has `24px` of padding on both sides, and its contents are vertically centered.

CC-NAV.4 It is a two-part layout: the brand at the far left, and a single right-aligned cluster of controls.
The center is empty.
There are no menu items, no document title, and no breadcrumb.

### Contents and order

CC-NAV.5 The right cluster contains exactly four things, in this order, left to right: the Predictions toggle, the model selector, a divider, then Copy and Download.

CC-NAV.6 Control groups in the right cluster are separated by `24px`.
Copy and Download sit closer to each other, `16px` apart, because they are one group.

CC-NAV.7 Copy and Download are always icon plus text label, reading "Copy" and "Download .md".
Icon-only rendering is rejected (`model-selector-open`).
Truncating the label to ".md" is rejected (`export-menu`).

CC-NAV.8 A `1px` vertical hairline `16px` tall, or a left border on the actions group, separates the model selector from the Copy and Download pair.

### Behavior

CC-NAV.9 Top bar controls sit at reduced emphasis by default (60% to 80% opacity) and come to full opacity on hover, over a 200ms transition.
The currently selected model name is the exception: it sits at full ink because it is state, not an action.

CC-NAV.10 Pressing a top bar button gives a small tactile response, either `active:scale-95` or a drop to 80% opacity.
One of the two is chosen and applied to every button in the bar.

CC-NAV.11 Every control in the bar is reachable and operable by keyboard alone, with a visible focus ring, per NFR-6.
No reference file implements this and every one of them must be corrected on the way in.

CC-NAV.12 The top bar is present on every screen after the key gate is passed, and on no screen before it.

---

## 4. Brand wordmark

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html), line 164.

CC-BRAND.1 In the top bar, the brand is the word "Chiri" set as text: `18px`, weight 600, tighter tracking, full ink.
No icon, no image, no mark.

CC-BRAND.2 The icon-plus-wordmark lockup in `editor-revision-diff`, `export-menu`, and `revision-failure-state` is rejected for the top bar.
It adds a second visual element to the quietest corner of a product whose entire premise is restraint, and the icon it uses is a remote Google-hosted asset that will not exist in the build.

CC-BRAND.3 The graphical mark is used in exactly one place in the product: the launch screen.
See CC-SPLASH.

CC-BRAND.4 The wordmark is not a link, not a menu trigger, and not clickable.
There is nowhere to navigate to.

---

## 5. Predictions toggle

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html), lines 168 to 173 and 138 to 157.

This control is the visible surface of FR-10's off switch.

CC-TOGGLE.1 The control is the word "Predictions" at `14px` in muted ink at 80% opacity (per CC-ALL.6, 60% falls below WCAG AA against the paper background), followed `8px` later by a pill switch.

CC-TOGGLE.2 The pill is `32px` wide and `16px` to `18px` tall, fully rounded.
The knob is a `12px` white circle inset `3px` from the pill's edge.

CC-TOGGLE.3 On, the pill is filled with full ink and the knob sits right.
Off, the pill is filled with the hairline color and the knob sits left.

CC-TOGGLE.4 The knob travels with a 200ms transition and the fill cross-fades over the same duration.
The knob slides; it never jumps.

CC-TOGGLE.5 The on and off states are distinguishable without relying on the fill color alone, because knob position carries the state independently.
This satisfies NFR-6 for this control.

CC-TOGGLE.6 The control is a real button element with an accessible label and a pressed state that assistive technology can read.
The reference implements it as a styled `div` on several screens, which is wrong.

CC-TOGGLE.7 Toggling it off must not restyle, hide, or disturb any committed text in the document.
It affects future continuations only, per AC-10.5.

---

## 6. Model selector

The trigger lives in the top bar.
The dropdown is a floating panel.

### Trigger

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html), lines 175 to 178, for typography and emphasis.
[`model-selector-open.html`](../design-preview/chiri/screens/model-selector-open.html), lines 137 to 140, for the hover treatment.

CC-MODEL.1 The trigger is the selected model's short display name at `14px` in full ink, followed by an `expand_more` caret in the outline color at reduced opacity.

CC-MODEL.2 The default reads "GPT-4o mini", the friendly name, not the `openai/gpt-4o-mini` slug.
The slug belongs in the dropdown row, not in the bar.

CC-MODEL.3 On hover the trigger takes a subtle container fill behind it with a `4px` radius, and the caret comes to full opacity.

CC-MODEL.4 The trigger never shows a spinner, a badge, or a request-in-flight indicator.

### Dropdown panel

**Reference:** [`model-selector-open.html`](../design-preview/chiri/screens/model-selector-open.html), lines 153 to 178.
This screen owns this component and is the only reference for it.

CC-MODEL.5 The panel is `288px` wide, anchored below the top bar and flush to the right gutter (`top: 48px; right: 24px`), on the panel-white fill with a hairline border at 30% and an `8px` radius.

CC-MODEL.6 Each row is `16px` horizontal and `12px` vertical padding, and contains three pieces of information stacked: the friendly name at `14px` weight 500, an inline dash-prefixed capability note at `10px` in muted ink at 60% ("fast, low cost", "stronger reasoning, slower", "large context"), and, only where the friendly name would otherwise be ambiguous, the provider slug beneath at `11px` at 50%.
See CUT.5.

CC-MODEL.7 The capability note is what satisfies AC-8.5: the user must be able to choose between speed and capability from the row alone, without prior knowledge.

CC-MODEL.8 Rows are separated by a hairline at 10% opacity.
The first row has no top border.

CC-MODEL.9 The selected row carries the container fill and a `check` icon at the right edge in full ink.
Selection is marked by the check, not by the fill alone.

CC-MODEL.10 Hovering an unselected row gives it the same container fill.
The check remains the only permanent selection marker.

CC-MODEL.11 The list is short enough to read without scrolling.
Three to five entries.
A scrolling model list is a failure of AC-8.5, not a feature.

CC-MODEL.12 The panel closes on selection, on outside click, and on Escape, and returns focus to the trigger.

CC-MODEL.13 The panel is fully keyboard operable: arrow keys move between rows, Enter selects, Escape dismisses.

---

## 7. Document surface

**Reference:** [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html), lines 99 to 137 for the type styles and 194 to 218 for the rendered result.

This is the component every other component exists to stay out of the way of.
It is core chrome in the sense that its typography is fixed and shared, even though its contents are the user's.

CC-DOC.1 The document renders as structured text, not as Markdown source.
Headings look like headings, bold looks bold, lists look like lists, as the user types.

CC-DOC.2 The editing surface never draws a focus outline, a border, a box, or a background of its own.
Focus is expressed by the caret and nothing else.

CC-DOC.3 Paragraphs: `18px`, line height `1.75`, `24px` of space beneath, in ink.

CC-DOC.4 H1: as specified in CC-TYPE.4.
Lower heading levels step down proportionally and keep the same weight and tracking treatment.

CC-DOC.5 Unordered lists drop the disc entirely.
Each item is indented `24px` and prefixed with an em-width dash in the ghost color, set in the left gutter.
This is the single most distinctive typographic decision in the product and it must survive implementation.

CC-DOC.6 List items sit `8px` apart, and the list block has `24px` beneath it.

CC-DOC.7 Fenced code blocks use the container fill, `16px` of padding, a `4px` radius, a hairline border at 30%, and scroll horizontally within themselves.

CC-DOC.8 Inline code and code blocks use the system monospace stack at `14px`.
No webfont is loaded for monospace.

CC-DOC.9 Text selection is rendered as the ink at 10% opacity.
It is never a blue system highlight.

CC-DOC.10 Every Markdown construct named in FR-3 has a defined visual treatment here before implementation starts: headings, paragraphs, bold, italic, ordered and unordered lists, links, inline code, fenced code, blockquotes, horizontal rules.
The references only demonstrate six of these.
Blockquote, horizontal rule, ordered list, and link are undefined in the mockups and must be designed to match, not improvised during implementation.

CC-DOC.11 The onboarding cue, when the document is empty, is a single line at the first caret position in muted ink at 40% opacity, reading in the register of "Start writing. Press Tab to accept a suggestion when you see one."
It is not interactive, does not block input, and disappears on the first keystroke.
Reference: [`onboarding-empty-document.html`](../design-preview/chiri/screens/onboarding-empty-document.html), lines 95 to 98 and 145 to 147.

---

## 8. Floating panel primitive

Three different things in this product float above the page: the model dropdown, the selection action bar, and inline messages.
They must be recognisably the same object.

**Reference:** [`model-selector-open.html`](../design-preview/chiri/screens/model-selector-open.html) line 153, and [`editor-revision-diff.html`](../design-preview/chiri/screens/editor-revision-diff.html) line 162.

CC-PANEL.1 A floating panel is the panel-white fill, a `1px` hairline at 30% opacity, an `8px` radius, and at most the whisper shadow from CC-SHAPE.3.

CC-PANEL.2 A floating panel never uses a drop shadow to separate itself from the page.
The hairline does that work.

CC-PANEL.3 Internal divisions inside a panel are hairlines at 10% opacity, one step fainter than the panel's own edge.

CC-PANEL.4 A floating panel never covers the text it refers to.

CC-PANEL.5 Every floating panel dismisses on Escape and on outside click.

---

## 9. Buttons and inputs

**Reference:** [`api-key-gate.html`](../design-preview/chiri/screens/api-key-gate.html), lines 120 to 134.
This screen owns the form primitives.

### Primary button

CC-BTN.1 Full-width where it commits a form, `48px` tall, ink fill, white label at `14px` weight 500, `4px` radius, tight tracking.

CC-BTN.2 Hover drops it to 90% opacity, press to 75%.
There is no hover color change, because there is no second color.

### Compact button

**Reference:** [`revision-failure-state.html`](../design-preview/chiri/screens/revision-failure-state.html), line 146, and [`editor-revision-diff.html`](../design-preview/chiri/screens/editor-revision-diff.html), line 164.

CC-BTN.3 A compact primary button is `12px` horizontal and `4px` vertical padding, ink fill, white label at `12px` weight 500, `4px` radius.
This is the Retry button and the "Ask AI" button.

CC-BTN.4 A compact secondary button is the same geometry with no fill and a hairline border at 20%, label in muted ink.
Hover gives it the container fill.
These are the one-tap action chips.

### Text button

CC-BTN.5 A text button is a label alone in muted ink at 80% (per CC-ALL.6, 60% falls below WCAG AA against the paper background), coming to full ink on hover, optionally underlined on hover with a `4px` underline offset.
"Clear stored key" is the canonical instance.

### Text input

CC-INPUT.1 A form input is `48px` tall, transparent fill, a full-strength `1px` outline border, `16px` of horizontal padding, and a `4px` radius.

CC-INPUT.2 On focus the border goes to full ink and gains a `1px` ink ring.
There is no glow, no color shift, and no animated border.

CC-INPUT.3 Placeholder text is the hairline color.
A secret field masks its value and shows a partially redacted hint (`sk-or-v1-••••••••7f2a`).

CC-INPUT.4 A field label above an input is `11px` Inter, weight 600, uppercase, `0.08em` tracking, muted ink, `8px` above the field.

CC-INPUT.5 Inputs that sit inside a floating panel drop their border entirely and rely on the panel for containment, with the placeholder carrying the affordance.
Reference: [`editor-revision-diff.html`](../design-preview/chiri/screens/editor-revision-diff.html), line 176.

---

## 10. Status and message components

Chiri has three ways of saying something went wrong or is happening, and they are not interchangeable.

### Inline status line

**Reference:** [`api-key-gate.html`](../design-preview/chiri/screens/api-key-gate.html), lines 139 to 153.

CC-STATUS.1 A status line is a `18px` icon, `12px` of gap, then a `14px` message on one line.

CC-STATUS.2 Idle uses the `info` icon in muted ink.
Error uses the `error` icon and sets the message in error red.
Working replaces the icon with a `16px` spinner: a `2px` ring in ink at 20% with a full-ink top segment, rotating continuously.

CC-STATUS.3 The three states are mutually exclusive.
The reference stacks all three at once under a "State Illustration" heading; that is a mockup device and must not ship.

CC-STATUS.4 Message copy is one line, factual, no apology.
"That key was rejected by OpenRouter." not "Sorry, we couldn't validate your key."

### Inline banner

**Reference:** [`revision-failure-state.html`](../design-preview/chiri/screens/revision-failure-state.html), lines 140 to 153 and 160 to 172.

CC-BANNER.1 A banner is a full-column-width block on a very slightly lifted fill (`#FCFAFA`) with a `1px` hairline at 10%, an `8px` radius, and `12px` to `16px` of padding.

CC-BANNER.2 It contains an icon, a one-line message, and its actions on a single row: the action button first, then a `close` icon button at `16px`.

CC-BANNER.3 Every banner is dismissible, and a retryable banner carries a Retry button, per FR-12.

CC-BANNER.4 A banner appears in the document flow directly beneath the span it refers to, pushing text down rather than overlaying it.

CC-BANNER.5 A banner enters with a 300ms fade plus a short downward slide, and dismisses with a 200ms fade plus an upward slide.

CC-BANNER.6 An informational banner, such as the out-of-credit case, drops the error icon and red text and instead takes a `2px` ink left border with an `info` icon.
It states the cause and the fact that editing still works, in one sentence.

CC-BANNER.7 Continuation failures never produce a banner, a status line, or any visual at all.
Silence is the specified behavior, per AC-12.1.
This is a test that is passed by seeing nothing.

### Transient confirmation

CC-TOAST.1 A confirmation of a completed action, such as a clipboard copy, is a `10px` uppercase wide-tracked label in ink at 40%, placed immediately beside the control that caused it.

CC-TOAST.2 It fades out on its own after roughly three seconds over a two-second fade.

CC-TOAST.3 It never appears as a corner toast, a snackbar, or a centered overlay.
It appears at the control, or not at all.

---

## 11. Pre-shell surfaces

Two screens exist before the application shell does.
They share a frame.

CC-PRE.1 On the launch screen and the key gate, no top bar and no document column is present or visible behind the overlay.

CC-PRE.2 Both fill the window, center their content on both axes, and prevent scrolling.

### Launch screen

**Reference:** [`launch-splash.html`](../design-preview/chiri/screens/launch-splash.html).

CC-SPLASH.1 The screen is the flat paper background with the Chiri mark centered and nothing else.
No grain, no texture, no frame.
See CUT.2 and CUT.3.

CC-SPLASH.2 The mark is `192px` square, scaling to `256px` at larger viewports, rendered in pure monochrome.

CC-SPLASH.3 There is no product name in text, no tagline, no spinner, no progress bar, and no version string.

CC-SPLASH.4 There is no inset hairline frame around the window.
The reference draws one (line 122) and it is pure ornament on the one screen that is supposed to say the product's name and get out of the way.
See CUT.3.

CC-SPLASH.5 The screen is entirely non-interactive: no pointer events, no text selection, no dismissal affordance, per AC-2.4.
The mouse-follow parallax script in the reference (lines 126 to 134) directly violates this and is rejected.
It also overwrites the entry animation's transform, so it is a bug as well as a spec violation.

### Key gate

**Reference:** [`api-key-gate.html`](../design-preview/chiri/screens/api-key-gate.html).

CC-GATE.1 The gate is a centered card, `512px` maximum width, `32px` horizontal and `64px` vertical padding, on the surface fill with a hairline border at 30%, an `8px` radius, and the whisper shadow.

CC-GATE.2 It sits over a full-window backdrop of the paper color at 85% with a `4px` blur.

CC-GATE.3 The card's regions are separated by `48px`: heading block, then interaction block, then footer action.

CC-GATE.4 The heading is `30px` weight 600 with tight tracking, followed by one `15px` line of muted body copy stating plainly that the key stays on this machine and goes only to OpenRouter.
That sentence is a product requirement, not decoration: it is what SC-9 is judged on.

CC-GATE.5 The card has no close control and no way past it.
There is no dismissal, because there is nothing behind it.

CC-GATE.6 There is no paper-grain overlay.
The reference layers one at 3% opacity (line 165) from a remote image.
See CUT.2.

---

## 12. Motion

There is very little motion in this product and all of it is listed here.
Anything not on this list should not exist.

CC-MOTION.1 The launch mark enters with a fade from 0 to 1 combined with a scale from `0.98` to `1`, over `1.2s` on `cubic-bezier(0.4, 0, 0.2, 1)`, running once and holding.
Reference: [`launch-splash.html`](../design-preview/chiri/screens/launch-splash.html), lines 94 to 101.
**This is the product's signature animation and the one piece of motion that is allowed to be slow enough to notice.**
It is the whole of FR-2's expressive budget.

CC-MOTION.2 The transition from the launch screen to whatever follows happens exactly once, with no flicker and no second transition, after the minimum dwell has elapsed, per AC-2.2.

CC-MOTION.3 The application shell enters with an opacity fade of roughly `0.8s`, with the top bar and the document column staggered about `100ms` apart.
Reference: [`onboarding-empty-document.html`](../design-preview/chiri/screens/onboarding-empty-document.html), lines 172 to 181.
This runs on first paint of the editor only, never on subsequent state changes.

CC-MOTION.4 Hover and opacity transitions on interface controls are `200ms` ease.

CC-MOTION.5 The toggle knob travels in `200ms`.

CC-MOTION.6 Banners enter and leave per CC-BANNER.5.

CC-MOTION.7 The ghost continuation text appears without animation.
It does not fade in, type in, shimmer, or pulse.
It is simply there on the next frame.
A continuation that animates draws attention to itself, which is the opposite of the intent, and it competes with the user's own typing rhythm.

CC-MOTION.8 Nothing in the product loops, breathes, pulses, or animates continuously, with the single exception of the validation spinner while a key check is genuinely in flight.
The `animate-pulse` on the "Copied!" label in `export-menu` is rejected: it is a confirmation, not an ongoing process.

CC-MOTION.9 All motion respects `prefers-reduced-motion`.
Under that setting, CC-MOTION.1 and CC-MOTION.3 become instant state changes and CC-MOTION.6 becomes a plain appearance.

---

## 13. Rejected chrome

Every item here appears in at least one rendered reference and must not be implemented.
They are recorded so nobody rediscovers them by reading the mockups.

CC-REJECT.1 The floating filename tooltip beneath the top bar (`export-menu`, lines 161 to 165).
The product has one document and the filename is derived at download time, per AC-9.3.
Showing it permanently is chrome for a problem the product does not have.

CC-REJECT.2 The bottom status bar with word count, character count, and a saved indicator (`export-menu`, lines 191 to 195).
It puts a meter next to a writing surface, and the specific string it displays, "Saved to Cloud", asserts a backend that does not exist and contradicts Non-Goal 10 and NFR-4.

CC-REJECT.3 The dimmed writing column that only reaches full opacity on hover or focus (`model-selector-open`, line 182).
The document is never dimmed.
Making the user's own text harder to read in order to emphasise a dropdown inverts the product's priorities.

CC-REJECT.4 Icon-only Copy and Download buttons (`model-selector-open`, lines 143 to 148).
See CC-NAV.7.

CC-REJECT.5 The icon-plus-wordmark lockup in the top bar.
See CC-BRAND.2.

CC-REJECT.6 All remote image assets, both Google-hosted logo URLs and the `transparenttextures.com` paper pattern.
Every asset must be local or generated.

CC-REJECT.7 The Tailwind CDN script, the Google Fonts links, and the full Material Design color token set.
The references carry roughly forty-five color tokens of which nine are ever used.
The implementation defines the nine in CC-COLOR and no more.

CC-REJECT.8 Every `dark:` variant in the references.
See CC-COLOR.5.

CC-REJECT.9 The "State Illustration" stack on the key gate.
See CC-STATUS.3.

CC-REJECT.10 The mouse-follow parallax on the launch mark.
See CC-SPLASH.5.

---

## 14. Product judgment: what to cut and what is missing

Section 13 rejects things that are rendering artifacts.
This section is a different judgment: things the mockups render competently, that a reasonable person would build, and that this product should still not have.
The test each one fails is PRD Goal 7, that the product surface stays quiet and small, and the DESIGN.md instruction that the interface should disappear.

### Cut

CUT.1 **The second typeface.**
Public Sans is loaded on all eight screens to set perhaps four labels.
DESIGN.md specifies one family and explains why.
A second webfont for uppercase micro-labels is a network request and a maintenance surface buying a difference nobody will name.
Inter at `11px` uppercase with `0.08em` tracking is the same object.

CUT.2 **The paper texture.**
Two screens layer a grain image to make the background feel tactile.
The direction is "a blank sheet of very good paper", and very good paper is smooth.
It is a remote image on the two screens that load fastest and matter most for first impression, and at 3% opacity its actual contribution is a slightly noisier white.

CUT.3 **The inset frame on the launch screen.**
Ornament, on the one surface the PRD explicitly bounds in time and strips of everything.

CUT.4 **The `auto_awesome` sparkle icon.**
It appears on the "Ask AI" button in the revision bar.
The AI sparkle is the single most recognisable piece of "friendly AI assistant" visual language, and DESIGN.md names that treatment as the thing this direction rejects.
The button says "Ask AI"; the words are the affordance.
(This lives in the interaction-components document, but the icon is a system-level decision so the call is made here.)

CUT.5 **The provider slug under each model row.**
`openai/gpt-4o-mini` beneath "GPT-4o mini" is developer-facing text in a writing tool.
AC-8.5 asks that each option carry enough information to choose between speed and capability, and the capability note does that on its own.
Keep the slug only if the curated list ends up containing two variants of the same model, where the friendly name alone would be ambiguous.

CUT.6 **Any second visual for "the AI is working".**
The references never build one, and that restraint should be deliberate rather than accidental.
Continuation is silent by requirement, and a revision's progress is legible from the diff appearing.
A thinking indicator, a shimmer, or a pulsing caret is a place for the product to talk about itself.

### Keep, though it looks like chrome

KEEP.1 **The Predictions toggle in the top bar.**
Four permanent control clusters is a lot for a product this quiet, and this is the one that looks most like a candidate for a settings menu.
It stays in the bar because FR-10 makes it a first-class user control, and because the alternative is a settings surface, which this product does not otherwise have and should not grow one for a single switch.

KEEP.2 **Copy and Download as two separate controls.**
FR-9 requires both paths and AC-9.6 requires download to remain available when the clipboard fails.
Collapsing them into one "Export" menu adds a click to both and a popover to the product, to save one label.

KEEP.3 **"Clear stored key" on the gate.**
It is the only way out of a stored bad key, per FR-1.

### Missing from the mockups and required by the PRD

These have no rendered reference at all and must be designed, not improvised at implementation time.

GAP.1 Ordered lists, links, blockquotes, and horizontal rules.
FR-3 names all four as supported constructs and no screen renders any of them.

GAP.2 The Predictions toggle in its off state, and the editor with continuation disabled.

GAP.3 Keyboard focus treatment for every interactive control.
NFR-6 requires full keyboard operation and not one reference file implements a focus ring.

GAP.4 The key gate re-entered mid-session after the provider rejects a stored key, with the document preserved behind it (AC-12.4).
This is a different emotional moment from the first-run gate and probably needs a different first line.

GAP.5 Confirmation that no toolbar, formatting bar, or undo and redo control exists anywhere.
FR-3 specifies that every construct is produced by typing Markdown, and undo is keyboard only.
The absence is the design; it should be recorded as a decision so nobody adds a toolbar later thinking it was an oversight.

---

## 15. Cross-cutting tests

These are run against the finished build as a whole rather than against one component.

CC-ALL.1 Open all screens in sequence and confirm the top bar is pixel-identical across every one of them: same height, same wordmark treatment, same control order, same labels, same emphasis.
This is the specific failure the design references exhibit, so it is the specific thing to verify.

CC-ALL.2 Confirm no hue other than ink and error red appears in any state of any screen.

CC-ALL.3 Navigate the entire application with the keyboard alone, from the key gate to accepting a revision, per NFR-6.
Every control must be reachable, operable, and visibly focused.

CC-ALL.4 Confirm every hairline in the product is the same color at one of the three permitted opacities, and that no border is drawn at full strength except a focused input.

CC-ALL.5 Confirm the largest interface text is smaller than the smallest document heading.

CC-ALL.6 Confirm contrast meets WCAG 2.1 AA for every text and control pairing, including muted labels at 60% opacity and ghost continuation text, per NFR-6.
Reduced-opacity labels are the likeliest failure and the references were never checked.

CC-ALL.7 Load the application with the network disabled and confirm it renders completely.
Nothing visual may depend on a remote font, script, or image.

---

## 16. Reference index

| Component | Canonical reference | Why it wins |
|---|---|---|
| Foundations, top bar, toggle, document typography | [`editor-continuation.html`](../design-preview/chiri/screens/editor-continuation.html) | The most internally consistent screen; correct ink value, correct wordmark, full action labels |
| Model dropdown | [`model-selector-open.html`](../design-preview/chiri/screens/model-selector-open.html) | The only screen with the open state; its row anatomy satisfies AC-8.5 |
| Form primitives, card, status line, pre-shell overlay | [`api-key-gate.html`](../design-preview/chiri/screens/api-key-gate.html) | The only screen with real inputs and buttons |
| Launch mark and signature animation | [`launch-splash.html`](../design-preview/chiri/screens/launch-splash.html) | The only screen with the mark and the only deliberate animation in the product |
| Banners, compact buttons | [`revision-failure-state.html`](../design-preview/chiri/screens/revision-failure-state.html) | The only screen with failure surfaces |
| Empty state cue, shell entry animation | [`onboarding-empty-document.html`](../design-preview/chiri/screens/onboarding-empty-document.html) | The only screen with the empty document |
| Floating panel, compact chips, confirmation label | [`editor-revision-diff.html`](../design-preview/chiri/screens/editor-revision-diff.html), [`export-menu.html`](../design-preview/chiri/screens/export-menu.html) | Partial; both carry rejected chrome, take only the named component |

The full gallery is [`docs/design-preview/chiri/index.html`](../design-preview/chiri/index.html).

## 17. What this document does not cover

The following are interaction components and belong in a companion document, not here:

- Ghost continuation text and its accept, dismiss, and partial-accept affordances (FR-5).
- The floating selection action bar, its one-tap chips, and its free-text field (FR-6).
- The inline tracked-change diff, its reason line, and its Accept, Reject, and Refine controls (FR-6).
- The refinement input and its multi-turn behavior (FR-7).

Where those components need a surface, a border, a button, or a fill, they use the primitives defined here rather than inventing their own.
That constraint is the reason this document exists.

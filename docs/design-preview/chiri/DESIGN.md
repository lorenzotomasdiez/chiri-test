## Direction

Chiri should feel like a blank sheet of very good paper that happens to think.
The product's entire premise is that the AI's presence is felt through two precise, opt-in-or-ambient behaviors, not through UI.
Because nothing is allowed to compete with the document (PRD Goal 7, Non-Goals 4 and 6), the interface itself must disappear: no color, no chrome, no ornament, just typography, whitespace, and two small moments of AI-authored text that need to be legible as suggestions without ever looking decorative.

## Color

Seed color: `#1D1D1F`, a near-black ink rather than a pure `#000000`, used as the sole chromatic decision in the system.
Mode: LIGHT.
A writing tool is used in normal daylight conditions on a desktop, at length, for reading dense body text; light mode is the correct default and dark mode would fight the "paper" metaphor this product needs.
This color is deliberately not a brand hue.
There is no blue, no accent, no status color palette.
Where most SaaS products reach for a signature color to feel ownable, Chiri's signature is the absence of one: every distinction in the UI (ghost text vs. committed text, removed vs. added diff spans, primary vs. secondary controls) must be carried by weight, opacity, and structure rather than hue, which is also a hard constraint from NFR-6.
Grey values used for ghost text and hairline borders are steps of the same near-black, never a separate palette.

## Typography

A single family, Inter, for both headline and body.
This is a deliberate non-pairing: an editorial serif/sans contrast would import an institutional or literary voice this product does not want, and a second geometric or technical face would read as a stylistic flourish competing with the document's own Markdown typography (its H1, its bullets, its inline code).
Inter is chosen for its restraint and its proven legibility at both the small size of UI controls (model selector, floating action bar, diff labels) and the larger size of rendered document body text, so the same face can carry the model-selector label and the H1 without ever feeling mismatched.
Scale contrast should be moderate, not dramatic: the document's own Markdown hierarchy (H1, paragraph, list, inline code) supplies the visual rhythm; the surrounding UI chrome sits noticeably smaller and quieter than any heading in the document, reinforcing that the document is the only thing meant to command attention.

## Shape and density

Hairline borders, not shadows, define edges: the floating action bar, the diff container, the model selector, all bounded by a 1px near-black line at low opacity rather than elevation effects.
Radius is moderate (8px scale) rather than sharp or pill-shaped: sharp corners would read overly technical/dense for a writing tool, while large or full rounding would read consumer-playful in a way that undercuts the product's quiet, serious register.
Spacing is generous.
This is a single-column, one-document-at-a-time surface with wide margins, so density should be low: the writing area breathes, and the two AI-interaction elements (ghost text, floating action bar with diff) are the only moments of visual density permitted, and only because they are the content being demonstrated.

## Voice

UI copy should be short, factual, and get out of the way, matching the visual restraint.
Floating action bar buttons read as plain verbs: "Shorten," "Change tone," not "Make this punchier!"
The diff reason line is a single clause stated as fact, not a suggestion pitch: "Shortened for clarity," not "I think this reads better shortened."
An empty document state, if it appears, should say something as plain as "Start writing." rather than an onboarding tour or a feature callout.
Errors (model unavailable, revision failed) should state the fact and the next step in one line each, no apology padding: "Model unavailable. Try again or switch models."

## What this direction rejects

It rejects the alternative of a warmer, more "friendly AI assistant" treatment: a soft accent color, a chat-bubble metaphor, rounded pill buttons, or a mascot-like presence for the AI.
That treatment is common in AI writing tools and would be easy to default into, but it contradicts the PRD's explicit brand signal and would visually suggest a conversational assistant sitting alongside the document, exactly the sidebar/chat-panel model the PRD's non-goals rule out.
It also rejects a dark, "developer tool" treatment; despite Chiri manipulating Markdown and config keys, its audience is a solo writer at a desk in normal light, not an engineer monitoring a dim terminal, so dark mode here would be a category mismatch rather than a design win.

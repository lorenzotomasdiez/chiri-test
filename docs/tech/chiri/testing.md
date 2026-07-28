# Testing Seams

| Field | Value |
|---|---|
| Parent | [Technical Blueprint](./index.md) |

## The pure core

Five modules under `src/core/`, each a plain TypeScript file with zero DOM and zero network imports.
An eslint `no-restricted-imports` rule blocks `react`, `@codemirror/*`, and DOM globals from that directory so the purity is enforced rather than hoped for.

- `src/core/schedule.ts` - the scheduler: settle debounce, single-flight continuation, token bucket, caret-generation staleness guard. Takes `{ now, setTimeout }` and a transport function as constructor arguments.
- `src/core/continuation.ts` - eligibility (caret at end of paragraph or list item, not in a fenced code block, not mid-word, not inside a selection, not inside a pending revision span) computed from a plain `{ text, cursorPos, selection }` shape, plus two-sentence truncation, preamble and quote stripping, and duplicate-tail suppression.
- `src/core/revision.ts` - the revision lifecycle as a reducer over `Idle | Requested | Pending | Refining | Accepted | Rejected | Invalidated | Failed`, plus the paragraph-count guard and the out-of-span rejection check.
- `src/core/prompt.ts` - request assembly: the 2,000-character preceding-context window trimmed to a paragraph break, the revision span plus its neighbouring paragraphs, the fixed system messages, and the parameter set. Pure string in, request body out, so the context rules are asserted by comparing strings.
- `src/core/provider.ts` - the pure half: SSE chunk to token parsing, the reason/sentinel/body stream splitter, and provider-error-shape to failure-class mapping. The `fetch` wrapper around it is thin and lives outside the pure boundary.

## The seams

| Dependency | How it is controlled in a test |
|---|---|
| OpenRouter HTTP | The scheduler and request layer take `transport: (req, signal) => Promise<AsyncIterable<string>>`. Unit tests pass an async generator yielding scripted chunks with scripted delays, and one that throws `AbortError`. No MSW at the unit layer. |
| Clock and timers | Injected `now` plus `vi.useFakeTimers()`. Every debounce, ceiling, and settle assertion runs in virtual time. No test sleeps. The persistence layer's 800ms debounce takes the same injected `{ now, setTimeout }` pair as the scheduler, so it is asserted the same way. |
| Page lifecycle (`pagehide`, `visibilitychange: hidden`) | Not listened to inside the persistence layer. The layer exposes `flush(): Promise<void>`, and one thin listener module calls it. Unit tests call `flush()` directly against the in-memory `DocumentStore` and assert a pending debounced write lands immediately; one Playwright spec dispatches `visibilitychange` and asserts the write happened without waiting out the debounce. Without this split the flush path is untestable and can be entirely broken while every other test passes. |
| IndexedDB | Behind `DocumentStore`; an in-memory implementation in unit tests. |
| `localStorage` | Behind `Settings`; a plain object in unit tests. |
| CodeMirror | Not faked. Anything needing decorations, `coordsAtPos`, contenteditable, or key handling runs in a real browser under Playwright. Probe 4 established that CM6 boots under jsdom only with hand-written polyfills and still gives no layout, so it would give false confidence about exactly the things NFR-6 turns on. |
| Provider error responses | Playwright `page.route` intercepting `https://openrouter.ai/*`, serving a canned SSE body plus 401, 429, and 402-insufficient-credit variants. |

## The first failing test

`src/core/schedule.test.ts`, with `vi.useFakeTimers()`:
`it('cancels an in-flight continuation when input resumes and never has two in flight')`.
Construct the scheduler with `settleMs = 600` and a transport spy returning a never-resolving generator while recording its `AbortSignal`.
Call `scheduler.onInput({ docVersion: 1, cursor: 10 })`, advance 600ms, assert the transport was called once.
Call `scheduler.onInput({ docVersion: 2, cursor: 11 })`, assert the first call's `signal.aborted === true` immediately, before the new settle elapses.
Advance 600ms and assert the transport was called exactly twice, with only the second signal unaborted.
That is AC-10.2, and it fails on day one because `src/core/schedule.ts` does not exist.

## What needs real infrastructure

Seven Playwright specs against `npm run dev`, with `page.route` intercepting OpenRouter.
This is the complete browser-spec inventory, and it is what section 7 of the blueprint points at when it names an earliest catch.

1. **Ghost text.** Type a paragraph, wait past settle, assert the ghost widget is in the DOM and *not* in `view.state.doc.toString()` read via `page.evaluate`. Press the accept key, assert it is now in the document. Press Ctrl/Cmd+Z once and assert it is entirely gone.
2. **Reload durability.** Type, wait 2s, reload, assert identical content and caret offset. This one genuinely needs real IndexedDB and a real page lifecycle.
3. **Flush on hide.** Type, immediately dispatch `visibilitychange` with the page hidden, and assert the store holds the typed text before the 800ms debounce would have fired.
4. **Caret across hidden markers.** With the live-preview plugin active on `# Heading`, press ArrowRight from position 0 and assert the head sequence steps 2 to 4 rather than stopping at 3. This is the probe-4 regression and it is invisible by inspection.
5. **Every-construct render.** Load a fixture containing every FR-3 construct, including nested emphasis in a list item in a blockquote, and assert each hidden range's rendered line text matches an expected string. This is what catches an over-extended `EmphasisMark` or list-mark range eating a real character.
6. **Pending-span tracking.** Raise a revision, then type above the span, below it, and inside it, in that order, asserting after each that the mapped range still covers the intended text and that the in-span edit invalidated it (AC-6.11, AC-6.12).
7. **Tab focus traversal.** With no ghost text shown, press Tab and assert focus leaves the editor; with ghost text shown, press Tab and assert it accepts and focus stays. Runs in all three bundled engines. Screen-reader behaviour is not covered here and remains the manual four-browser pass in open question 7.

## What is not worth testing here

Export round-trip fidelity (AC-3.2) gets no assertion.
CodeMirror's document *is* the Markdown string, so the round-trip is identity by construction rather than a serializer that could drift; what remains is browser download plumbing, and one manual export during the first slice covers it.

No accessibility automation runs at all: no axe pass, no automated contrast or landmark checks, nobody is assigned one, and none is planned at this tier.
NFR-6's requirements stay requirements and are built to - the Tab traversal spec above exists precisely because focus behaviour is where they break first - but verifying them is a manual pass by the person building the screen plus the four-browser screen-reader check in open question 7.
This is a proof of concept for one user, and automating accessibility verification is not what the build is reaching for.

Action bar placement gets no spec.
Asserting that a floating element never overlaps a selection means asserting pixel geometry across three engines and two viewport sizes, which is the flakiest category of browser test, and `floating-ui` is the thing being tested rather than our code.
It is a manual check on first integration instead, named in section 7 of the blueprint.

Diff rendering gets no spec either.
`jsdiff` produces the word ranges and the assertion worth making - that the diff decorations cover exactly the changed words - restates the library's own output.
What can go wrong in our code is the span drifting under concurrent edits, and spec 6 covers that.

No visual regression tests, no cross-browser matrix in CI because there is no CI, no tests for launch-mark dwell timing, no tests of Tailwind chrome rendering, and no tests of the model selector's list contents.
The NFR-2 typing-latency bar is checked by hand with a 20,000-character paste and the browser performance panel, not asserted in a test - a p95 latency assertion in a headless browser is flaky theater.

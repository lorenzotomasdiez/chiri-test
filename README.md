# Chiri

A single-page Markdown editor holding exactly one document, where an AI co-author works inside
the document surface rather than in a chat panel.
Ahead of the caret it predicts; behind the caret it waits until invited.

Client-only: no backend, no accounts, no telemetry.
The browser calls OpenRouter directly with the user's own key.

- [Product requirements](./docs/prd/chiri/index.md)
- [Technical blueprint](./docs/tech/chiri/index.md) and [testing seams](./docs/tech/chiri/testing.md)

## Running it

```sh
npm install
npm run dev          # http://localhost:5173
```

## Checks

```sh
npm run test         # Vitest - the pure core in src/core/ only
npm run e2e          # Playwright - anything touching the EditorView, in 3 engines
npm run lint         # oxlint, including the src/core/ purity rule
npm run typecheck
npm run build
```

Vitest covers `src/core/**` and nothing else.
Anything that needs decorations, `coordsAtPos`, contenteditable, or key handling runs in a real
browser under Playwright: probe 4 established that CodeMirror boots under jsdom only with
hand-written polyfills and still has no layout engine, so those assertions would be false
confidence there.

`src/core/` is the pure core - no DOM, no framework, no network, enforced by a lint rule rather
than by convention. Dependencies are injected, which is what lets the whole of FR-10 be asserted
in virtual time with nothing running.

## Where this is

Built: the app shell, the CodeMirror surface with Markdown parsing, undo/redo, the empty-document
cue, and the request scheduler (FR-10) with its unit tests.

Not built yet: live-preview rendering (headings still show their `#`), persistence, the key gate,
ghost-text continuation, and selection-triggered revisions.
Section 11 of the blueprint has the order.

## The API key

Runtime only, never in the build. `.env` holds `OPENROUTER_API_KEY` for probe scripts and is
gitignored; see `.env.example`. The app itself takes the key from the user at runtime and keeps it
in `localStorage`, and it is sent to exactly one destination.

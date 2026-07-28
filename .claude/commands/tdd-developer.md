---
description: Take one tagged feature or requirement through a real red-green TDD cycle - tests first in parallel, then implementation, then browser proof
argument-hint: <FR id, path to a test plan, or a description like "the navigation bar">
---

Build this with TDD: $ARGUMENTS

You are the orchestrator. You write no test and no production code - the workflow's agents do all of it. Your job is to resolve the tag, warn the user about what is about to change on disk, run the workflow, and print the report it returns.

## Step 0 - resolve the tag

`$ARGUMENTS` is a **tag**, and it comes in three shapes. All are valid:

- **A requirement ID** (`FR-3`). Look for a test plan at `docs/tests/*/fr-3.md` - if `/functional-test-plan` has run, one probably exists. Pass its directory as `testPlanDir`. Do not read it; the framer has Read tools and reads it itself.
- **A path** to a test plan or requirement file. Pass it as `testPlanDir`.
- **Free text** describing something nobody wrote down - "the navigation bar", "a dark mode toggle". There is no spec and that is fine: the framer derives the behavior and records every judgment call as an assumption. Pass no `testPlanDir`.

Derive a short kebab-case slug from the tag and set `proofDir` to `docs/proof/<slug>/`.

## Step 1 - tell the user what this will do before it does it

This workflow **writes real code into their repo**. Say so plainly, in a couple of lines, before you start:

- It creates test files and production source files, and modifies existing source.
- It runs their test suite, repeatedly.
- If the project has a UI, it drives a real browser and saves screenshots into `docs/proof/<slug>/`.
- It never installs a dependency, never edits their test configuration, and never changes git state.

Recommend a clean git tree so `git diff` shows exactly what the run did. This matters more here than in the other workflows in this library, because this one is the only one that writes production code.

If the repo has no test framework set up, the framer will stop and say so rather than choosing one - mention that if it happens, picking a test framework is their call, not the workflow's.

## Step 2 - run the workflow

Call the Workflow tool with `scriptPath` set to this package's `.claude/workflows/tdd-developer.js` and `args`:

```json
{
  "tag": "<the tag, verbatim>",
  "testPlanDir": "<path, if one exists>",
  "proofDir": "docs/proof/<slug>",
  "maxTests": 8,
  "skipBrowser": false
}
```

Pass `skipBrowser: true` if the user asked for it, or if you already know the project has no UI.

Raise `maxTests` only if the user asks. The cap exists because every test is an agent plus an implementation obligation, and it drops P1 before P0.

Do not write, fix, or tidy any file yourself while the workflow runs or after it finishes. If something came back wrong, that is a finding to report - hand-editing the output makes the next run's diff meaningless.

## Step 3 - print the report

The workflow returns a `report` field: a text report the reporter agent wrote. **Print it as-is.** Do not summarize it, do not re-order it, and do not soften it - it is already ordered to put unresolved problems first, which is the whole point.

Then add only what the report cannot know:

1. **The diff summary.** Run `git status --short` and show what actually changed on disk. The report says what the agents believe they wrote; this says what is really there. If they disagree, say so - that is the single most important thing you can surface.
2. **Where the screenshots are**, if a browser run happened, and that they are safe to delete.
3. **One line on what to do next**: review the diff, answer any assumption the framer had to make, or re-run with a higher `maxTests` if the cap dropped tests.

If the workflow threw rather than returning, print the error and say which phase it died in. Do not retry it automatically - a failed framing usually means the tag was ambiguous, and re-running with the same tag produces the same result.

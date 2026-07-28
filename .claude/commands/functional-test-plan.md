---
description: Write the natural-language test plan for every functional requirement in a PRD, in parallel, and link each plan back into the requirement it covers
argument-hint: <path to a PRD file or folder> [path to the technical blueprint] [FR ids to limit to]
---

Write the functional test plans for: $ARGUMENTS

You are the orchestrator. You do not write any test plan and you do not edit the PRD - the workflow's agents do both. Your job is to resolve the inputs, run the workflow, and report what came back.

## Step 0 - resolve the inputs

Work out what `$ARGUMENTS` names:

- **The first path that exists** is the PRD: a `docs/prd/<slug>/` folder or a single `.md` file. Do not read it - `test-plan-inventory` has its own Read tools and reads it itself. Relaying its contents through your context is a copy of the whole PRD you never needed to hold.
- **A second path that exists** is the technical blueprint, typically `docs/tech/<slug>/index.md` from `/tech-blueprint`. Pass it as `blueprintPath`.
- **If no blueprint path was given**, look for one at `docs/tech/<slug>/index.md` using the PRD's slug. If it is there, use it and say so. If it is not, run without it - the workflow handles that and marks every scenario's run note as unknown rather than inventing a stack.
- **No PRD path at all**, or a path that does not resolve: stop and say so. This workflow writes tests against a specification and will not invent requirements. Point the user at `/product-blueprint` if they have no PRD yet.

Anything that looks like a requirement ID (`FR-3`, `FR-7`) is a filter - collect them into `only` and mention that you are limiting the run.

Derive a kebab-case slug from the PRD path and set `outDir` to `docs/tests/<slug>/`. Use today's date from your own context as `date`.

## Step 1 - run the workflow

Call the Workflow tool with `scriptPath` set to this package's `.claude/workflows/functional-test-plan.js` and `args`:

```json
{
  "prdPath": "<the resolved PRD path>",
  "blueprintPath": "<the blueprint path, or omitted>",
  "outDir": "docs/tests/<slug>",
  "date": "<today, YYYY-MM-DD>",
  "only": ["FR-3"],
  "maxRequirements": 20
}
```

Tell the user before it starts that this run **edits the PRD**: the final phase injects a `Tests` link into each requirement, wherever that requirement lives. It changes nothing else in those files, and it is safe to re-run because the linker updates an existing link rather than adding a second one. If the PRD has uncommitted changes the user cares about, this is the moment to mention it.

Do not write or edit any plan file yourself, and do not fix the PRD by hand. If something came back wrong, that is a finding to report - the agents are the only writers, and a hand-edit makes the next run's diff meaningless.

## Step 2 - report

Lead with what the user actually needs to act on:

1. **The open questions across all plans.** These matter most: they are the ambiguities in the PRD that the plan writers could not resolve without guessing, and if nobody answers them, whoever writes the code first will resolve them silently and differently. Give the count and point at the index's own open-questions table.
2. **Coverage**: how many requirements were found, how many got plans, and how many scenarios and P0s in total. If anything is in `notCovered`, name it and say why - a cap was hit or a writer failed. Never let a partial run read as complete.
3. **The linking result**: how many links were verified to resolve, and every entry in `unlinked` with its reason. A requirement that got a plan but no back-link is a plan nobody will find.
4. The index path and the output directory.
5. Anything the linker recorded in `notes` - things it noticed in the PRD but deliberately left unedited.

Then say what this is for, in one line: these plans are the contract the real tests get written against, so the next step is `/tdd-blueprint` for a sequenced build order, or writing the first failing test directly from a P0 scenario.

Keep the summary short. The index carries the detail.

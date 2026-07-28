---
description: Turn a PRD into one right-sized technical blueprint - stack, infrastructure, testing seams, and the open questions settled by actually running them
argument-hint: <path to a PRD file or folder> [tier: throwaway|local|internal|production] [focus notes]
---

Produce the technical blueprint for: $ARGUMENTS

You are the orchestrator. You do not design anything and you do not write the document - the workflow's own agents do both, and its `tech-doc-author` is the only thing that writes to the output directory. Your job is to resolve the input, run the workflow, and report what came back.

## Step 0 - resolve the input

Work out what `$ARGUMENTS` names:

- **A path that exists** (a `docs/prd/<slug>/` folder or a single `.md` file): that is the PRD. Do not read it - `tech-framer` has its own Read tools and reads it itself. Relaying its contents through your context is a copy of the whole PRD you never needed to hold.
- **A path that does not resolve**: stop and say so. A dead path is a typo worth surfacing.
- **No path at all**: stop. This workflow designs against a specification and deliberately will not invent one. Point the user at `/product-blueprint` to produce one first.

Then pull out the optional pieces:

- If the arguments contain one of `throwaway`, `local`, `internal`, or `production` as a standalone word, that is an explicit tier - pass it as `tier`. Otherwise leave it out and let `tech-framer` infer it from the PRD, which is the better default.
- Anything else left over is a focus note. Pass it as `notes`.

Derive a kebab-case slug from the PRD path, and set:

- `outDir` to `docs/tech/<slug>/`
- `probeDir` to `.tech-blueprint-probes/<slug>/`

Use today's date from your own context as `date`.

## Step 1 - warn about the probe phase before it runs

This workflow's Probe phase gives agents a real terminal. They create scratch directories, install packages into them, and run commands. That is the entire point - it is what turns "I think that library can't do X" into a fact - but the user should know it is about to happen.

Tell them in one line: the run may create `<probeDir>/` and install packages inside it, each probe is sandboxed to its own directory and forbidden from touching the repo or installing globally, and up to `maxProbes` (default 4) will run in parallel.

If the repo has a `.gitignore` and it does not already cover the probe directory, add the one line `.tech-blueprint-probes/` to it. That is the only file outside the output directory you touch.

## Step 2 - run the workflow

Call the Workflow tool with `scriptPath` set to this package's `.claude/workflows/tech-blueprint.js` and `args`:

```json
{
  "prdPath": "<the resolved PRD path>",
  "outDir": "docs/tech/<slug>",
  "probeDir": ".tech-blueprint-probes/<slug>",
  "date": "<today, YYYY-MM-DD>",
  "notes": "<focus note, or omitted>",
  "tier": "<only if the user named one explicitly>",
  "maxProbes": 4
}
```

Do not write the document yourself, and do not edit it afterwards. If something is wrong with it, that is a finding to report, not a file for you to fix - the author agent is the only writer, and a hand-edit makes the next run's diff meaningless.

## Step 3 - report

Lead with the two things that decide whether the user trusts the document:

1. **The tier and the evidence for it.** Everything in the blueprint is sized against this one judgment, so if it is wrong, nothing else matters. Say which tier and the PRD text that decided it, and mention `tierConflict` if there was one - a conflict means the design was resolved upward on data sensitivity and dropping one requirement might buy a much simpler build.
2. **What the probes actually established.** For each probe: the question, the verdict, and the one-line answer. Call out refutations specifically - a `refuted` probe means a design assumption was wrong and got corrected before anyone built on it, which is the highest-value thing this workflow produces. Note any `inconclusive` ones as questions that now need a human.

Then:

3. The document path, its size, and any split files with the trigger that justified them.
4. The decisions rated `permanent` - the short list of things that would mean a rewrite to change, and therefore the only ones worth arguing about now.
5. The count of open questions left for a human, and where to read them (section 9 of the document).
6. Anything the critique lenses still flagged when the round cap hit. Report these plainly rather than implying a clean pass.
7. If probes ran, the probe directory path, and that it is scratch work safe to delete.

Keep the summary short. The document carries the detail, and re-narrating it here is the copy the hub-and-spoke shape exists to avoid.

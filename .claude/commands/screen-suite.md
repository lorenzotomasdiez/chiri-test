---
description: Render every screen a PRD calls for, in the design system a previous design-preview run already settled
argument-hint: <path to the PRD folder> [| max: N] [| only: FR-3, FR-5] [| no-unify]
---

Render the screen suite for this PRD: $ARGUMENTS

The argument is the PRD folder (the one holding `index.md` and any `fr-N.md`), optionally followed by `| max: N` to cap how many screens get rendered, `| only: FR-3, FR-5` to render just the screens covering those requirements, and `| no-unify` to skip the final consistency pass.

Before calling the workflow, do this yourself:

1. Derive a short kebab-case slug from the PRD folder name or the product name.
2. **Find the design system.** Read `docs/design-preview/<slug>/stitch.json`. This workflow renders in a direction that was already chosen and approved; it does not choose one.
   - If that file does not exist, **stop and do not call the workflow.** Tell the user to run `/design-preview <the PRD>` first, look at the single screen it produces, and come back once they like it. Explain why: rendering a dozen screens in a direction nobody has approved spends a dozen paid generations to find out the direction was wrong.
   - If it exists but has no `projectId` or `designSystemAsset`, say the same thing - the earlier run did not complete.

Then call the Workflow tool now, as an actual tool call (not a description of one), with:
- `scriptPath`: `.claude/workflows/screen-suite.js`
- `args`: a JSON object literal (an actual object in the tool call payload, NOT a JSON-encoded string, and not omitted) shaped:
  `{ "prdDir": "<the PRD folder>", "manifest": <the parsed contents of stitch.json>, "outDir": "docs/design-preview/<slug>", "maxScreens": <N if the user gave one, otherwise omit>, "only": ["FR-3", "FR-5"], "unify": false }` - omit `only` entirely unless the user asked for specific requirements, and omit `unify` entirely unless the user passed `no-unify`.

Do not paraphrase this into prose for a background workflow to interpret - the `args` field must be set directly on the Workflow tool call.

When it returns:

1. Lead with the shape of the plan: how many requirements the PRD has, how many screens that became, and how many rendered successfully. If those three numbers differ, that is the interesting part, so explain it rather than burying it.
2. List the requirements that deliberately got no screen (`noScreen`), with the reason for each. Present this as a decision the planner made, because a stakeholder will ask why their requirement is not in the gallery.
3. Name any screen whose status is not `rendered`, with what happened.
4. Report the `unify` result. If its status is `failed`, say so plainly and explain the consequence in one sentence: the screens exist and are on disk, but they were never reconciled with each other, so expect them to share colors and fonts while differing in chrome. That is the specific thing this workflow was rebuilt to prevent, so it is not a detail to bury.
5. Point the user at the gallery: `<outDir>/index.html`. That is the deliverable. Tell them to open it in a browser.
6. If the run hit the screen cap, the log will name every screen that was dropped. Repeat those names in your reply along with how to get them: re-run with a higher `max`, or with `only:` naming their requirement ids. Do not let a capped run read as a complete one.
7. If `record` is null or missing, warn loudly and print the screen ids from the result, so the run is not lost.

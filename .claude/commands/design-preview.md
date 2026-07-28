---
description: Turn a PRD into a DESIGN.md and one Stitch-rendered HTML screen, to judge a visual direction fast
argument-hint: <path to PRD, or a product description> [| screen: <name>]
---

Produce a design preview for: $ARGUMENTS

The argument is either a path to a PRD file or a plain product description. It may carry an optional `| screen: <name>` suffix, which means the human wants that specific screen instead of the most representative one.

Before calling the workflow, do this yourself:

1. Derive a short kebab-case slug from the PRD filename or the product description.
2. Check whether `docs/design-preview/<slug>/stitch.json` exists. If it does, read it - it holds the Stitch `projectId` and `designSystemAsset` from an earlier run, and reusing them is what makes a second screen match the first. If it does not exist, that is the normal first-run case.

Then call the Workflow tool now, as an actual tool call (not a description of one), with:
- `scriptPath`: `.claude/workflows/design-preview.js`
- `args`: a JSON object literal (an actual object in the tool call payload, NOT a JSON-encoded string, and not omitted) shaped:
  `{ "prd": "<the path or description, without the screen suffix>", "slug": "<slug>", "screen": "<the requested screen name, or omit this field>", "manifest": <the parsed contents of stitch.json, or omit this field entirely if there was no such file>, "outDir": "docs/design-preview/<slug>" }`

Do not paraphrase this into prose for a background workflow to interpret - the `args` field must be set directly on the Workflow tool call.

When it returns:

1. Report which screen was chosen and why (`scope.representativeScreen.name` and `scope.rationale`), and whether this run reused an existing design system or created a new one (`reusedExistingDesignSystem`).
2. State the render outcome from `render.status`. Only claim a preview exists if the status is `rendered`; for `no_html`, `timed_out`, or `failed`, say what happened and point at the Stitch project so the human can look there directly.
3. Give the human the paths: the HTML file, `DESIGN.md`, and `stitch.json`. Tell them to open the HTML in a browser - that file is the actual deliverable, and the point of this workflow is that they look at it and say yes or no.
4. If `render.suggestions` is non-empty, list the follow-ups Stitch offered, without acting on any of them.
5. Mention that a further screen in the same style is one more run: `/design-preview <same PRD> | screen: <other screen>`, which will reuse the saved project and design system rather than creating a new one.
6. If the `record` field is null or missing, warn loudly and print the `stitch.projectId` and `stitch.designSystemAsset` values in your reply, so they are not lost. Without the manifest on disk, the next run creates a duplicate project.

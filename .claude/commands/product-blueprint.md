---
description: Expand a basic PRD into a full, engineering-grade PRD by launching the blueprint-prd-author subagent
argument-hint: <path to a basic PRD file, or the rough PRD text itself, plus optional focus notes>
---

Expand this basic PRD into a full PRD: $ARGUMENTS

You are the orchestrator. You do not write the PRD yourself - you launch the `blueprint-prd-author` subagent with the Agent tool and it writes the files to disk. Your job is to resolve the input, feed the subagent what it needs, and report the result.

## Step 0 - resolve the input and the output location

Work out what `$ARGUMENTS` is:

- **A path to a file that exists**: that is the source. Read it in full. Anything left over after the path is a focus note - pass it to the subagent.
- **Rough PRD text pasted inline** (more than a sentence of real product description): that is the source. Use it as given.
- **Neither** - a path that does not resolve, or a one-line idea with no PRD behind it: stop and say so. A dead path is a typo worth surfacing, and a bare idea has nothing to expand.

Derive a kebab-case slug from the product name (for example "team expense tracker" -> `team-expense-tracker`) and set the output directory to `docs/prd/<slug>/`, creating it if needed. The PRD is `index.md` inside it, plus any `fr-N.md` files the author decides to split out. Use today's date from your own context as the document's "Last updated" value.

Then read the source once and write down, for yourself, the assumptions you are about to hand the subagent: a basic PRD is under-specified by definition, and every gap you leave unresolved is a gap the author fills silently. Resolve each gap once, label it as an assumption, and pass the list along so it lands in the PRD's Assumptions section rather than being invented mid-draft. Anything you cannot responsibly assume becomes an open question you pass along and report at the end rather than silently deciding.

## Step 1 - launch the author

Launch **`blueprint-prd-author`** with the full source text, the focus note, your assumption list, and the date. Tell it that the `docs/prd/` paths in its output format are relative to `<outDir>`: `index.md` and any `fr-N.md` go directly in that directory.

Tell it there is no companion architecture or design document for this product. Its routing rules still hold - implementation detail and visual detail stay out of the PRD - but it names the document that would own each one instead of linking to a file that does not exist, and it does not put Architecture or Design rows in the header table.

It writes its own files and returns a short status, never document text.

## Step 2 - check the result before you report it

Read `<outDir>/index.md` yourself, once, and check only what the author cannot see from inside its own draft:

- Every requirement and user flow the source asked for is present, and nothing is in the PRD that the source and your assumption list did not ask for.
- The focus note, if there was one, actually shaped the document.
- Every `fr-N.md` referenced from the section 7 table exists on disk, and no orphan `fr-N.md` exists that the table does not reference.
- The document does not state different numbers for the same thing (scale, latency, retention, tenancy) or use the same term for different things in two places.

For each problem, relaunch the author with just that issue. Do exactly one such pass, and do not edit the files by hand - the author is the only thing that writes them.

## Step 3 - report

Tell the user, in this order:

1. The PRD path, and every `fr-N.md` that was split out with the trigger that justified it.
2. The requirement count by priority.
3. **The assumptions you had to make** to fill the gaps in the basic PRD, and the open questions you could not answer. These matter most: the whole document was built on them, and they are the fastest thing for the user to correct.
4. Anything still wrong after your fix pass.
5. That the PRD's `Owner` header field is a placeholder they need to fill in.

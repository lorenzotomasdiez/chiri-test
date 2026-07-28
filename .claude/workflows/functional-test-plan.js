export const meta = {
  name: 'functional-test-plan',
  description: 'Write the natural-language test plan for every functional requirement in a PRD, one agent per requirement in parallel, then link each plan back into the requirement it covers',
  phases: [
    { title: 'Inventory', detail: 'list every functional requirement across index.md and any fr-N.md (sonnet, low effort: this is a listing, not a judgment)' },
    { title: 'Write', detail: 'one agent per requirement, all at once - the phase the workflow exists to parallelize (sonnet)' },
    { title: 'Link', detail: 'write the test index and inject a Tests link into each requirement, idempotently (sonnet)' },
  ],
}

const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    productName: { type: 'string' },
    sourceFiles: { type: 'array', items: { type: 'string' } },
    nfrSummary: { type: 'string', description: 'One or two sentences on what the PRD non-functional section covers, so writers know which cross-cutting bars might apply. Not an enumeration.' },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Exactly as the PRD writes it. Never renumber or normalize - these become filenames and test IDs.' },
          title: { type: 'string' },
          priority: { type: 'string', description: 'Empty string if the PRD states none' },
          summary: { type: 'string', description: 'One or two sentences from the PRD, not invented' },
          sourceFile: { type: 'string', description: 'The file a writer should open for full detail: the fr-N.md for promoted requirements, the index for inline ones' },
        },
        required: ['id', 'title', 'summary', 'sourceFile'],
      },
    },
    missingSplitFiles: { type: 'array', items: { type: 'string' }, description: 'Requirement ids whose index table links to an fr-N.md that does not exist on disk' },
  },
  required: ['productName', 'sourceFiles', 'requirements'],
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    requirementId: { type: 'string' },
    path: { type: 'string', description: 'Repo-relative path of the plan file actually written' },
    charCount: { type: 'number', description: 'Measured by reading the file back from disk, never estimated' },
    scenarioCount: { type: 'number' },
    p0Count: { type: 'number' },
    openQuestions: { type: 'array', items: { type: 'string' }, description: 'Ambiguities in the requirement that could not be resolved without guessing' },
    notes: { type: 'string' },
  },
  required: ['requirementId', 'path', 'scenarioCount'],
}

const LINK_SCHEMA = {
  type: 'object',
  properties: {
    indexPath: { type: 'string' },
    linksAdded: { type: 'number' },
    linksUpdated: { type: 'number', description: 'Existing Tests links that pointed somewhere else and were corrected in place' },
    linksVerified: { type: 'number', description: 'Links re-read from disk and confirmed to resolve to a file that exists. Report the verified count, never the attempted count.' },
    unlinked: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          requirementId: { type: 'string' },
          expectedIn: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['requirementId', 'reason'],
      },
      description: 'Requirements whose back-link could not be placed. An honest entry here is correct; a link injected into the wrong requirement is not.',
    },
    notes: { type: 'string', description: 'Anything noticed in the PRD but deliberately left unedited' },
  },
  required: ['indexPath', 'linksAdded', 'linksVerified'],
}

// Normalize args: this environment can deliver the Workflow `args` as a JSON-encoded
// string. Parse it back to an object when that happens; keep a genuine plain-string arg as-is.
let input = args
if (typeof input === 'string') {
  try {
    const parsed = JSON.parse(input)
    if (parsed && typeof parsed === 'object') input = parsed
  } catch {
    // not JSON - a genuine plain-string argument, keep as-is
  }
}

const prdPath = typeof input === 'string' ? input : input && input.prdPath
if (!prdPath) {
  throw new Error(
    'Missing the PRD location. Call this workflow with args set to either a plain string (the PRD file or folder) ' +
    'or an object shaped { "prdPath": "docs/prd/thing", "blueprintPath": "docs/tech/thing/index.md", ' +
    '"outDir": "docs/tests/thing", "date": "YYYY-MM-DD", "only": ["FR-3"], "maxRequirements": 20 }.'
  )
}

const opts = (input && typeof input === 'object') ? input : {}
const blueprintPath = opts.blueprintPath || null
const date = opts.date || 'unknown - fill in before this leaves Draft'
const only = Array.isArray(opts.only) && opts.only.length ? opts.only.map(String) : null
const maxRequirements = Number(opts.maxRequirements) > 0 ? Number(opts.maxRequirements) : 20

const slug = opts.slug || String(prdPath)
  .replace(/\/index\.md$/, '')
  .replace(/\.md$/, '')
  .split('/')
  .filter(Boolean)
  .pop()
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase() || 'tests'

const outDir = opts.outDir || `docs/tests/${slug}`

// --- Phase 1: Inventory (single agent - produces the worklist) ---
phase('Inventory')
const inventory = await agent(
  `PRD location: ${prdPath}\n\n` +
  `List every functional requirement in this PRD. It may be one file, or an index.md whose requirement table ` +
  `links some requirements out to their own fr-N.md files - read all of them.`,
  { agentType: 'test-plan-inventory', schema: INVENTORY_SCHEMA, model: 'sonnet', effort: 'low' }
)
if (!inventory) throw new Error('Inventory phase returned nothing - the test-plan-inventory agent failed. Nothing downstream can run without the requirement list.')

let requirements = inventory.requirements
if (!requirements.length) {
  throw new Error(
    `No functional requirements found in "${prdPath}". This workflow writes tests against a specification and will not ` +
    `invent requirements. Check that the PRD has a functional requirements section, or point it at the right path.`
  )
}
log(`${requirements.length} requirement(s) across ${inventory.sourceFiles.length} file(s)`)
if (inventory.missingSplitFiles && inventory.missingSplitFiles.length) {
  log(`Warning: the index links to split files that do not exist for ${inventory.missingSplitFiles.join(', ')} - those were read from their index stub only`)
}

if (only) {
  const before = requirements.length
  requirements = requirements.filter(r => only.includes(String(r.id)))
  log(`Filtered to the ${requirements.length} requirement(s) named in "only" (from ${before})`)
  if (!requirements.length) throw new Error(`The "only" filter matched no requirements. Available ids: ${inventory.requirements.map(r => r.id).join(', ')}`)
}

// Cap the fan-out loudly. One agent per requirement is the point of this workflow, but a 60-requirement
// PRD should not silently become 60 agents - and a cap that truncates quietly reads as "everything was
// covered" when it was not. Drop from the end of the list and name every requirement dropped.
let skipped = []
if (requirements.length > maxRequirements) {
  skipped = requirements.slice(maxRequirements)
  requirements = requirements.slice(0, maxRequirements)
  log(`Requirement cap of ${maxRequirements} reached. NOT writing plans for ${skipped.length}: ${skipped.map(r => r.id).join(', ')}`)
  log(`Re-run with a higher maxRequirements, or with only: [...] naming those ids, to cover them.`)
}

// Built once and shared by every writer. Prompt-cache ordering matters here: the large shared
// payload goes first and the small per-requirement token last, so all N calls in the fan-out
// share one cache prefix instead of missing on every call.
const sharedContext =
  `<product>\n${inventory.productName}\n</product>\n\n` +
  (blueprintPath
    ? `<technical_blueprint>\n${blueprintPath}\n</technical_blueprint>\n` +
      `Read it for two things only: the Testing Seams section (what is fakeable, what needs real infrastructure) ` +
      `to fill in each scenario's run note, and any "What Will Bite" entry touching your requirement. ` +
      `Do not let its technology choices leak into what the scenarios assert.\n\n`
    : `<technical_blueprint>\nNone supplied.\n</technical_blueprint>\n` +
      `Mark every scenario's run note as "Unknown - no technical blueprint supplied" rather than inventing a stack.\n\n`) +
  (inventory.nfrSummary
    ? `<non_functional_requirements>\n${inventory.nfrSummary}\n</non_functional_requirements>\n` +
      `Pull in only the bars that actually touch your requirement. Do not restate this section.\n\n`
    : '') +
  `<date>\n${date}\n</date>\n\n`

// --- Phase 2: Write (the fan-out this workflow exists for) ---
// One agent per requirement, all launched at once. No critique loop and no barrier between
// requirements: each plan is independent by construction (a writer that reached into another
// requirement would be duplicating coverage, which its instructions forbid), so there is nothing
// for a later stage to reconcile and nothing worth making requirement B wait on requirement A for.
phase('Write')
log(`Writing ${requirements.length} plan(s) in parallel into ${outDir}/`)
const plans = (await parallel(requirements.map(r => () =>
  agent(
    sharedContext +
    `<requirement>\n` +
    `id: ${r.id}\n` +
    `title: ${r.title}\n` +
    `priority: ${r.priority || 'not stated'}\n` +
    `summary: ${r.summary}\n` +
    `source: ${r.sourceFile}\n` +
    `</requirement>\n\n` +
    `<output_path>\n${outDir}/${String(r.id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md\n</output_path>\n\n` +
    `Write the complete natural-language test plan for this one requirement. Open its source file - the summary ` +
    `above is orientation, not the requirement. Prose and tables only, no test code in any language.`,
    { agentType: 'test-plan-writer', label: `plan:${r.id}`, phase: 'Write', schema: PLAN_SCHEMA, model: 'sonnet' }
  )
))).filter(Boolean)

const failed = requirements.filter(r => !plans.some(p => p.requirementId === r.id))
log(`Wrote ${plans.length}/${requirements.length} plan(s), ${plans.reduce((n, p) => n + (p.scenarioCount || 0), 0)} scenario(s) total`)
if (failed.length) {
  log(`${failed.length} writer lane(s) returned nothing - no plan exists for: ${failed.map(r => r.id).join(', ')}`)
}
if (!plans.length) {
  throw new Error('Every writer lane failed - no plans were written, so there is nothing to link. Check the Write phase transcripts.')
}

// A writer can return a status for a file it did not actually write. The plan paths are the one
// thing the Link phase depends on, so carry the writers' own reported paths forward and let the
// linker verify each one resolves rather than trusting the status here.
const openQuestionCount = plans.reduce((n, p) => n + ((p.openQuestions || []).length), 0)
if (openQuestionCount) log(`${openQuestionCount} open question(s) recorded across the plans - these are ambiguities someone would otherwise resolve silently while coding`)

// --- Phase 3: Link (single agent - makes the plans discoverable) ---
// Deliberately one agent rather than one per requirement: these are edits to a small number of
// shared files (index.md especially), and N agents editing one file concurrently is a corruption
// bug waiting to happen, not a speedup.
phase('Link')
const linkTable = plans.map(p => {
  const r = requirements.find(x => x.id === p.requirementId) || {}
  return {
    requirementId: p.requirementId,
    title: r.title || '',
    priority: r.priority || '',
    livesIn: r.sourceFile || '',
    planPath: p.path,
    scenarioCount: p.scenarioCount,
    p0Count: p.p0Count,
    openQuestions: p.openQuestions || [],
  }
})

const linked = await agent(
  `<plans>\n${JSON.stringify(linkTable, null, 2)}\n</plans>\n\n` +
  `<not_covered>\n${JSON.stringify([
    ...skipped.map(r => ({ requirementId: r.id, reason: 'Run hit its requirement cap' })),
    ...failed.map(r => ({ requirementId: r.id, reason: 'The writer agent failed to return a result, so no plan file exists' })),
  ], null, 2)}\n</not_covered>\n\n` +
  `<product>\n${inventory.productName}\n</product>\n` +
  `<prd>\n${prdPath}\n</prd>\n` +
  `<technical_blueprint>\n${blueprintPath || 'Not supplied'}\n</technical_blueprint>\n` +
  `<index_path>\n${outDir}/index.md\n</index_path>\n` +
  `<date>\n${date}\n</date>\n\n` +
  `Write the index first, then inject a Tests link into each requirement in the file named by its "livesIn". ` +
  `This workflow gets re-run, so every edit must be safe to make twice: update an existing Tests link in place ` +
  `rather than adding a second one. Verify each link resolves before reporting it.`,
  { agentType: 'test-plan-linker', schema: LINK_SCHEMA, model: 'sonnet' }
)
if (!linked) {
  log('Link phase failed - the plan files are all on disk and listed in this result, but nothing points at them from the PRD and no index was written')
} else {
  log(`Linked ${linked.linksVerified} verified (${linked.linksAdded} added, ${linked.linksUpdated || 0} updated); index at ${linked.indexPath}`)
  if (linked.unlinked && linked.unlinked.length) {
    for (const u of linked.unlinked) log(`  not linked - ${u.requirementId}: ${u.reason}`)
  }
  if (linked.notes) log(`  linker notes: ${linked.notes}`)
}

return {
  productName: inventory.productName,
  outDir,
  index: linked ? linked.indexPath : null,
  requirementsFound: inventory.requirements.length,
  plansWritten: plans.length,
  scenariosTotal: plans.reduce((n, p) => n + (p.scenarioCount || 0), 0),
  p0Total: plans.reduce((n, p) => n + (p.p0Count || 0), 0),
  plans: plans.map(p => ({ id: p.requirementId, path: p.path, scenarios: p.scenarioCount, openQuestions: (p.openQuestions || []).length })),
  openQuestions: plans.flatMap(p => (p.openQuestions || []).map(q => `[${p.requirementId}] ${q}`)).slice(0, 20),
  openQuestionsTotal: openQuestionCount,
  linksVerified: linked ? linked.linksVerified : 0,
  unlinked: linked ? (linked.unlinked || []) : [],
  notCovered: [...skipped.map(r => r.id), ...failed.map(r => r.id)],
}

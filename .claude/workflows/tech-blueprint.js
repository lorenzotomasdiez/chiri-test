export const meta = {
  name: 'tech-blueprint',
  description: 'Turn a PRD into one right-sized technical blueprint: frame the deployment tier, design the stack, empirically probe the open questions that a script can settle, then write and adversarially review a single document',
  phases: [
    { title: 'Frame', detail: 'read the PRD and fix the deployment tier - the budget everything downstream spends against (sonnet)' },
    { title: 'Design', detail: 'choose the stack and infrastructure sized to that tier, and emit classified open questions (opus: the judgment that shapes the build)' },
    { title: 'Probe', detail: 'one sandboxed agent per empirical open question - actually installs, runs, and measures rather than reasoning (sonnet)' },
    { title: 'Reconcile', detail: 'fold probe evidence back into the decisions, only when a probe actually contradicted one (opus)' },
    { title: 'Author', detail: 'write the single blueprint document to disk (opus)' },
    { title: 'Critique', detail: 'three parallel adversarial lenses: right-sizing, testability, risk-honesty (opus)' },
    { title: 'Revise', detail: 'address every flagged issue in place, loop back into Critique, capped at 2 rounds (opus)' },
  ],
}

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    prdFound: { type: 'boolean', description: 'False when the PRD path did not resolve or held no readable specification. Report false rather than inventing a product.' },
    productName: { type: 'string' },
    sourceFiles: { type: 'array', items: { type: 'string' }, description: 'Every file actually read, repo-relative' },
    problem: { type: 'string', description: 'One paragraph, readable by someone who has not read the PRD' },
    tier: {
      type: 'string',
      enum: ['throwaway', 'local', 'internal', 'production'],
      description: 'The deployment tier. This is the budget every downstream phase spends against, so it is the highest-stakes field in the brief.',
    },
    tierEvidence: { type: 'string', description: 'The PRD text that decided the tier, quoted or closely paraphrased. Not a restatement of the tier.' },
    tierConflict: { type: 'string', description: 'Empty when signals agreed. Otherwise which signals disagreed, how it was resolved, and what would flip the tier.' },
    forces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          force: { type: 'string', description: 'A requirement that actually constrains the technology' },
          eliminates: { type: 'string', description: 'What category of design this rules out. A force that eliminates nothing is a requirement, not a force.' },
        },
        required: ['force', 'eliminates'],
      },
    },
    constraints: { type: 'array', items: { type: 'string' }, description: 'Given, not chosen: existing systems, locked platforms, budget, deadline, compliance' },
    existingLandscape: { type: 'string', description: 'What already exists in this repo and what its stack is. The only field where naming technology is correct.' },
    unknowns: { type: 'array', items: { type: 'string' }, description: 'What the PRD leaves undetermined that the design will have to resolve or assume' },
  },
  required: ['prdFound', 'productName', 'problem', 'tier', 'tierEvidence', 'forces'],
}

const DESIGN_SCHEMA = {
  type: 'object',
  properties: {
    systemShape: { type: 'string' },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          choice: { type: 'string' },
          version: { type: 'string' },
          requirementThatFailsWithoutIt: { type: 'string' },
          alternative: { type: 'string' },
          whyNot: { type: 'string' },
          reversibility: { type: 'string', enum: ['trivial', 'costly', 'permanent'] },
        },
        required: ['area', 'choice', 'requirementThatFailsWithoutIt', 'alternative', 'whyNot', 'reversibility'],
      },
    },
    testingSeams: {
      type: 'object',
      properties: {
        pureCore: { type: 'string' },
        seams: { type: 'array', items: { type: 'string' } },
        firstFailingTest: { type: 'string' },
        needsRealInfrastructure: { type: 'string' },
        notWorthTesting: { type: 'string' },
      },
      required: ['pureCore', 'seams', 'firstFailingTest'],
    },
    shortcutsTaken: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          shortcut: { type: 'string' },
          costs: { type: 'string' },
          wouldForceUpgrade: { type: 'string' },
        },
        required: ['shortcut', 'costs', 'wouldForceUpgrade'],
      },
    },
    whatWillBite: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          what: { type: 'string' },
          symptom: { type: 'string' },
          earliestCatch: { type: 'string' },
          mitigation: { type: 'string' },
        },
        required: ['what', 'symptom', 'earliestCatch'],
      },
    },
    openQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          kind: { type: 'string', enum: ['empirical', 'human'] },
          probeHypothesis: { type: 'string' },
          designConsequence: { type: 'string' },
          whoCanAnswer: { type: 'string' },
        },
        required: ['question', 'kind', 'designConsequence'],
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    gettingStarted: { type: 'array', items: { type: 'string' } },
  },
  required: ['systemShape', 'decisions', 'testingSeams', 'whatWillBite', 'openQuestions'],
}

const PROBE_SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string' },
    verdict: {
      type: 'string',
      enum: ['confirmed', 'refuted', 'partial', 'inconclusive'],
      description: 'confirmed and refuted both require command output in evidence. inconclusive requires a blocker. Never pick a verdict the evidence does not support.',
    },
    answer: { type: 'string', description: 'The plain-language answer to the question that was asked' },
    whatIRan: { type: 'string', description: 'The experiment, described so someone could repeat it' },
    evidence: { type: 'string', description: 'Real command output, truncated in the middle if long. Not a paraphrase, not documentation, not a citation.' },
    versions: { type: 'string', description: 'Exact versions of everything involved. A verdict without versions expires silently.' },
    blocker: { type: 'string', description: 'Inconclusive only: exactly what stopped this, and what a human would do to unblock it' },
    incidentalFindings: { type: 'array', items: { type: 'string' }, description: 'Things learned along the way that the designer would want. Often more valuable than the answer.' },
    scratchDir: { type: 'string', description: 'Where the probe artifacts were left, so a human can inspect or delete them' },
  },
  required: ['question', 'verdict', 'answer'],
}

const RECONCILE_SCHEMA = {
  type: 'object',
  properties: {
    changed: { type: 'boolean', description: 'False when no probe contradicted any decision and the design stands as written' },
    revisedDecisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          choice: { type: 'string' },
          version: { type: 'string' },
          requirementThatFailsWithoutIt: { type: 'string' },
          alternative: { type: 'string' },
          whyNot: { type: 'string' },
          reversibility: {
            type: 'string',
            enum: ['trivial', 'costly', 'permanent'],
            description: 'Same calibration as the original design: trivial is an afternoon and stays local, costly is roughly a sprint across several modules, permanent means you would rewrite instead. A probe that revealed hidden coupling is a reason to rate something WORSE than you first did.',
          },
        },
        required: ['area', 'choice', 'requirementThatFailsWithoutIt', 'alternative', 'whyNot', 'reversibility'],
      },
      description: 'The complete decision set after applying probe evidence, not just the ones that changed',
    },
    changeLog: { type: 'array', items: { type: 'string' }, description: 'One line per change, each naming the probe that forced it' },
    newRisks: { type: 'array', items: { type: 'string' }, description: 'Anything the probes surfaced that belongs in "what will bite"' },
    stillOpen: { type: 'array', items: { type: 'string' }, description: 'Questions the probes failed to settle, which now need a human' },
  },
  required: ['changed', 'revisedDecisions', 'changeLog'],
}

const AUTHOR_SCHEMA = {
  type: 'object',
  properties: {
    indexPath: { type: 'string' },
    filesWritten: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          charCount: { type: 'number', description: 'Measured by reading the file back from disk after writing it. Never self-estimated.' },
        },
        required: ['path', 'charCount'],
      },
    },
    totalCharCount: { type: 'number' },
    splits: { type: 'array', items: { type: 'string' }, description: 'Each split file and the policy trigger that justified it. Empty is the normal, healthy case.' },
    notes: { type: 'string', description: 'On a revision: what changed. On a draft: anything the verification checks surfaced.' },
  },
  required: ['indexPath', 'filesWritten', 'totalCharCount'],
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    lens: { type: 'string' },
    verdict: {
      type: 'string',
      enum: ['ready', 'needs_revision'],
      description: 'needs_revision if ANY item on this lens\'s checklist fails, however small - you do not weigh importance, the orchestrator decides what happens next. ready only when the whole checklist passes. A clean pass is a real and expected outcome; do not invent findings to avoid one.',
    },
    issues: { type: 'array', items: { type: 'string' }, description: 'Each one cites a specific line or section, says what is wrong, and says what would fix it' },
  },
  required: ['lens', 'verdict', 'issues'],
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
    'or an object shaped { "prdPath": "docs/prd/thing", "outDir": "docs/tech/thing", "date": "YYYY-MM-DD", ' +
    '"notes": "focus on the ingestion path", "tier": "internal", "maxProbes": 4, "probeDir": ".tech-blueprint-probes/thing" }.'
  )
}

const opts = (input && typeof input === 'object') ? input : {}
const notes = opts.notes || ''
const date = opts.date || 'unknown - fill in before this leaves Draft'
const tierOverride = opts.tier || null
const maxProbes = Number(opts.maxProbes) > 0 ? Number(opts.maxProbes) : 4
const MAX_ROUNDS = 2
const SIZE_CEILING = 20000

const slug = opts.slug || String(prdPath)
  .replace(/\.md$/, '')
  .split('/')
  .filter(Boolean)
  .pop()
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase() || 'blueprint'

const outDir = opts.outDir || `docs/tech/${slug}`
const probeDir = opts.probeDir || `.tech-blueprint-probes/${slug}`

// --- Phase 1: Frame (single agent - fixes the tier everything downstream spends against) ---
phase('Frame')
const brief = await agent(
  `PRD location: ${prdPath}\n` +
  (notes ? `The human added this focus note: ${notes}\n` : '') +
  (tierOverride ? `The human explicitly set the deployment tier to "${tierOverride}". Use it, and record in tierEvidence that it was given rather than inferred - but if the PRD's data-sensitivity signal demands a higher tier, say so in tierConflict rather than silently overriding them.\n` : '') +
  `\nRead this PRD and turn it into a technical brief. The deployment tier is the field that matters most.`,
  { agentType: 'tech-framer', schema: BRIEF_SCHEMA, model: 'sonnet' }
)
if (!brief) throw new Error('Frame phase returned nothing - the tech-framer agent failed. Nothing downstream can run without the brief.')
if (!brief.prdFound) {
  throw new Error(
    `No readable PRD at "${prdPath}". This workflow designs against a specification and deliberately will not invent one. ` +
    `Point it at a PRD file or folder (for example one produced by /product-blueprint).`
  )
}
log(`Tier: ${brief.tier} - ${brief.tierEvidence}`)
if (brief.tierConflict) log(`Tier conflict: ${brief.tierConflict}`)
log(`${brief.forces.length} technical force(s) from ${(brief.sourceFiles || []).length} source file(s)`)

// Everything downstream needs the same framing, so build it once rather than
// re-serializing the whole brief into every prompt.
const briefContext =
  `<brief>\n${JSON.stringify(brief, null, 2)}\n</brief>\n\n` +
  `<tier_budget>\n` +
  `The deployment tier is ${brief.tier}. This is a budget, not a label. ` +
  `Nothing may appear in this design that the tier does not pay for, and below production tier the shortcuts must be named out loud.\n` +
  `</tier_budget>\n`

// --- Phase 2: Design (single agent - the judgment that shapes the whole build) ---
phase('Design')
const design = await agent(
  briefContext +
  (notes ? `<focus_note>\n${notes}\n</focus_note>\n\n` : '') +
  `Design the stack and infrastructure for this brief, sized to the tier.\n\n` +
  `How to fill each field:\n` +
  `- systemShape: the runnable pieces and how they talk, described without naming technology.\n` +
  `- decisions[].version: a concrete version or range; empty only when genuinely not version-sensitive.\n` +
  `- decisions[].requirementThatFailsWithoutIt: the requirement from the brief that fails if this is removed - not a general virtue like maintainability.\n` +
  `- decisions[].alternative and whyNot: the one runner-up seriously considered, and the single real reason it lost.\n` +
  `- decisions[].reversibility: trivial means an afternoon and the change stays local; costly means roughly a sprint across several modules but the product survives it; ` +
  `permanent means you would rewrite rather than change it - a language, a persistence boundary, an async model. ` +
  `Rate honestly: an optimistic rating here is how a permanent decision gets made casually.\n` +
  `- testingSeams.pureCore: what logic is testable with nothing running, and where it lives. ` +
  `seams: one entry per external dependency, naming specifically how it is faked or controlled in a test. ` +
  `firstFailingTest: the concrete first test someone writes on day one, specific enough to open an editor and type. ` +
  `needsRealInfrastructure: the one or two tests that genuinely cannot be faked, and what they need running. ` +
  `notWorthTesting: what is deliberately not tested at this tier and why - at low tiers this may be most of it.\n` +
  `- shortcutsTaken: required below production tier. What the tier lets the design skip, what it costs, and the condition that would make this design void.\n` +
  `- whatWillBite: two to five build-specific failures, each with the symptom a developer actually sees and the earliest moment it becomes detectable. ` +
  `Nothing that would be equally true of an unrelated project.\n` +
  `- openQuestions: phrase each so a yes or no is possible - a topic is not a question - and say in designConsequence what changes if the answer goes each way. ` +
  `A question that changes nothing is not worth asking. Give a probeHypothesis for empirical ones so the probe has something to refute, and whoCanAnswer for human ones.\n` +
  `- gettingStarted: the concrete first steps, in order, ending at what "it works" looks like for the first slice.\n\n` +
  `Be aggressive about classifying open questions as empirical: empirical means a script could settle it in under fifteen minutes, ` +
  `human means it needs access, budget, a credential, or a preference. An agent downstream will actually go and run the empirical ones, ` +
  `so "we should verify X" is a wasted line where a probeable question would have produced a fact.`,
  { agentType: 'tech-designer', schema: DESIGN_SCHEMA, model: 'opus' }
)
if (!design) throw new Error('Design phase returned nothing - the tech-designer agent failed.')
log(`${design.decisions.length} decision(s); ${design.decisions.filter(d => d.reversibility === 'permanent').length} rated permanent`)

// --- Phase 3: Probe (fan-out, one sandboxed agent per empirical question) ---
// This is the phase that separates this workflow from a plausible guess: every question
// a script can settle gets settled by actually running something, before anyone commits
// weeks to a design built on an assumption.
phase('Probe')
const allQuestions = design.openQuestions || []
let empirical = allQuestions.filter(q => q.kind === 'empirical')
const humanQuestions = allQuestions.filter(q => q.kind !== 'empirical')

// Cap the fan-out loudly. Each probe installs packages and runs commands, so an
// over-eager designer must not turn one run into twenty sandboxes. Name every question
// dropped: a silent cap reads as "everything was checked" when it was not.
let droppedProbes = []
if (empirical.length > maxProbes) {
  droppedProbes = empirical.slice(maxProbes)
  empirical = empirical.slice(0, maxProbes)
  log(`Probe cap of ${maxProbes} reached. NOT probing ${droppedProbes.length} question(s): ${droppedProbes.map(q => q.question).join('; ')}`)
  log(`These are carried into the document as open questions instead. Re-run with a higher maxProbes to settle them.`)
}

let probes = []
if (empirical.length === 0) {
  log('No empirical open questions - nothing to probe. Every unknown here needs a human.')
} else {
  log(`Probing ${empirical.length} empirical question(s) in parallel, each in its own scratch directory under ${probeDir}/`)
  probes = (await parallel(empirical.map((q, i) => () =>
    agent(
      `<question>\n${q.question}\n</question>\n\n` +
      `<hypothesis>\n${q.probeHypothesis || 'None stated - establish the answer from scratch.'}\n</hypothesis>\n\n` +
      `<design_consequence>\n${q.designConsequence}\n</design_consequence>\n\n` +
      `<scratch_directory>\n${probeDir}/probe-${i + 1}\n</scratch_directory>\n\n` +
      `<context>\nThis is for a ${brief.tier}-tier build: ${brief.problem}\n</context>\n\n` +
      `Settle this one question by actually building and running the smallest thing that answers it. ` +
      `Work only inside the scratch directory above. Your verdict must be backed by command output you actually saw - ` +
      `if you did not run anything, the verdict is inconclusive, and that is a perfectly acceptable answer.`,
      { agentType: 'stack-prober', label: `probe:${i + 1}`, phase: 'Probe', schema: PROBE_SCHEMA, model: 'sonnet' }
    )
  ))).filter(Boolean)

  if (probes.length < empirical.length) {
    log(`${empirical.length - probes.length} probe lane(s) died outright and returned nothing - those questions stay unsettled`)
  }
  for (const p of probes) log(`  ${p.verdict}: ${p.question}`)
  const refuted = probes.filter(p => p.verdict === 'refuted')
  if (refuted.length) log(`${refuted.length} probe(s) refuted the design's assumption - those decisions must change`)
}

// Questions the probes could not settle become human questions. A probe lane that died
// leaves its question in neither list, so recover it from the empirical set by matching
// on the question text rather than trusting the returned array's shape.
const probedQuestions = new Set(probes.map(p => p.question))
const unprobed = empirical.filter(q => !probedQuestions.has(q.question))
const carriedToHumans = [
  ...humanQuestions,
  ...droppedProbes.map(q => ({ ...q, whoCanAnswer: 'Not probed - the run hit its probe cap' })),
  ...unprobed.map(q => ({ ...q, whoCanAnswer: 'Not probed - the probe agent failed to return a result' })),
  ...probes.filter(p => p.verdict === 'inconclusive').map(p => ({
    question: p.question,
    kind: 'human',
    designConsequence: p.answer,
    whoCanAnswer: p.blocker || 'The probe could not settle this',
  })),
]

// --- Phase 4: Reconcile (only when a probe actually contradicted something) ---
// Skipped entirely when nothing was refuted: re-running the designer to confirm its own
// work is a paid agent call that produces a rewrite of what already exists.
phase('Reconcile')
const needsReconcile = probes.some(p => p.verdict === 'refuted' || p.verdict === 'partial')
let decisions = design.decisions
let reconcile = null
if (!needsReconcile) {
  log(probes.length
    ? 'No probe refuted a decision - the design stands as written, skipping Reconcile'
    : 'Nothing was probed - skipping Reconcile')
} else {
  reconcile = await agent(
    briefContext +
    `<your_design>\n${JSON.stringify({ systemShape: design.systemShape, decisions: design.decisions }, null, 2)}\n</your_design>\n\n` +
    `<probe_results>\n${JSON.stringify(probes, null, 2)}\n</probe_results>\n\n` +
    `Probes were run against your open questions and some refuted or qualified what you believed. ` +
    `Probe results are ground truth and outrank your prior belief. Revise the affected decisions rather than defending them, ` +
    `and return the COMPLETE decision set afterwards - not only the ones that changed.`,
    { agentType: 'tech-designer', schema: RECONCILE_SCHEMA, model: 'opus' }
  )
  if (!reconcile) {
    log('Reconcile phase failed - carrying the original decisions forward. The author still receives the raw probe results and will apply them itself.')
  } else if (reconcile.changed) {
    decisions = reconcile.revisedDecisions
    for (const c of reconcile.changeLog) log(`  changed: ${c}`)
  } else {
    log('Designer reviewed the probe evidence and kept every decision as written')
  }
}

// --- Phase 5: Author (single agent - the only thing that writes the document) ---
phase('Author')
const authorContext =
  briefContext +
  `<design>\n${JSON.stringify({
    systemShape: design.systemShape,
    decisions,
    testingSeams: design.testingSeams,
    shortcutsTaken: design.shortcutsTaken || [],
    whatWillBite: [...(design.whatWillBite || []), ...((reconcile && reconcile.newRisks) || []).map(r => ({ what: r, symptom: 'Surfaced by a probe - see the verified findings', earliestCatch: 'Now' }))],
    assumptions: design.assumptions || [],
    gettingStarted: design.gettingStarted || [],
  }, null, 2)}\n</design>\n\n` +
  `<probe_results>\n${JSON.stringify(probes, null, 2)}\n</probe_results>\n\n` +
  `<open_questions_for_humans>\n${JSON.stringify(carriedToHumans, null, 2)}\n</open_questions_for_humans>\n\n` +
  `<output>\nWrite to: ${outDir}/index.md\nAny split files go beside it in ${outDir}/\nPRD to link back to: ${prdPath}\nDate for "Last updated": ${date}\n</output>\n`

let authored = await agent(
  authorContext +
  `\nWrite the technical blueprint. Check every decision against the probe results before you write a word: ` +
  `where a probe refuted an assumption, write the corrected design rather than the original. ` +
  `Measure your file sizes by reading them back from disk, never by estimating.`,
  { agentType: 'tech-doc-author', schema: AUTHOR_SCHEMA, model: 'opus' }
)
if (!authored) throw new Error('Author phase returned nothing - the tech-doc-author agent failed. No document was written.')
log(`Wrote ${authored.filesWritten.length} file(s), ${authored.totalCharCount} chars total`)
if (authored.totalCharCount > SIZE_CEILING) {
  log(`Over the ${SIZE_CEILING}-char ceiling. The author's split policy should have fired - the critique round will see the same document and can flag padding.`)
}

// --- Phase 6/7: Critique -> Revise loop (parallel lenses, capped rounds) ---
// Critics read the document from disk by path rather than receiving it inline: the draft
// is already written, and passing it through three prompts plus a reviser is the same
// document paid for five times.
const LENSES = ['right-sizing', 'testability', 'risk-honesty']
let round = 0
let lastCritiques = []

while (round < MAX_ROUNDS) {
  phase('Critique')
  const critiques = (await parallel(LENSES.map(lens => () =>
    agent(
      `<document_path>\n${authored.indexPath}\n</document_path>\n\n` +
      `<brief_summary>\nProduct: ${brief.productName}\nTier: ${brief.tier} (${brief.tierEvidence})\nProblem: ${brief.problem}\n</brief_summary>\n\n` +
      `<probe_results>\n${JSON.stringify(probes, null, 2)}\n</probe_results>\n\n` +
      `Read the document at the path above, in full, including any files it links to. ` +
      `Review it through the "${lens}" lens only, against that lens's checklist in your instructions. ` +
      `Judge it against the ${brief.tier} tier, not against a tier it was never meant to serve. ` +
      `Work every checklist item including the small ones - the verdict rule, not your sense of importance, decides what happens next.`,
      { agentType: 'tech-critic', label: `critique:${lens}`, phase: 'Critique', schema: CRITIQUE_SCHEMA, model: 'opus' }
    )
  ))).filter(Boolean)
  lastCritiques = critiques

  if (critiques.length < LENSES.length) {
    log(`${LENSES.length - critiques.length} critique lens(es) failed to return - reviewing against the ${critiques.length} that did`)
  }

  const needsWork = critiques.filter(c => c.verdict === 'needs_revision')
  if (critiques.length && needsWork.length === 0) {
    log('All lenses signed off - the blueprint is ready')
    break
  }
  if (!critiques.length) {
    log('Every critique lens failed - returning the unreviewed draft, and saying so rather than implying it passed')
    break
  }

  round++
  if (round >= MAX_ROUNDS) {
    log(`Round cap (${MAX_ROUNDS}) reached with ${needsWork.length}/${critiques.length} lens(es) still flagging issues - returning the best draft with those issues listed`)
    break
  }

  phase('Revise')
  log(`Revising: ${needsWork.length}/${critiques.length} lens(es) flagged ${needsWork.reduce((n, c) => n + c.issues.length, 0)} issue(s) (round ${round})`)
  const revised = await agent(
    authorContext +
    `<critique>\n${JSON.stringify(needsWork, null, 2)}\n</critique>\n\n` +
    `The document at ${authored.indexPath} was reviewed and flagged. Read it from disk, address every issue above, ` +
    `and change nothing that was not flagged. You may change design decisions where a critique requires it - you are the ` +
    `last agent with judgment here. Revision is not expansion: the document was ${authored.totalCharCount} chars, and if a ` +
    `fix adds a paragraph, find the paragraph it makes redundant.`,
    { agentType: 'tech-doc-author', schema: AUTHOR_SCHEMA, model: 'opus' }
  )
  if (!revised) {
    log('Revise phase failed - keeping the previous draft on disk and returning its outstanding issues unfixed')
    break
  }
  authored = revised
  log(`Revised: ${authored.totalCharCount} chars${authored.notes ? ` - ${authored.notes}` : ''}`)
}

const openIssues = lastCritiques.filter(c => c.verdict === 'needs_revision').flatMap(c => c.issues.map(i => `[${c.lens}] ${i}`))

return {
  productName: brief.productName,
  tier: brief.tier,
  tierEvidence: brief.tierEvidence,
  document: authored.indexPath,
  filesWritten: authored.filesWritten,
  totalCharCount: authored.totalCharCount,
  splits: authored.splits || [],
  decisionCount: decisions.length,
  permanentDecisions: decisions.filter(d => d.reversibility === 'permanent').map(d => `${d.area}: ${d.choice}`),
  probes: probes.map(p => ({ question: p.question, verdict: p.verdict, answer: p.answer, scratchDir: p.scratchDir })),
  probesRefuted: probes.filter(p => p.verdict === 'refuted').length,
  probesSkipped: droppedProbes.length + unprobed.length,
  probeDir: probes.length ? probeDir : null,
  openQuestionsForHumans: carriedToHumans.length,
  reviewRounds: round + 1,
  openIssuesTotal: openIssues.length,
  openIssues: openIssues.slice(0, 15),
}

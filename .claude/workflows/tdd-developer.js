export const meta = {
  name: 'tdd-developer',
  description: 'Take one tagged feature or requirement through a real red-green cycle: write every test first in parallel, implement, adjudicate whatever still fails, and prove it in a browser with screenshots',
  phases: [
    { title: 'Frame', detail: 'resolve the tag into a concrete test list and learn how this repo runs tests (opus: the only expensive thinking in the run)' },
    { title: 'Red', detail: 'one agent per test, all at once, each writing one failing test file (haiku: speed is the point)' },
    { title: 'Verify red', detail: 'real exit codes - confirm the tests exist and are genuinely failing (haiku)' },
    { title: 'Green', detail: 'implement until the tests pass (sonnet, one agent: the source tree cannot take concurrent editors)' },
    { title: 'Adjudicate', detail: 'for anything still failing, an independent agent rules test-wrong or implementation-wrong, then the owner fixes it (sonnet, one retry only)' },
    { title: 'Browser', detail: 'opus writes the one end-to-end journey, a runner drives a real browser and screenshots every step as proof' },
    { title: 'Report', detail: 'text report returned, saved nowhere (sonnet)' },
  ],
}

const FRAME_SCHEMA = {
  type: 'object',
  properties: {
    resolved: { type: 'boolean', description: 'False when the tag could not be turned into anything buildable' },
    featureName: { type: 'string' },
    sourceOfTruth: { type: 'string', description: 'The test plan or requirement file used, or "derived from the tag - no written spec"' },
    testCommand: { type: 'string', description: 'The exact command that runs the suite, verified by running it' },
    singleFileTestCommand: { type: 'string', description: 'Command template for running one file, with {file} as the placeholder. Empty if the framework cannot target a file.' },
    exampleTestFile: { type: 'string', description: 'A real existing test file the writers should copy conventions from' },
    suiteGreenBefore: { type: 'boolean', description: 'Whether the suite passed BEFORE this run started. False means red-green signal is already polluted.' },
    hasUi: { type: 'boolean' },
    appUrl: { type: 'string', description: 'Where the app serves, if it does' },
    appStartCommand: { type: 'string' },
    tests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Scenario ID, preserved byte-identically if one already exists' },
          name: { type: 'string' },
          behavior: { type: 'string', description: 'Given/When/Then with concrete data' },
          filePath: { type: 'string', description: 'Unique per test - no two tests share a file' },
          targets: { type: 'string' },
          priority: { type: 'string', enum: ['P0', 'P1'], description: 'P0: the feature is meaningless without it. P1: worth having but the feature stands without it. Dropped tail-first if the run is capped.' },
        },
        required: ['id', 'name', 'behavior', 'filePath', 'targets'],
      },
    },
    implementationBrief: { type: 'string', description: 'What to build, which files, which patterns to follow, what to reuse' },
    assumptions: { type: 'array', items: { type: 'string' } },
    blockers: { type: 'array', items: { type: 'string' }, description: 'Anything that stops this run: no test framework, unreadable tag' },
  },
  required: ['resolved', 'featureName', 'testCommand', 'tests'],
}

const WRITE_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    path: { type: 'string' },
    written: { type: 'boolean', description: 'True only if the file is actually on disk' },
    asserts: { type: 'string', description: 'One line on what it asserts' },
    problem: { type: 'string' },
  },
  required: ['id', 'written'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    exitCode: { type: 'number', description: 'The real exit code from the real command' },
    status: {
      type: 'string',
      enum: ['pass', 'fail', 'error'],
      description: 'pass: everything ran and passed. fail: ran, some assertions failed - the code is wrong. error: the suite could not run at all (missing binary, broken config, syntax error) - nobody learned anything.',
    },
    passed: { type: 'array', items: { type: 'string' }, description: 'Scenario IDs' },
    failed: { type: 'array', items: { type: 'string' } },
    errored: { type: 'array', items: { type: 'string' } },
    notRun: { type: 'array', items: { type: 'string' } },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          message: { type: 'string', description: 'The real error text, not a paraphrase' },
        },
        required: ['id', 'message'],
      },
    },
    suspectHollow: { type: 'array', items: { type: 'string' }, description: 'Red phase only: tests that PASSED before any implementation existed, so they probably assert nothing' },
    command: { type: 'string' },
  },
  required: ['exitCode', 'status', 'passed', 'failed'],
}

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    filesCreated: { type: 'array', items: { type: 'string' } },
    filesModified: { type: 'array', items: { type: 'string' } },
    believedPassing: { type: 'array', items: { type: 'string' }, description: 'Self-reported and NOT trusted - the verifier decides' },
    testFilesTouched: { type: 'array', items: { type: 'string' }, description: 'Must be empty. Anything here is a contract violation worth surfacing.' },
    notes: { type: 'string', description: 'Anything suspicious about a test, flagged rather than acted on' },
    blocker: { type: 'string' },
  },
  required: ['filesCreated', 'filesModified'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    verdict: {
      type: 'string',
      enum: ['test_wrong', 'implementation_wrong', 'both_wrong', 'environment'],
      description: 'test_wrong: code matches the requirement, the test does not. implementation_wrong: the test matches the requirement, the code does not - the default when evidence is balanced. both_wrong: neither matches, usually an ambiguous requirement. environment: tooling, config, or a flake, neither side at fault.',
    },
    fault: { type: 'string', description: 'The specific fault, with file and line where possible' },
    evidence: { type: 'string' },
    whatShouldChange: { type: 'string', description: 'Specific enough to act on without redoing the analysis' },
  },
  required: ['id', 'verdict', 'fault', 'whatShouldChange'],
}

const JOURNEY_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    startUrl: { type: 'string' },
    preconditions: { type: 'array', items: { type: 'string' } },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Slugged into the screenshot filename' },
          action: { type: 'string', description: 'Element named by visible text, label, or role - never a CSS selector' },
          assert: { type: 'string', description: 'Something observable on the rendered page' },
        },
        required: ['name'],
      },
    },
    expectedRisk: { type: 'string', description: 'Where the author predicts it may fail, written anyway rather than softened' },
  },
  required: ['name', 'startUrl', 'steps'],
}

const BROWSER_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['pass', 'fail', 'blocked'],
      description: 'pass: every step confirmed against the real DOM. fail: a step did not match - the feature or its wiring is broken. blocked: could not run at all (no playwright-cli, app not serving) - this is NOT evidence about the feature either way.',
    },
    stepsTotal: { type: 'number' },
    stepsPassed: { type: 'number' },
    failedAtStep: { type: 'number' },
    failureDetail: { type: 'string', description: 'Expected versus what was actually on the page' },
    consoleErrors: { type: 'array', items: { type: 'string' } },
    screenshotDir: { type: 'string' },
  },
  required: ['status', 'stepsTotal', 'stepsPassed'],
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

const tag = typeof input === 'string' ? input : input && input.tag
if (!tag) {
  throw new Error(
    'Missing the tag. Call this workflow with args set to either a plain string (the thing to build - an FR id, ' +
    'a path, or free text like "the navigation bar") or an object shaped { "tag": "FR-3", ' +
    '"testPlanDir": "docs/tests/thing", "proofDir": "docs/proof/thing", "maxTests": 8, "skipBrowser": false }.'
  )
}

const opts = (input && typeof input === 'object') ? input : {}
const testPlanDir = opts.testPlanDir || null
const maxTests = Number(opts.maxTests) > 0 ? Number(opts.maxTests) : 8
const skipBrowser = opts.skipBrowser === true
const MAX_ATTEMPTS = 2 // the initial green pass plus exactly one retry, then give up loudly

const slug = String(opts.slug || tag).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'run'
const proofDir = opts.proofDir || `docs/proof/${slug}`

// --- Phase 1: Frame (opus - everything downstream is fast and literal and does exactly what this says) ---
phase('Frame')
const frame = await agent(
  `<tag>\n${tag}\n</tag>\n\n` +
  (testPlanDir ? `<test_plan>\n${testPlanDir}\n</test_plan>\nA test plan may already exist here. If it does, it is your source of truth: transcribe its scenarios and keep its scenario IDs exactly.\n\n` : '') +
  `Resolve this tag into a concrete list of tests to write, and learn how this repo actually runs its tests.\n\n` +
  `The tag may be a requirement ID with a plan already written, a path, or free text describing something nobody wrote down. ` +
  `All three are valid. When there is no spec, derive the behavior yourself and record every judgment call as an assumption.\n\n` +
  `Run the existing test suite once to establish whether it is green before this run starts, and give every test entry ` +
  `concrete data and its own unique file path - two agents writing one file at the same time is a corruption bug.`,
  { agentType: 'tdd-dev-framer', schema: FRAME_SCHEMA, model: 'opus' }
)
if (!frame) throw new Error('Frame phase returned nothing - the tdd-dev-framer agent failed. Nothing downstream can run without the test list.')
if (!frame.resolved || !frame.tests.length) {
  throw new Error(
    `Could not turn the tag "${tag}" into anything buildable.` +
    (frame.blockers && frame.blockers.length ? ` Blockers: ${frame.blockers.join('; ')}` : '') +
    ` Try naming a requirement ID, a path to a test plan, or describing the feature in a sentence.`
  )
}
log(`Feature: ${frame.featureName} (${frame.sourceOfTruth})`)
log(`Test command: ${frame.testCommand}`)
if (frame.suiteGreenBefore === false) {
  log(`WARNING: the suite was already failing BEFORE this run. Red-green signal is polluted - failures below may have nothing to do with this feature.`)
}
if (frame.blockers && frame.blockers.length) for (const b of frame.blockers) log(`  blocker: ${b}`)

let tests = frame.tests
// Cap the fan-out loudly. Every test is an agent plus an implementation obligation, so a framer that
// emits 40 must not silently become a 40-agent run - and a silent cap reads as full coverage.
let droppedTests = []
if (tests.length > maxTests) {
  const ranked = [...tests].sort((a, b) => (a.priority === 'P0' ? 0 : 1) - (b.priority === 'P0' ? 0 : 1))
  droppedTests = ranked.slice(maxTests)
  tests = ranked.slice(0, maxTests)
  log(`Test cap of ${maxTests} reached. NOT writing ${droppedTests.length}: ${droppedTests.map(t => t.id).join(', ')}`)
  log(`Re-run with a higher maxTests to cover them.`)
}

// Guard the framer's own contract: duplicate file paths would have two haiku agents writing the same
// file concurrently. Caught here rather than discovered as mangled output.
const pathCounts = {}
for (const t of tests) pathCounts[t.filePath] = (pathCounts[t.filePath] || 0) + 1
const collisions = Object.keys(pathCounts).filter(p => pathCounts[p] > 1)
if (collisions.length) {
  throw new Error(
    `The framer assigned the same file path to more than one test: ${collisions.join(', ')}. ` +
    `Each test needs its own file because they are written concurrently. Re-run - this is a framer defect, not a repo problem.`
  )
}

// Shared by every writer. Large shared payload first, small per-test token last, so the fan-out
// shares one prompt-cache prefix instead of missing on every call (see ../PROMPT_CACHE_ORDERING.md).
const writerContext =
  `<repo_conventions>\n` +
  `Test command: ${frame.testCommand}\n` +
  `Copy the conventions in this existing test file: ${frame.exampleTestFile || 'none found - follow the language default'}\n` +
  `</repo_conventions>\n\n` +
  `<implementation_brief>\n${frame.implementationBrief || 'Not supplied.'}\n</implementation_brief>\n\n`

// --- Phase 2: Red (one haiku agent per test, all at once) ---
phase('Red')
log(`Writing ${tests.length} test(s) in parallel`)
const written = (await parallel(tests.map(t => () =>
  agent(
    writerContext +
    `<test>\nid: ${t.id}\nname: ${t.name}\nbehavior: ${t.behavior}\ntargets: ${t.targets}\n</test>\n\n` +
    `<output_path>\n${t.filePath}\n</output_path>\n\n` +
    `Write exactly this one failing test file. The code it calls does not exist yet - a failing import is the ` +
    `correct outcome, not a problem to work around. Do not create production code, do not skip, do not weaken the assertion.`,
    { agentType: 'tdd-dev-test-writer', label: `red:${t.id}`, phase: 'Red', schema: WRITE_SCHEMA, model: 'haiku' }
  )
))).filter(Boolean)

const writtenOk = written.filter(w => w.written)
const notWritten = tests.filter(t => !writtenOk.some(w => w.id === t.id))
log(`${writtenOk.length}/${tests.length} test file(s) written`)
if (notWritten.length) {
  // The one real failure mode of the red phase. A failing test is fine; a missing one is not.
  log(`NOT WRITTEN (the only real red-phase failure): ${notWritten.map(t => t.id).join(', ')}`)
}
if (!writtenOk.length) {
  throw new Error('No test files were written at all - the Red phase failed completely. There is nothing to implement against.')
}

const liveIds = writtenOk.map(w => w.id)
const targetFiles = writtenOk.map(w => w.path).filter(Boolean)

// --- Phase 3: Verify red (real exit codes, not self-reports) ---
phase('Verify red')
const redVerify = await agent(
  `<test_command>\n${frame.testCommand}\n</test_command>\n` +
  `<single_file_command>\n${frame.singleFileTestCommand || 'not available - run the whole suite'}\n</single_file_command>\n` +
  `<files>\n${targetFiles.join('\n')}\n</files>\n` +
  `<scenario_ids>\n${liveIds.join(', ')}\n</scenario_ids>\n\n` +
  `You are verifying RED: no implementation exists yet, so failures and errors are expected and healthy. ` +
  `What matters is that each test ran at all. Any test that PASSES here is suspicious - it was green before the ` +
  `code existed, so it probably asserts nothing. Put those in suspectHollow. Report the real exit code.`,
  { agentType: 'tdd-dev-verifier', schema: VERIFY_SCHEMA, model: 'haiku' }
)
if (!redVerify) {
  log('Verify-red failed to return - proceeding to implementation without a confirmed red baseline, and saying so rather than assuming red')
} else {
  log(`Red baseline: exit ${redVerify.exitCode}, ${redVerify.failed.length} failing, ${redVerify.errored ? redVerify.errored.length : 0} erroring, ${redVerify.passed.length} passing`)
  if (redVerify.suspectHollow && redVerify.suspectHollow.length) {
    log(`HOLLOW TEST SUSPECTS (green before any code existed, so probably assert nothing): ${redVerify.suspectHollow.join(', ')}`)
  }
}

// --- Phase 4: Green (ONE agent - the source tree cannot take concurrent editors) ---
phase('Green')
const implContext =
  `<implementation_brief>\n${frame.implementationBrief || 'Not supplied.'}\n</implementation_brief>\n\n` +
  `<test_command>\n${frame.testCommand}\n</test_command>\n\n` +
  `<failing_tests>\n${JSON.stringify(writtenOk.map(w => {
    const t = tests.find(x => x.id === w.id) || {}
    return { id: w.id, file: w.path, behavior: t.behavior, targets: t.targets }
  }), null, 2)}\n</failing_tests>\n\n`

const impl = await agent(
  implContext +
  `Implement the production code that makes these failing tests pass. Run the tests yourself as you go - ` +
  `you have Bash and a tight local loop is much cheaper than a round trip.\n\n` +
  `You may not edit any test file, for any reason, not even a typo. If a test looks wrong, implement it as written ` +
  `and say so in your notes - an independent adjudicator settles that after the next verification, and an implementer ` +
  `that edits the tests it is being graded against makes green meaningless.`,
  { agentType: 'tdd-dev-implementer', schema: IMPL_SCHEMA, model: 'sonnet' }
)
if (!impl) {
  log('Green phase returned nothing - the implementer failed. Verifying anyway to record the real state of the tree.')
} else {
  log(`Implemented: ${impl.filesCreated.length} file(s) created, ${impl.filesModified.length} modified`)
  if (impl.testFilesTouched && impl.testFilesTouched.length) {
    log(`CONTRACT VIOLATION: the implementer reported touching test files: ${impl.testFilesTouched.join(', ')}. Green from this run is not trustworthy - inspect those diffs by hand.`)
  }
  if (impl.notes) log(`  implementer notes: ${impl.notes}`)
  if (impl.blocker) log(`  blocker: ${impl.blocker}`)
}

// --- Phase 5: Verify -> Adjudicate -> Fix, capped at MAX_ATTEMPTS total ---
// One retry, exactly as specified: attempt 1 is the green pass above, attempt 2 is one adjudicated fix
// round. Anything still red after that is left alone and reported as unsolved rather than ground on.
let attempt = 1
let verify = null
let verdicts = []

while (true) {
  phase('Adjudicate')
  verify = await agent(
    `<test_command>\n${frame.testCommand}\n</test_command>\n` +
    `<single_file_command>\n${frame.singleFileTestCommand || 'not available - run the whole suite'}\n</single_file_command>\n` +
    `<files>\n${targetFiles.join('\n')}\n</files>\n` +
    `<scenario_ids>\n${liveIds.join(', ')}\n</scenario_ids>\n\n` +
    `You are verifying GREEN (attempt ${attempt} of ${MAX_ATTEMPTS}): the implementation exists now, so passes are the goal. ` +
    `Report the real exit code and quote the real error text for every failure.`,
    { agentType: 'tdd-dev-verifier', label: `verify:attempt-${attempt}`, phase: 'Adjudicate', schema: VERIFY_SCHEMA, model: 'haiku' }
  )
  if (!verify) {
    log(`Verification failed to return on attempt ${attempt} - cannot tell what passes, stopping the fix loop`)
    break
  }
  log(`Attempt ${attempt}: exit ${verify.exitCode}, ${verify.passed.length} passing, ${verify.failed.length} failing`)

  const stillBad = [...(verify.failed || []), ...(verify.errored || [])]
  if (!stillBad.length) {
    log('All tests passing')
    break
  }
  if (attempt >= MAX_ATTEMPTS) {
    log(`Attempt cap (${MAX_ATTEMPTS}) reached with ${stillBad.length} test(s) still failing: ${stillBad.join(', ')}`)
    log(`Leaving them as they are, by design - these are reported as unsolved rather than ground on further.`)
    break
  }

  // Adjudicate each failure independently and in parallel. The adjudicator wrote neither the test nor
  // the implementation, which is the entire reason its verdict can route a fix at all.
  const failureDetail = {}
  for (const f of (verify.failures || [])) failureDetail[f.id] = f.message

  verdicts = (await parallel(stillBad.map(id => {
    const t = tests.find(x => x.id === id) || {}
    const w = writtenOk.find(x => x.id === id) || {}
    return () => agent(
      `<requirement>\n${t.behavior || 'Not available'}\n</requirement>\n\n` +
      `<test_file>\n${w.path || 'unknown'}\n</test_file>\n\n` +
      `<implementation_files>\n${[...(impl ? impl.filesCreated : []), ...(impl ? impl.filesModified : [])].join('\n') || 'unknown'}\n</implementation_files>\n\n` +
      `<actual_error>\n${failureDetail[id] || 'No error text captured'}\n</actual_error>\n\n` +
      `<scenario_id>\n${id}\n</scenario_id>\n\n` +
      `This test still fails after an honest implementation attempt. Read the requirement FIRST, then the test, ` +
      `then the code, then the error. Decide whether the test or the implementation is wrong. ` +
      `When the evidence is genuinely balanced, choose implementation_wrong - a wrongly blamed test gets the ` +
      `specification edited to match whatever the code already does.`,
      { agentType: 'tdd-dev-adjudicator', label: `adjudicate:${id}`, phase: 'Adjudicate', schema: VERDICT_SCHEMA, model: 'sonnet' }
    )
  }))).filter(Boolean)

  for (const v of verdicts) log(`  ${v.id}: ${v.verdict} - ${v.fault}`)

  const testFaults = verdicts.filter(v => v.verdict === 'test_wrong' || v.verdict === 'both_wrong')
  const implFaults = verdicts.filter(v => v.verdict === 'implementation_wrong' || v.verdict === 'both_wrong')
  const envFaults = verdicts.filter(v => v.verdict === 'environment')
  for (const v of envFaults) log(`  ${v.id}: environment fault, not fixable by this workflow - ${v.whatShouldChange}`)

  attempt++
  phase('Green')
  log(`Fix round: ${testFaults.length} test fix(es), ${implFaults.length} implementation fix(es)`)

  // Test fixes go back to the agent that owns test files; implementation fixes to the one that owns
  // source. Routing by ownership rather than by convenience is what keeps the boundary intact even
  // during repair. Test fixes run on sonnet, not haiku - a correction needs more judgment than a first draft.
  if (testFaults.length) {
    await parallel(testFaults.map(v => {
      const w = writtenOk.find(x => x.id === v.id) || {}
      return () => agent(
        writerContext +
        `<rewrite>\nfile: ${w.path}\nscenario: ${v.id}\n</rewrite>\n\n` +
        `<adjudicator_verdict>\n${v.fault}\n\nWhat should change: ${v.whatShouldChange}\n</adjudicator_verdict>\n\n` +
        `An independent adjudicator ruled this test wrong. Fix only what the verdict names. Keep the scenario ID ` +
        `and the file path. Do not weaken the assertion to make it pass - if the right assertion still fails, that is fine.`,
        { agentType: 'tdd-dev-test-writer', label: `fix-test:${v.id}`, phase: 'Green', schema: WRITE_SCHEMA, model: 'sonnet' }
      )
    }))
  }

  if (implFaults.length) {
    await agent(
      implContext +
      `<adjudicator_verdicts>\n${JSON.stringify(implFaults.map(v => ({ id: v.id, fault: v.fault, whatShouldChange: v.whatShouldChange })), null, 2)}\n</adjudicator_verdicts>\n\n` +
      `An independent adjudicator ruled the implementation wrong for these tests. Fix exactly what each verdict names. ` +
      `Do not refactor, do not touch tests that already pass, and do not edit any test file.`,
      { agentType: 'tdd-dev-implementer', label: `fix-impl:attempt-${attempt}`, phase: 'Green', schema: IMPL_SCHEMA, model: 'sonnet' }
    )
  }
}

const finalPassed = verify ? verify.passed : []
const finalFailed = verify ? [...(verify.failed || []), ...(verify.errored || [])] : liveIds

// --- Phase 6: Browser (opus writes the journey, a runner proves it with screenshots) ---
// Skipped rather than faked when there is no UI or no green to demonstrate: a browser run against a
// feature that does not pass its own unit tests produces a screenshot of a broken page, not proof.
phase('Browser')
let journey = null
let browser = null
if (skipBrowser) {
  log('Browser phase skipped by request')
} else if (!frame.hasUi || !frame.appUrl) {
  log('Browser phase skipped - the framer found no runnable UI or no serving URL for this project')
} else if (!finalPassed.length) {
  log('Browser phase skipped - nothing passed at the unit level, so a browser run would only screenshot a broken page')
} else {
  journey = await agent(
    `<feature>\n${frame.featureName}\n</feature>\n\n` +
    `<implementation_brief>\n${frame.implementationBrief || 'Not supplied.'}\n</implementation_brief>\n\n` +
    `<passing_scenarios>\n${finalPassed.join(', ')}\n</passing_scenarios>\n\n` +
    `<app_url>\n${frame.appUrl}\n</app_url>\n\n` +
    `Write the ONE end-to-end journey that proves a real person can use this feature in a browser. ` +
    `Read the source for the real routes and real visible labels - guessed link text is the most common reason ` +
    `a journey dies at step 2 for reasons unrelated to the feature. Do not soften a step because you suspect ` +
    `something is not wired up: a journey that fails at step 6 tells you exactly where the wiring broke.`,
    { agentType: 'tdd-dev-e2e-author', schema: JOURNEY_SCHEMA, model: 'opus' }
  )
  if (!journey) {
    log('E2E author failed - no journey to run')
  } else {
    browser = await agent(
      `<journey>\n${JSON.stringify(journey, null, 2)}\n</journey>\n\n` +
      `<screenshot_dir>\n${proofDir}\n</screenshot_dir>\n\n` +
      `<app_start_command>\n${frame.appStartCommand || 'not supplied - assume the app is already serving'}\n</app_start_command>\n\n` +
      `Drive this journey in a real browser with playwright-cli. Screenshot every step into the proof folder, ` +
      `not only the failures. Confirm each assertion against the real DOM before marking it passed. ` +
      `If playwright-cli is missing or the app is not serving, report blocked - do not fake a run and do not install anything.`,
      { agentType: 'tdd-dev-browser-runner', schema: BROWSER_SCHEMA, model: 'haiku' }
    )
    if (!browser) log('Browser runner failed to return')
    else log(`Browser: ${browser.status} (${browser.stepsPassed}/${browser.stepsTotal} steps), proof in ${browser.screenshotDir || proofDir}`)
  }
}

// --- Phase 7: Report (text only, saved nowhere) ---
phase('Report')
const report = await agent(
  `<run>\n${JSON.stringify({
    feature: frame.featureName,
    tag,
    sourceOfTruth: frame.sourceOfTruth,
    suiteGreenBefore: frame.suiteGreenBefore,
    testCommand: frame.testCommand,
    exitCode: verify ? verify.exitCode : null,
    passed: finalPassed,
    failed: finalFailed,
    notWritten: notWritten.map(t => t.id),
    droppedByCap: droppedTests.map(t => t.id),
    suspectHollow: redVerify ? (redVerify.suspectHollow || []) : [],
    attemptsUsed: attempt,
    attemptCap: MAX_ATTEMPTS,
    verdicts: verdicts.map(v => ({ id: v.id, verdict: v.verdict, fault: v.fault })),
    failures: verify ? (verify.failures || []) : [],
    filesCreated: impl ? impl.filesCreated : [],
    filesModified: impl ? impl.filesModified : [],
    testFilesTouchedByImplementer: impl ? (impl.testFilesTouched || []) : [],
    assumptions: frame.assumptions || [],
    blockers: frame.blockers || [],
    browser: browser ? { status: browser.status, stepsPassed: browser.stepsPassed, stepsTotal: browser.stepsTotal, failureDetail: browser.failureDetail, screenshotDir: browser.screenshotDir || proofDir } : 'not run',
  }, null, 2)}\n</run>\n\n` +
  `Write the run report. Lead with anything unresolved, even if it is one item among many successes. ` +
  `Distinguish a failing test from one that was never written, from one that looks hollow, from a blocked browser run. ` +
  `Return it as text - save nothing to disk.`,
  { agentType: 'tdd-dev-reporter', model: 'sonnet' }
)

return {
  feature: frame.featureName,
  tag,
  report: report || 'The reporter agent failed. The structured results below are the raw record of what happened.',
  testCommand: frame.testCommand,
  exitCode: verify ? verify.exitCode : null,
  passed: finalPassed,
  failed: finalFailed,
  notWritten: notWritten.map(t => t.id),
  droppedByCap: droppedTests.map(t => t.id),
  suspectHollow: redVerify ? (redVerify.suspectHollow || []) : [],
  attemptsUsed: attempt,
  verdicts: verdicts.map(v => ({ id: v.id, verdict: v.verdict, fault: v.fault, whatShouldChange: v.whatShouldChange })),
  filesCreated: impl ? impl.filesCreated : [],
  filesModified: impl ? impl.filesModified : [],
  assumptions: frame.assumptions || [],
  browser: browser ? { status: browser.status, stepsPassed: browser.stepsPassed, stepsTotal: browser.stepsTotal, screenshotDir: browser.screenshotDir || proofDir } : null,
  suiteGreenBefore: frame.suiteGreenBefore,
}

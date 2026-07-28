export const meta = {
  name: 'screen-suite',
  description: 'Read every functional requirement in a PRD, decide which ones are screens, and render them all in the design system a previous design-preview run already settled',
  phases: [
    { title: 'Extract', detail: 'inventory every FR across index.md and any fr-N.md (sonnet, low effort: this is a listing, not a judgment)' },
    { title: 'Plan', detail: 'decide which FRs are screens, which share one, and which have no UI at all, and specify the shell every screen must share (sonnet: the judgment that sizes the whole run)' },
    { title: 'Anchor', detail: 'render the core screen alone, first, and capture the shell it actually built as the reference for the rest (sonnet)' },
    { title: 'Render', detail: 'one Stitch generation per remaining screen, batched, each reproducing the anchor shell (sonnet: no-retry protocol)' },
    { title: 'Unify', detail: 'one edit_screens call over every screen at once, converging them into one application (sonnet)' },
    { title: 'Gallery', detail: 'build the contact sheet that shows the whole product at once (sonnet)' },
    { title: 'Record', detail: 'merge every screen into stitch.json (haiku: file writing)' },
  ],
}

const INVENTORY_SCHEMA = {
  type: 'object',
  properties: {
    productName: { type: 'string' },
    sourceFiles: { type: 'array', items: { type: 'string' }, description: 'Every PRD file actually read, repo-relative' },
    requirements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The FR id exactly as the PRD writes it, e.g. "FR-7". Never renumber or normalize.' },
          title: { type: 'string' },
          priority: { type: 'string', description: 'P0, P1, P2, or whatever the PRD uses. Empty if the PRD states none.' },
          summary: { type: 'string', description: 'One or two sentences, drawn from the PRD rather than invented' },
          source: { type: 'string', description: 'The file this requirement was read from' },
          userFacingBehavior: { type: 'string', description: 'What a user actually sees or does for this requirement, quoted or closely paraphrased from the PRD. Empty string when the requirement describes only internal behavior, which is a real and expected answer.' },
        },
        required: ['id', 'title', 'summary', 'source'],
      },
    },
    missingSplitFiles: { type: 'array', items: { type: 'string' }, description: 'FR ids whose index table links to an fr-N.md that does not exist on disk' },
  },
  required: ['productName', 'sourceFiles', 'requirements'],
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    screens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'kebab-case identifier, used as the HTML filename' },
          name: { type: 'string' },
          purpose: { type: 'string' },
          frIds: { type: 'array', items: { type: 'string' }, description: 'Every FR this screen shows. More than one is normal and expected.' },
          screenPrompt: { type: 'string', description: 'The generation prompt describing WHAT is on the screen: layout, regions, components, concrete sample content, which states are visible. It must not describe colors, fonts, or radii - the design system supplies those, and duplicating them here fights it.' },
          importance: {
            type: 'string',
            enum: ['core', 'supporting', 'edge'],
            description: 'core means the product is unrecognizable without it - the main working surface where the value happens. supporting means a real screen a user reaches regularly but not the thing being sold: settings, export, a secondary list. edge means a screen a user hits rarely or once: onboarding, an error state, a gate. Rank honestly, because when the screen cap truncates the run it drops edge before supporting and supporting before core.',
          },
        },
        required: ['key', 'name', 'purpose', 'frIds', 'screenPrompt', 'importance'],
      },
    },
    noScreen: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          frId: { type: 'string' },
          reason: { type: 'string', description: 'Why this requirement has no screen of its own: it is server-side or internal, it is a rule with no surface, or it is a state on a screen already in the list (name that screen).' },
        },
        required: ['frId', 'reason'],
      },
      description: 'Requirements that get no screen. A healthy plan usually has several - a PRD full of requirements is not a PRD full of screens.',
    },
    productShell: {
      type: 'string',
      description: 'The persistent chrome and layout every screen in this set must share, described concretely enough that two independent generations produce the same thing: what is in the top bar and in what order, whether there is a sidebar or navigation and what it contains, the overall layout structure (single column, list-detail, canvas), and the density. This is prefixed onto every screen prompt. It must not mention colors, fonts, or radii - the design system supplies those.',
    },
    sampleWorld: {
      type: 'string',
      description: 'The one fictional world every screen is populated from: the same user name, the same project or document names, the same dates and numbers. Screens showing different fake users read as different products even when the layout matches.',
    },
    rationale: { type: 'string', description: 'How the requirements were grouped into screens, in a few sentences' },
  },
  required: ['screens', 'noScreen', 'productShell', 'sampleWorld', 'rationale'],
}

const RENDER_SCHEMA = {
  type: 'object',
  properties: {
    key: { type: 'string' },
    screenName: { type: 'string', description: 'Full screen resource name, format projects/{project}/screens/{screen}' },
    screenId: { type: 'string' },
    htmlPath: { type: 'string', description: 'Repo-relative path of the HTML file that was actually written to disk' },
    status: {
      type: 'string',
      enum: ['rendered', 'no_html', 'timed_out', 'failed'],
      description: 'rendered means a screen came back AND its markup was written to disk. no_html means the screen generated but Stitch returned no retrievable markup, so it exists in Stitch with no local file. timed_out means it was still not retrievable after the full polling window. failed means the call errored outright. Never report rendered when no file was written.',
    },
    shellDescription: {
      type: 'string',
      description: 'Only the anchor screen fills this in. A precise description of the persistent chrome as it was ACTUALLY built in the returned markup - what is in the top bar and in what order, the navigation, the layout structure, the density - so every later screen can reproduce it rather than inventing its own. Leave empty when you were not asked for it.',
    },
    notes: { type: 'string' },
  },
  required: ['key', 'status', 'notes'],
}

const UNIFY_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: ['unified', 'skipped', 'failed'],
      description: 'unified means edit_screens ran over the screen set and returned. skipped means there was nothing to unify (fewer than two screens rendered). failed means the call errored or the tools could not be loaded - which is not fatal, since the individual screens already exist and are already on disk.',
    },
    screensEdited: { type: 'number' },
    refreshedFiles: { type: 'array', items: { type: 'string' }, description: 'Screen HTML files re-written on disk after the edit, since the local copies are stale once the screens change in Stitch' },
    notes: { type: 'string' },
  },
  required: ['status', 'notes'],
}

const GALLERY_SCHEMA = {
  type: 'object',
  properties: {
    galleryPath: { type: 'string' },
    screensShown: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['galleryPath', 'screensShown'],
}

const RECORD_SCHEMA = {
  type: 'object',
  properties: {
    manifestPath: { type: 'string' },
    filesWritten: { type: 'array', items: { type: 'string' } },
    screensInManifest: { type: 'number' },
  },
  required: ['manifestPath', 'filesWritten'],
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

const prdDir = typeof input === 'string' ? input : input && input.prdDir
if (!prdDir) {
  throw new Error(
    'Missing the PRD location. Call this workflow with args set to either a plain string (the PRD folder) ' +
    'or an object shaped { "prdDir": "docs/prd/thing", "manifest": {...}, "outDir": "docs/design-preview/thing", ' +
    '"maxScreens": 10, "only": ["FR-5", "FR-6"] }.'
  )
}

const opts = (input && typeof input === 'object') ? input : {}
const manifest = (opts.manifest && typeof opts.manifest === 'object') ? opts.manifest : null

// The design system is not optional and this workflow deliberately will not invent one.
// Picking a visual direction is design-preview's job; this workflow scales a direction
// that a human has already looked at and accepted.
if (!manifest || !manifest.projectId || !manifest.designSystemAsset) {
  throw new Error(
    'No Stitch design system to render against. This workflow renders a whole PRD in a direction that was ' +
    'already chosen and approved, it does not choose one. Run /design-preview first, look at the single screen ' +
    'it produces, and once you like it, its stitch.json is what you pass here as "manifest".'
  )
}

const outDir = opts.outDir || `docs/design-preview/${manifest.slug || 'suite'}`
const deviceType = manifest.deviceType || 'DESKTOP'
const maxScreens = Number(opts.maxScreens) > 0 ? Number(opts.maxScreens) : 10
const only = Array.isArray(opts.only) && opts.only.length ? opts.only.map(String) : null
// Defaults on: a set of screens that do not look like one product is the failure this
// workflow exists to avoid, and this is one call regardless of how many screens ran.
const unifyRun = opts.unify !== false
const BATCH_SIZE = 3

// --- Phase 1: Extract (single agent, mechanical inventory) ---
phase('Extract')
const inventory = await agent(
  `PRD location: ${prdDir}\n\n` +
  `Inventory every functional requirement in this PRD. It may be one file, or an index.md whose requirement ` +
  `table links some requirements out to their own fr-N.md files. Read all of them.`,
  { agentType: 'requirement-extractor', schema: INVENTORY_SCHEMA, model: 'sonnet', effort: 'low' }
)
if (!inventory) throw new Error('Extract phase returned nothing - the requirement-extractor agent failed. Nothing downstream can run without the requirement list.')
log(`${inventory.requirements.length} requirements across ${inventory.sourceFiles.length} file(s)`)
if (inventory.missingSplitFiles && inventory.missingSplitFiles.length) {
  log(`Warning: the index links to split files that do not exist for ${inventory.missingSplitFiles.join(', ')} - those requirements were read from the index stub only`)
}

// --- Phase 2: Plan (single agent, the judgment that sizes the run) ---
phase('Plan')
const plan = await agent(
  `<requirements>\n${JSON.stringify(inventory.requirements, null, 2)}\n</requirements>\n\n` +
  `Product: ${inventory.productName}\n` +
  `Target surface: ${deviceType}\n` +
  (only ? `The human asked for these requirements only: ${only.join(', ')}. Plan screens that cover them and ignore the rest.\n` : '') +
  `\nDecide which of these requirements become screens, which ones share a screen, and which ones have no screen at all. ` +
  `Then specify the shell they all share and the sample world they are all populated from - independent generations only look like one application if you tell each of them the same concrete thing.`,
  { agentType: 'screen-planner', schema: PLAN_SCHEMA, model: 'sonnet' }
)
if (!plan) throw new Error('Plan phase returned nothing - the screen-planner agent failed.')

let screens = plan.screens
if (only) {
  screens = screens.filter(s => s.frIds.some(id => only.includes(String(id))))
}
log(`Plan: ${screens.length} screen(s) covering ${new Set(screens.flatMap(s => s.frIds)).size} requirement(s); ${plan.noScreen.length} requirement(s) deliberately get no screen`)
for (const n of plan.noScreen) log(`  no screen - ${n.frId}: ${n.reason}`)

// Cap the run, loudly. Every screen past this point is a paid, multi-minute generation,
// so a PRD with 30 screens must not quietly become a 30-generation bill. Drop the least
// important screens first and name every one dropped, because a silent cap reads as
// "the whole PRD was covered" when it was not.
const RANK = { core: 0, supporting: 1, edge: 2 }
if (screens.length > maxScreens) {
  const ordered = [...screens].sort((a, b) => (RANK[a.importance] ?? 3) - (RANK[b.importance] ?? 3))
  const dropped = ordered.slice(maxScreens)
  screens = ordered.slice(0, maxScreens)
  log(`Screen cap of ${maxScreens} reached. NOT rendering ${dropped.length} screen(s): ${dropped.map(s => `${s.name} (${s.importance}, ${s.frIds.join('/')})`).join('; ')}`)
  log(`Re-run with a higher maxScreens, or with only: [...] naming those requirement ids, to render them.`)
}

if (!screens.length) throw new Error('The plan produced no screens to render. Check the Plan phase output: either the PRD describes no user-facing surface, or the "only" filter matched nothing.')

// A Stitch design system carries tokens only: color, typography, shape. It carries no
// product identity - no top bar, no navigation, no layout structure, no sample data - so
// independent generations against the same design system come back sharing a palette and
// looking like different applications. Everything below exists to supply the part the
// design system cannot: one shell, described identically to every generation.
const sharedContext =
  `<product_shell>\n${plan.productShell}\n</product_shell>\n\n` +
  `<sample_world>\n${plan.sampleWorld}\n</sample_world>\n\n`

// --- Phase 3: Anchor ---
// The core screen renders alone and first, and reports the shell it actually built. A
// written spec and a generated screen are never quite the same thing, so later screens
// are told to match what exists rather than what was planned.
phase('Anchor')
const anchorScreen = [...screens].sort((a, b) => (RANK[a.importance] ?? 3) - (RANK[b.importance] ?? 3))[0]
log(`Anchor screen: ${anchorScreen.name} (${anchorScreen.importance}) - every other screen will be told to reproduce its shell`)
const anchor = await agent(
  sharedContext +
  `<screen_prompt>\n${anchorScreen.screenPrompt}\n</screen_prompt>\n\n` +
  `key: ${anchorScreen.key}\n` +
  `projectId: ${manifest.projectId}\n` +
  `designSystem: ${manifest.designSystemAsset}\n` +
  `deviceType: ${deviceType}\n` +
  `Write the resulting markup to this exact path: ${outDir}/screens/${anchorScreen.key}.html\n\n` +
  `You are the ANCHOR screen: you render first and alone, and every other screen in this product will be built to match yours. ` +
  `Build the shell exactly as the product_shell block specifies. Then, after the markup comes back, read it and fill in shellDescription ` +
  `with the persistent chrome as it was ACTUALLY built - what is in the top bar and in what order, the navigation, the layout structure, the density. ` +
  `Describe what the markup contains, not what you asked for.`,
  { agentType: 'suite-renderer', label: `anchor:${anchorScreen.key}`, phase: 'Anchor', schema: RENDER_SCHEMA, model: 'sonnet' }
)
if (!anchor) throw new Error('Anchor phase returned nothing - the anchor screen failed to render, and every other screen is defined relative to it.')
log(`Anchor: ${anchor.status}`)

const anchorRef = anchor.shellDescription
  ? `<anchor_shell>\nThis is the chrome as actually built on the anchor screen (${anchorScreen.name}). Reproduce it exactly: same elements, same order, same structure. Only the main content area differs on your screen.\n\n${anchor.shellDescription}\n</anchor_shell>\n\n`
  : ''
if (!anchor.shellDescription) log('Anchor returned no shell description - later screens fall back to the planned shell spec alone, so expect weaker consistency')

// --- Phase 4: Render (fan-out, batched) ---
// Batches rather than one wide parallel() on purpose: each lane is a paid, minutes-long,
// non-idempotent write against one Stitch project, and the runtime's own cap (up to 16
// concurrent) is far more pressure than is polite to put on that API. Small batches also
// bound the blast radius if the first generations come back wrong.
phase('Render')
const remaining = screens.filter(s => s.key !== anchorScreen.key)
const renders = [anchor]
for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
  const batch = remaining.slice(i, i + BATCH_SIZE)
  log(`Rendering batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(screens.length / BATCH_SIZE)}: ${batch.map(s => s.name).join(', ')}`)
  const done = (await parallel(batch.map(s => () =>
    agent(
      sharedContext +
      anchorRef +
      `<screen_prompt>\n${s.screenPrompt}\n</screen_prompt>\n\n` +
      `key: ${s.key}\n` +
      `projectId: ${manifest.projectId}\n` +
      `designSystem: ${manifest.designSystemAsset}\n` +
      `deviceType: ${deviceType}\n` +
      `Write the resulting markup to this exact path: ${outDir}/screens/${s.key}.html\n\n` +
      `Generate this one screen in Stitch against the design system above, then save its markup locally. ` +
      `Follow the no-retry and polling protocol in your instructions exactly - a second generate call costs a duplicate paid render.`,
      { agentType: 'suite-renderer', label: `render:${s.key}`, phase: 'Render', schema: RENDER_SCHEMA, model: 'sonnet' }
    )
  ))).filter(Boolean)
  renders.push(...done)
}

const succeeded = renders.filter(r => r.status === 'rendered')
log(`Rendered ${succeeded.length}/${screens.length} screen(s)`)
if (succeeded.length < screens.length) {
  const bad = renders.filter(r => r.status !== 'rendered')
  for (const r of bad) log(`  ${r.key}: ${r.status} - ${r.notes}`)
  if (renders.length < screens.length) log(`  ${screens.length - renders.length} lane(s) died outright and returned nothing`)
}

// --- Phase 5: Unify ---
// The one mechanism Stitch offers for cross-screen consistency: edit_screens takes every
// screen id in a single call, so the model sees the whole set at once and can converge
// them. Prompt-level sharing (the shell spec, the anchor reference) makes each generation
// aim at the same target; this is the only step that can see whether they actually landed
// there. It is one call regardless of screen count, and it is skippable.
const renderedIds = renders.filter(r => r.status === 'rendered' && r.screenId).map(r => r.screenId)
let unify = null
phase('Unify')
if (unifyRun && renderedIds.length > 1) {
  unify = await agent(
    sharedContext +
    `projectId: ${manifest.projectId}\n` +
    `screenIds: ${JSON.stringify(renderedIds)}\n` +
    `deviceType: ${deviceType}\n\n` +
    `<local_files>\n${JSON.stringify(renders.filter(r => r.status === 'rendered').map(r => ({ key: r.key, screenId: r.screenId, name: r.screenName, html: r.htmlPath })), null, 2)}\n</local_files>\n\n` +
    `These screens were generated independently against one design system, so they share color, type, and shape but may have drifted apart on chrome, navigation, and layout. ` +
    `Run one edit pass over all of them together to converge them into a single application, then refresh the local files.`,
    { agentType: 'suite-unifier', schema: UNIFY_SCHEMA, model: 'sonnet' }
  )
  if (!unify) log('Unify phase failed outright - the screens are still on disk, just less consistent with each other')
  else log(`Unify: ${unify.status} (${unify.screensEdited || 0} screen(s) edited)`)
} else {
  log(unifyRun ? 'Unify skipped: fewer than two screens rendered, nothing to converge' : 'Unify skipped: disabled for this run')
}

// --- Phase 6: Gallery (barrier is genuine: the contact sheet needs every screen at once) ---
phase('Gallery')
const gallery = await agent(
  `<screens>\n${JSON.stringify(screens.map(s => {
    const r = renders.find(x => x.key === s.key)
    return { key: s.key, name: s.name, purpose: s.purpose, frIds: s.frIds, importance: s.importance, html: r && r.htmlPath, status: r ? r.status : 'missing' }
  }), null, 2)}\n</screens>\n\n` +
  `<no_screen>\n${JSON.stringify(plan.noScreen, null, 2)}\n</no_screen>\n\n` +
  `Product: ${inventory.productName}\n` +
  `Write the contact sheet to: ${outDir}/index.html\n` +
  `The screen files sit in ./screens/ relative to that file.\n\n` +
  `Build the one page that shows this whole product at once.`,
  { agentType: 'gallery-author', schema: GALLERY_SCHEMA, model: 'sonnet' }
)
if (!gallery) log('Gallery phase failed - the individual screen HTML files are still on disk and can be opened directly')

// --- Phase 7: Record (single agent, file writing) ---
phase('Record')
const priorScreens = (manifest && Array.isArray(manifest.screens)) ? manifest.screens : []
const newScreens = screens.map(s => {
  const r = renders.find(x => x.key === s.key)
  return {
    label: s.name,
    key: s.key,
    frIds: s.frIds,
    name: (r && r.screenName) || null,
    screenId: (r && r.screenId) || null,
    html: (r && r.htmlPath) || null,
    status: r ? r.status : 'not_rendered',
  }
})
const newKeys = new Set(newScreens.map(s => s.key))
const record = await agent(
  `<manifest_to_write>\n${JSON.stringify({
    ...manifest,
    screens: [...priorScreens.filter(s => s && !newKeys.has(s.key) && s.label !== undefined), ...newScreens],
    gallery: gallery ? gallery.galleryPath : null,
  }, null, 2)}\n</manifest_to_write>\n\n` +
  `Manifest path: ${outDir}/stitch.json\n\n` +
  `Write the manifest above to disk exactly as given.`,
  { agentType: 'suite-recorder', schema: RECORD_SCHEMA, model: 'haiku', effort: 'low' }
)
if (!record) log('Record phase failed - the screen ids are in this workflow result, save them by hand or the next run cannot reuse them')

return {
  productName: inventory.productName,
  outDir,
  requirementCount: inventory.requirements.length,
  plannedScreens: plan.screens.length,
  renderedScreens: succeeded.length,
  noScreen: plan.noScreen,
  planRationale: plan.rationale,
  productShell: plan.productShell,
  anchorScreen: anchorScreen.key,
  unify,
  screens: newScreens,
  gallery,
  record,
}

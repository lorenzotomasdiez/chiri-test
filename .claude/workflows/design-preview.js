export const meta = {
  name: 'design-preview',
  description: 'Turn a PRD into a DESIGN.md plus one Stitch-rendered HTML screen, so a visual direction can be judged in minutes',
  phases: [
    { title: 'Read', detail: 'read the PRD, pick the most representative screen, write its generation prompt (sonnet: the choice is the product)' },
    { title: 'Direct', detail: 'author DESIGN.md and pick the concrete Stitch design tokens (sonnet: taste call)' },
    { title: 'Provision', detail: 'create the Stitch project and design system, return their ids (sonnet: multi-step MCP protocol)' },
    { title: 'Render', detail: 'generate the screen against the design system and save the HTML (sonnet: no-retry protocol)' },
    { title: 'Record', detail: 'write DESIGN.md and the stitch.json manifest so later runs reuse the same style (haiku: file writing)' },
  ],
}

// Curated subset of the Stitch font enum. The full enum carries 68 values, most of
// them novelty display faces. Constraining the schema to product-appropriate families
// keeps the choice sane and keeps the schema light enough to sit in every prompt.
const STITCH_FONTS = [
  'INTER', 'MANROPE', 'PLUS_JAKARTA_SANS', 'SPACE_GROTESK', 'WORK_SANS', 'DM_SANS',
  'GEIST', 'SORA', 'OUTFIT', 'LEXEND', 'IBM_PLEX_SANS', 'RUBIK', 'MONTSERRAT',
  'NEWSREADER', 'EB_GARAMOND', 'PLAYFAIR_DISPLAY', 'LIBRE_CASLON_TEXT',
  'JETBRAINS_MONO', 'BEBAS_NEUE',
]

const SCOPE_SCHEMA = {
  type: 'object',
  properties: {
    productName: { type: 'string' },
    slug: { type: 'string', description: 'kebab-case identifier for the product, used as the output folder name' },
    oneLiner: { type: 'string' },
    audience: { type: 'string' },
    deviceType: {
      type: 'string',
      enum: ['MOBILE', 'DESKTOP', 'TABLET', 'AGNOSTIC'],
      description: 'The primary surface the PRD is written for. MOBILE if the PRD describes a phone app or a mobile-first flow; DESKTOP if it describes a dashboard, admin, or data-dense workspace; TABLET only if the PRD names tablets specifically; AGNOSTIC only when the PRD genuinely does not commit to a surface. Guessing DESKTOP for a phone product wastes the whole run, so read the PRD for the actual surface rather than defaulting.',
    },
    brandSignals: {
      type: 'array',
      items: { type: 'string' },
      description: 'Verbatim or near-verbatim phrases from the PRD that constrain the visual direction: stated brand colors, tone words, competitor comparisons, industry conventions. Empty is an honest answer when the PRD says nothing about look and feel.',
    },
    representativeScreen: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        purpose: { type: 'string' },
        primaryAction: { type: 'string' },
        keyElements: { type: 'array', items: { type: 'string' } },
        populatedWith: { type: 'string', description: 'The concrete, plausible sample data this screen should be rendered with, so the preview shows a real product rather than lorem ipsum' },
      },
      required: ['name', 'purpose', 'primaryAction', 'keyElements'],
    },
    screenPrompt: {
      type: 'string',
      description: 'The generation prompt describing WHAT is on the screen: layout, sections, elements, sample content, states. It must not describe colors, fonts, or radii - the Stitch design system supplies those, and duplicating them here fights it.',
    },
    rationale: { type: 'string', description: 'Why this screen is the most representative one to judge the design on' },
    assumptions: { type: 'array', items: { type: 'string' } },
  },
  required: ['productName', 'slug', 'oneLiner', 'deviceType', 'representativeScreen', 'screenPrompt', 'rationale'],
}

const DIRECTION_SCHEMA = {
  type: 'object',
  properties: {
    displayName: { type: 'string', description: 'Human-readable name for the design system as it will appear in Stitch' },
    colorMode: {
      type: 'string',
      enum: ['LIGHT', 'DARK'],
      description: 'Pick DARK only when the product is used in a dim context or the category expects it (developer tooling, media, trading, monitoring). Pick LIGHT for everything else, including most consumer and B2B products. Do not pick DARK because it looks striking in a preview.',
    },
    customColor: { type: 'string', description: 'Seed color in hex, e.g. "#0F4C5C". If the PRD states a brand color, use it verbatim.' },
    headlineFont: {
      type: 'string',
      enum: STITCH_FONTS,
      description: 'The display face. Geometric and neo-grotesque sans (INTER, GEIST, DM_SANS, MANROPE, PLUS_JAKARTA_SANS, WORK_SANS) read neutral and modern and are the safe answer for most software. Serifs (NEWSREADER, EB_GARAMOND, PLAYFAIR_DISPLAY, LIBRE_CASLON_TEXT) buy editorial or institutional authority and cost approachability. SPACE_GROTESK, SORA, and OUTFIT read technical or opinionated. JETBRAINS_MONO only for developer tooling. BEBAS_NEUE only when the brand is genuinely loud.',
    },
    bodyFont: {
      type: 'string',
      enum: STITCH_FONTS,
      description: 'The reading face, judged on legibility at small sizes rather than character. Matching it to headlineFont is the correct default for most products; pair a different family only when the contrast does deliberate work. Never choose BEBAS_NEUE or PLAYFAIR_DISPLAY here - display faces are unreadable as body text.',
    },
    roundness: {
      type: 'string',
      enum: ['ROUND_FOUR', 'ROUND_EIGHT', 'ROUND_TWELVE', 'ROUND_FULL'],
      description: 'ROUND_FOUR for dense, precise, data-heavy or institutional products; ROUND_EIGHT as the neutral default for most software; ROUND_TWELVE for friendly consumer products; ROUND_FULL only for playful or highly casual brands. This is a category decision, not a taste tiebreaker.',
    },
    designMd: { type: 'string', description: 'The full DESIGN.md document as markdown. This is the file a human reads to judge the direction, and it is also passed to Stitch as the design system brief.' },
    rationale: { type: 'string', description: 'Why this direction fits this product, in a few sentences' },
  },
  required: ['displayName', 'colorMode', 'customColor', 'headlineFont', 'bodyFont', 'roundness', 'designMd', 'rationale'],
}

const PROVISION_SCHEMA = {
  type: 'object',
  properties: {
    projectId: { type: 'string', description: 'Bare project id with no "projects/" prefix' },
    designSystemAsset: { type: 'string', description: 'Design system asset id in the form "assets/<id>", exactly as generate_screen_from_text expects it' },
    applied: { type: 'boolean', description: 'True only if update_design_system was called after create_design_system and returned successfully' },
    status: {
      type: 'string',
      enum: ['created', 'failed'],
      description: 'created only when both a project id and a design system asset id came back from Stitch. Anything else is failed, including a partial run where the project exists but the design system call errored - report what did get created in notes rather than reporting success.',
    },
    notes: { type: 'string' },
  },
  required: ['status', 'notes'],
}

const RENDER_SCHEMA = {
  type: 'object',
  properties: {
    screenName: { type: 'string', description: 'Full screen resource name, format projects/{project}/screens/{screen}' },
    screenId: { type: 'string' },
    htmlPath: { type: 'string', description: 'Repo-relative path of the HTML file that was actually written to disk' },
    status: {
      type: 'string',
      enum: ['rendered', 'no_html', 'timed_out', 'failed'],
      description: 'rendered means a screen came back AND its markup was written to disk. no_html means the screen generated but Stitch returned no retrievable markup, so the design exists in Stitch but there is no local file. timed_out means generation was still not retrievable after the full polling window. failed means the call errored outright. Never report rendered when no file was written.',
    },
    suggestions: { type: 'array', items: { type: 'string' }, description: 'Follow-up suggestions Stitch returned in output_components, passed through verbatim for the human to accept or ignore' },
    notes: { type: 'string' },
  },
  required: ['status', 'notes'],
}

const RECORD_SCHEMA = {
  type: 'object',
  properties: {
    manifestPath: { type: 'string' },
    designMdPath: { type: 'string' },
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

const prd = typeof input === 'string' ? input : input && input.prd
if (!prd) {
  throw new Error(
    'Missing the PRD. Call this workflow with args set to either a plain string (a path to a PRD, ' +
    'or the product description itself) or an object shaped ' +
    '{ "prd": "docs/prd/thing.md", "slug": "thing", "screen": "onboarding", "manifest": {...}, "outDir": "docs/design-preview/thing" }.'
  )
}

const opts = (input && typeof input === 'object') ? input : {}
const requestedScreen = opts.screen || null
const manifest = (opts.manifest && typeof opts.manifest === 'object') ? opts.manifest : null
const reusing = Boolean(manifest && manifest.projectId && manifest.designSystemAsset)

const kebab = s => String(s || 'screen').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'screen'

// --- Phase 1: Read (single agent, sequential) ---
phase('Read')
const scope = await agent(
  `<prd_source>\n${prd}\n</prd_source>\n\n` +
  (requestedScreen
    ? `The human has asked specifically for this screen: "${requestedScreen}". Scope that screen rather than picking one yourself, and say in the rationale how it relates to the product.`
    : `Pick the single most representative screen: the one a stakeholder would look at to decide whether they like this product's design.`) +
  `\n\nIf <prd_source> looks like a file path, read that file first. If it is prose, treat it as the PRD itself.`,
  { agentType: 'preview-scoper', schema: SCOPE_SCHEMA, model: 'sonnet' }
)
if (!scope) throw new Error('Read phase returned nothing - the scoper agent failed. Nothing downstream can run without a scoped screen.')

const slug = opts.slug || scope.slug
const outDir = opts.outDir || `docs/design-preview/${slug}`
const htmlPath = `${outDir}/${kebab(scope.representativeScreen.name)}.html`
log(`Screen: ${scope.representativeScreen.name} (${scope.deviceType}) - ${scope.rationale}`)

// --- Phase 2/3: Direct + Provision, skipped entirely when reusing a saved design system ---
let direction = null
let provision = null

if (reusing) {
  provision = { projectId: manifest.projectId, designSystemAsset: manifest.designSystemAsset, applied: true, status: 'created', notes: 'Reused from the existing stitch.json manifest - no new project or design system was created.' }
  log(`Reusing design system ${manifest.designSystemAsset} in project ${manifest.projectId} - skipping Direct and Provision`)
} else {
  phase('Direct')
  direction = await agent(
    `<product>\n${JSON.stringify(scope, null, 2)}\n</product>\n\n` +
    `Author the design direction for this product: the DESIGN.md a human will read to judge it, and the concrete Stitch token values that express it. ` +
    `The token fields you return are transcribed verbatim into a Stitch API call by a downstream agent that will not second-guess them, so they must be valid enum values and a valid hex color.`,
    { agentType: 'design-director', schema: DIRECTION_SCHEMA, model: 'sonnet' }
  )
  if (!direction) throw new Error('Direct phase returned nothing - the design-director agent failed. Nothing downstream can run without a design direction.')
  log(`Direction: ${direction.displayName} (${direction.colorMode}, ${direction.customColor}, ${direction.headlineFont}/${direction.bodyFont}, ${direction.roundness})`)

  phase('Provision')
  provision = await agent(
    `<design_system>\n${JSON.stringify({
      displayName: direction.displayName,
      theme: {
        colorMode: direction.colorMode,
        customColor: direction.customColor,
        headlineFont: direction.headlineFont,
        bodyFont: direction.bodyFont,
        roundness: direction.roundness,
        designMd: direction.designMd,
      },
    }, null, 2)}\n</design_system>\n\n` +
    `Project title to create: "${scope.productName} design preview".\n\n` +
    `Create the Stitch project and this design system, apply it, and return the two ids. Transcribe the values above exactly as given.`,
    { agentType: 'stitch-provisioner', schema: PROVISION_SCHEMA, model: 'sonnet' }
  )
  if (!provision) throw new Error('Provision phase returned nothing - the stitch-provisioner agent failed.')
}

if (provision.status !== 'created' || !provision.projectId || !provision.designSystemAsset) {
  throw new Error(`Cannot render: Stitch provisioning did not produce both ids. Status: ${provision.status}. Notes: ${provision.notes}`)
}

// --- Phase 4: Render (single agent, sequential, long-running MCP call) ---
phase('Render')
const render = await agent(
  `<screen_prompt>\n${scope.screenPrompt}\n</screen_prompt>\n\n` +
  `projectId: ${provision.projectId}\n` +
  `designSystem: ${provision.designSystemAsset}\n` +
  `deviceType: ${scope.deviceType}\n` +
  `Write the resulting markup to this exact path: ${htmlPath}\n\n` +
  `Generate this screen in Stitch against the design system above, then save its markup locally. ` +
  `Follow the no-retry and polling protocol in your instructions exactly - a second generate call costs a duplicate paid render.`,
  { agentType: 'screen-renderer', schema: RENDER_SCHEMA, model: 'sonnet' }
)
if (!render) throw new Error('Render phase returned nothing - the screen-renderer agent failed. The Stitch project and design system still exist and are recorded in the workflow result.')
log(`Render: ${render.status}${render.htmlPath ? ` -> ${render.htmlPath}` : ''}`)

// --- Phase 5: Record (single agent, sequential) ---
phase('Record')
const screensSoFar = (manifest && Array.isArray(manifest.screens)) ? manifest.screens : []
const thisScreen = {
  label: scope.representativeScreen.name,
  name: render.screenName || null,
  screenId: render.screenId || null,
  html: render.htmlPath || null,
  status: render.status,
}
const record = await agent(
  `<manifest_to_write>\n${JSON.stringify({
    slug,
    prd: typeof prd === 'string' && prd.length < 300 ? prd : 'inline product description',
    productName: scope.productName,
    projectId: provision.projectId,
    designSystemAsset: provision.designSystemAsset,
    deviceType: scope.deviceType,
    designMd: 'DESIGN.md',
    screens: [...screensSoFar.filter(s => s && s.label !== thisScreen.label), thisScreen],
  }, null, 2)}\n</manifest_to_write>\n\n` +
  `Output folder: ${outDir}\n` +
  `Manifest path: ${outDir}/stitch.json\n` +
  (direction
    ? `Also write this DESIGN.md to ${outDir}/DESIGN.md:\n\n<design_md>\n${direction.designMd}\n</design_md>`
    : `Do NOT write DESIGN.md on this run - this run reused an existing design system, and the DESIGN.md already on disk is the one that produced it. Overwriting it would replace the real record with a reconstruction.`) +
  `\n\nWrite the files above to disk exactly as given.`,
  { agentType: 'preview-recorder', schema: RECORD_SCHEMA, model: 'haiku', effort: 'low' }
)
if (!record) log('Record phase failed - the Stitch ids are still in this workflow result, save them by hand or the next run will create a duplicate project')

return {
  slug,
  outDir,
  reusedExistingDesignSystem: reusing,
  scope,
  direction,
  stitch: { projectId: provision.projectId, designSystemAsset: provision.designSystemAsset },
  render,
  record,
}

import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

/**
 * FR-3's live-preview decoration layer. `markdown()` alone only supplies
 * syntax highlighting; this module is what turns the raw Markdown source
 * into structured-looking text while the underlying document (what
 * window.__editor.state.doc holds) stays byte-identical Markdown.
 *
 * Scope, per the plan: heading marks, bold/italic marks, link bracket+URL
 * syntax, and bullet-list markers are hidden (the last replaced with a
 * ghost-colored dash, per CC-DOC.5) while the caret is elsewhere on the
 * line. Fence markers, the blockquote '>', '---' and ordered-list numerals
 * stay visible - hiding those is not asked for by any spec, and
 * quote/fence/hr/ordered-list get line-level styling only.
 *
 * The hide/reveal split matters beyond looks: rebuilding the "hide" decoration
 * on the very line the caret is actively typing on, every keystroke, is what
 * a couple of the FR-3 nested/atomic specs exist to catch as a source of
 * corrupted input (a DOM node the caret is mid-edit in getting replaced out
 * from under it). Only the line(s) the caret isn't on get the marker hidden,
 * so a construct's marks flip to hidden once typing moves elsewhere, never
 * while it's still being typed. The atomic-range treatment (so ArrowRight
 * jumps over a marker instead of stalling inside it) is unaffected by this -
 * it is derived from the syntax tree alone, regardless of caret position.
 */

const hiddenMark = Decoration.replace({})

class ListDashWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const dash = document.createElement('span')
    dash.className = 'cm-lp-list-dash'
    dash.textContent = '-'
    return dash
  }

  ignoreEvent(): boolean {
    return true
  }
}

interface AtomicSpan {
  from: number
  to: number
}

interface VisualSpan {
  from: number
  to: number
  deco: Decoration
}

function headingLineClass(level: number): string {
  return `cm-lp-heading cm-lp-h${level}`
}

function collectSpans(view: EditorView): { visual: VisualSpan[]; atomic: AtomicSpan[] } {
  const doc = view.state.doc
  const visual: VisualSpan[] = []
  const atomic: AtomicSpan[] = []

  const caretLines = new Set<number>()
  for (const range of view.state.selection.ranges) {
    caretLines.add(doc.lineAt(range.from).number)
    caretLines.add(doc.lineAt(range.to).number)
  }
  const onCaretLine = (pos: number) => caretLines.has(doc.lineAt(pos).number)

  const hide = (from: number, to: number) => {
    if (to <= from) return
    atomic.push({ from, to })
    if (!onCaretLine(from)) visual.push({ from, to, deco: hiddenMark })
  }
  const hideWithWidget = (from: number, to: number, widget: WidgetType) => {
    if (to <= from) return
    atomic.push({ from, to })
    if (!onCaretLine(from)) visual.push({ from, to, deco: Decoration.replace({ widget }) })
  }
  const mark = (from: number, to: number, className: string) => {
    if (to <= from) return
    visual.push({ from, to, deco: Decoration.mark({ class: className }) })
  }
  const line = (pos: number, className: string) => {
    visual.push({ from: pos, to: pos, deco: Decoration.line({ class: className }) })
  }
  const lineRange = (fromPos: number, toPos: number, className: string) => {
    const startLine = doc.lineAt(fromPos).number
    const endLine = doc.lineAt(toPos).number
    for (let l = startLine; l <= endLine; l++) line(doc.line(l).from, className)
  }

  // End offset of the most recent Link node confirmed to have a target.
  // Links do not nest, and iterate() visits a parent before its children and
  // in document order, so a single running value is enough to tell a real
  // link's marks from a lookalike's.
  let realLinkTo = -1

  // CC-DOC.5 only asks for the disc-replacing dash on unordered lists;
  // ordered-list numerals stay visible. Lists nest, so this needs a stack
  // rather than a single running flag.
  const listTypeStack: Array<'bullet' | 'ordered'> = []

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        switch (node.name) {
          case 'ATXHeading1':
          case 'ATXHeading2':
          case 'ATXHeading3':
          case 'ATXHeading4':
          case 'ATXHeading5':
          case 'ATXHeading6': {
            const level = Number(node.name.slice(-1))
            line(doc.lineAt(node.from).from, headingLineClass(level))
            break
          }
          case 'HeaderMark': {
            // Only ATX heading marks reach here in this grammar. Hide the
            // '#' run plus the single space that separates it from the
            // heading text, so the visible text is exactly the title.
            let end = node.to
            const lineEnd = doc.lineAt(node.from).to
            while (end < lineEnd && doc.sliceString(end, end + 1) === ' ') end++
            hide(node.from, end)
            break
          }
          case 'StrongEmphasis':
            mark(node.from, node.to, 'cm-lp-strong')
            break
          case 'Emphasis':
            mark(node.from, node.to, 'cm-lp-em')
            break
          case 'EmphasisMark':
            hide(node.from, node.to)
            break
          case 'Link': {
            // `[caption]` on its own is a valid CommonMark shortcut
            // reference link, so the grammar emits a Link node for it - and
            // for the `[caption](` a user is still halfway through typing.
            // Decorating those would underline text that links nowhere and,
            // worse, hide the brackets around it, so the half-typed source
            // reads as finished prose. Only an inline link with an actual
            // target counts, which is also the only link form FR-3 lists as
            // a supported construct.
            if (!node.node.getChild('URL')) break
            mark(node.from, node.to, 'cm-lp-link')
            realLinkTo = node.to
            break
          }
          case 'LinkMark':
          case 'URL':
            // Only inside a link that cleared the check above. Brackets
            // belonging to an incomplete one stay visible as typed.
            if (node.to <= realLinkTo) hide(node.from, node.to)
            break
          case 'InlineCode':
            mark(node.from, node.to, 'cm-lp-code')
            break
          case 'CodeMark':
            // Inline code backticks (`code`) stay visible - only fenced
            // block markers get a visible-but-styled treatment below, and
            // this covers both without hiding either.
            break
          case 'FencedCode':
            lineRange(node.from, node.to, 'cm-lp-codeblock')
            break
          case 'Blockquote':
            lineRange(node.from, node.to, 'cm-lp-quote')
            break
          case 'HorizontalRule':
            line(doc.lineAt(node.from).from, 'cm-lp-hr')
            break
          case 'ListItem':
            line(doc.lineAt(node.from).from, 'cm-lp-listitem')
            break
          case 'BulletList':
            listTypeStack.push('bullet')
            break
          case 'OrderedList':
            listTypeStack.push('ordered')
            break
          case 'ListMark': {
            if (listTypeStack[listTypeStack.length - 1] !== 'bullet') break
            // Extend past the single separating space, the same way
            // HeaderMark does above, so the widget's own trailing space
            // (from its CSS) is the only gap between dash and text.
            let end = node.to
            const lineEnd = doc.lineAt(node.from).to
            while (end < lineEnd && doc.sliceString(end, end + 1) === ' ') end++
            hideWithWidget(node.from, end, new ListDashWidget())
            break
          }
        }
      },
      leave: (node) => {
        if (node.name === 'BulletList' || node.name === 'OrderedList') listTypeStack.pop()
      },
    })
  }

  return { visual, atomic }
}

function buildDecorations(spans: VisualSpan[]): DecorationSet {
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  for (const s of sorted) builder.add(s.from, s.to, s.deco)
  return builder.finish()
}

function buildAtomicRanges(spans: AtomicSpan[]): DecorationSet {
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to)
  const builder = new RangeSetBuilder<Decoration>()
  for (const s of sorted) builder.add(s.from, s.to, hiddenMark)
  return builder.finish()
}

class LivePreviewPlugin {
  decorations: DecorationSet
  atomic: DecorationSet

  constructor(view: EditorView) {
    const { visual, atomic } = collectSpans(view)
    this.decorations = buildDecorations(visual)
    this.atomic = buildAtomicRanges(atomic)
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      const { visual, atomic } = collectSpans(update.view)
      this.decorations = buildDecorations(visual)
      this.atomic = buildAtomicRanges(atomic)
    }
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (v) => v.decorations,
})

/**
 * The extension to install: the decoration plugin plus the atomicRanges
 * facet that makes ArrowRight/ArrowLeft jump over a hidden marker instead
 * of stalling inside it (the probe-4 regression).
 */
export function livePreview() {
  return [
    livePreviewPlugin,
    EditorView.atomicRanges.of((view) => {
      return view.plugin(livePreviewPlugin)?.atomic ?? Decoration.none
    }),
  ]
}

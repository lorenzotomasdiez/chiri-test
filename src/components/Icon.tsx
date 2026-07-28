/**
 * The closed icon set (CC-ICON.3). Backed by a local inline SVG sprite
 * (public/chiri-icons.svg) - no Material Symbols webfont is ever loaded.
 *
 * The sprite carries the real Material Symbols outlines, so the shapes match
 * the design references without loading the Google webfont those references
 * link to (CC-REJECT.6, CC-REJECT.7, CC-ALL.7).
 *
 * `variant="text"` renders the icon's ligature name as plain text. Nothing in
 * the product should use it: with no Material Symbols font loaded, the name is
 * what the user reads on screen - the top bar literally displayed the words
 * "content_copy" and "download" until this was corrected. Kept only so the
 * type stays honest about what the component can do.
 */

export type IconName =
  | 'expand_more'
  | 'content_copy'
  | 'download'
  | 'check'
  | 'error'
  | 'info'
  | 'close'
  | 'subdirectory_arrow_right'

interface IconProps {
  name: IconName
  className?: string
  variant?: 'svg' | 'text'
}

export function Icon({ name, className = '', variant = 'svg' }: IconProps) {
  if (variant === 'text') {
    return (
      <span aria-hidden="true" className={`icon inline-block align-middle ${className}`}>
        {name}
      </span>
    )
  }

  return (
    <svg aria-hidden="true" className={`icon inline-block align-middle ${className}`} width={18} height={18}>
      <use href={`/chiri-icons.svg#${name}`} />
    </svg>
  )
}

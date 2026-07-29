/**
 * The closed icon set (CC-ICON.3). Backed by a local inline SVG sprite
 * (public/chiri-icons.svg) - no Material Symbols webfont is ever loaded.
 *
 * The sprite carries the real Material Symbols outlines, so the shapes match
 * the design references without loading the Google webfont those references
 * link to (CC-REJECT.6, CC-REJECT.7, CC-ALL.7).
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
}

export function Icon({ name, className = '' }: IconProps) {
  return (
    <svg aria-hidden="true" className={`icon inline-block align-middle ${className}`} width={18} height={18}>
      <use href={`/chiri-icons.svg#${name}`} />
    </svg>
  )
}

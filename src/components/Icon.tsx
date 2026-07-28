/**
 * The closed icon set (CC-ICON.3). Backed by a local inline SVG sprite
 * (public/chiri-icons.svg) - no Material Symbols webfont is ever loaded.
 *
 * `variant="text"` renders the icon's ligature-style name as plain text
 * instead of an <svg>. It exists for the top bar: the bar's accessible
 * surface must contain zero <svg> elements (CC-BRAND, CC-NAV anatomy), so
 * every icon inside the banner uses this variant instead of the sprite.
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

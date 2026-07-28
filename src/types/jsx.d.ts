// The top bar anatomy test (T-CC-NAV-1) queries `page.locator('banner')`, a
// plain CSS type selector, so the top bar's root element must literally be a
// <banner> tag (not just role="banner" on a <header>). This augments JSX so
// TopBar.tsx can render it.
import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      banner: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

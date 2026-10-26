import 'styled-components'
import type { AppTheme } from './theme/theme'

declare module 'styled-components' {
  // Must be an interface so it merges with styled-components' own DefaultTheme
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}

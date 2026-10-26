export const theme = {
  colors: {
    background: '#1a3239', // darkest and predominant: page background
    surface: '#1f404a', // background tinted toward the blue: header, footer, table, upload box
    text: '#f4fbfd',
    textMuted: '#a8b5b8',
    primary: '#fbf903', // yellow: primary button
    primaryHover: '#fcfb5b',
    primaryText: '#1a3239', // dark text on yellow
    accent: '#49bbe5', // blue: links, focus rings, drag highlight
    success: '#9ec461', // green: positive messages
    border: '#347d98',
    error: '#ff8f80', // the one color outside the palette
    dropActive: '#224b58',
  },
  space: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px' },
  fontSizes: { sm: '0.8125rem', md: '1rem', lg: '1.25rem', xl: '1.75rem' },
  radii: { md: '8px' },
  layout: { maxWidth: '960px' },
} as const

export type AppTheme = typeof theme

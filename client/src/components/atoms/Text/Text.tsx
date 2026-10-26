import type { ReactNode } from 'react'
import styled, { type DefaultTheme } from 'styled-components'

export type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'error' | 'success'
export type TextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div'

const defaultTag: Record<TextVariant, TextTag> = {
  title: 'h1',
  heading: 'h2',
  body: 'p',
  caption: 'span',
  error: 'p',
  success: 'p',
}

const variantStyles = (theme: DefaultTheme): Record<TextVariant, string> => ({
  title: `font-size: ${theme.fontSizes.xl}; font-weight: 700; line-height: 1.2; color: ${theme.colors.text};`,
  heading: `font-size: ${theme.fontSizes.lg}; font-weight: 600; line-height: 1.3; color: ${theme.colors.text};`,
  body: `font-size: ${theme.fontSizes.md}; color: ${theme.colors.text};`,
  caption: `font-size: ${theme.fontSizes.sm}; color: ${theme.colors.textMuted};`,
  error: `font-size: ${theme.fontSizes.md}; color: ${theme.colors.error};`,
  success: `font-size: ${theme.fontSizes.md}; color: ${theme.colors.success};`,
})

const StyledText = styled.p<{ $variant: TextVariant }>`
  margin: 0;
  ${({ theme, $variant }) => variantStyles(theme)[$variant]}
`

type TextProps = { variant?: TextVariant; as?: TextTag; children: ReactNode }

export function Text({ variant = 'body', as, children }: TextProps) {
  return (
    <StyledText as={as ?? defaultTag[variant]} $variant={variant}>
      {children}
    </StyledText>
  )
}

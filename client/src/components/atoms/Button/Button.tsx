import styled from 'styled-components'

export const Button = styled.button<{ $variant?: 'primary' | 'secondary' }>`
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  border-radius: ${({ theme }) => theme.radii.md};
  border: 1px solid ${({ theme, $variant }) => ($variant === 'secondary' ? theme.colors.border : theme.colors.primary)};
  background: ${({ theme, $variant }) => ($variant === 'secondary' ? theme.colors.surface : theme.colors.primary)};
  color: ${({ theme, $variant }) => ($variant === 'secondary' ? theme.colors.text : theme.colors.primaryText)};

  &:hover:not(:disabled) {
    background: ${({ theme, $variant }) =>
      $variant === 'secondary' ? theme.colors.background : theme.colors.primaryHover};
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.accent};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

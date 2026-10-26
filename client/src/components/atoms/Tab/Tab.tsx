import styled from 'styled-components'

export const Tab = styled.button<{ $selected: boolean }>`
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 3px solid ${({ theme, $selected }) => ($selected ? theme.colors.primary : 'transparent')};
  color: ${({ theme, $selected }) => ($selected ? theme.colors.text : theme.colors.textMuted)};

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  &:focus-visible {
    outline: 3px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -3px;
  }
`

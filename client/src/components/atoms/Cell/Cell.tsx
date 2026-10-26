import type { ReactNode } from 'react'
import styled from 'styled-components'

const StyledCell = styled.td<{ $header: boolean }>`
  padding: ${({ theme }) => `${theme.space.sm} ${theme.space.md}`};
  text-align: left;
  vertical-align: top;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ $header }) => ($header ? 600 : 400)};
  background: ${({ theme, $header }) => ($header ? theme.colors.background : 'transparent')};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  position: ${({ $header }) => ($header ? 'sticky' : 'static')};
  top: 0;
  z-index: ${({ $header }) => ($header ? 1 : 0)};
`

type CellProps = { header?: boolean; children?: ReactNode }

export function Cell({ header = false, children }: CellProps) {
  return header ? (
    <StyledCell as="th" scope="col" $header>
      {children}
    </StyledCell>
  ) : (
    <StyledCell $header={false}>{children}</StyledCell>
  )
}

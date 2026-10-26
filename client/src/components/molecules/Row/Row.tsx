import type { ReactNode } from 'react'
import styled from 'styled-components'
import { Cell } from '../../atoms/Cell/Cell'

const StyledRow = styled.tr<{ $header: boolean }>`
  ${({ theme, $header }) => !$header && `&:hover { background: ${theme.colors.background}; }`}
`

type RowProps = { cells: ReactNode[]; header?: boolean }

export function Row({ cells, header = false }: RowProps) {
  return (
    <StyledRow $header={header}>
      {cells.map((content, index) => (
        <Cell key={index} header={header}>
          {content}
        </Cell>
      ))}
    </StyledRow>
  )
}

import type { ReactNode } from 'react'
import styled from 'styled-components'
import { Row } from '../../molecules/Row/Row'

const Scroll = styled.div`
  flex: 1 1 0%; /* take whatever height the page has left */
  min-height: 240px; /* never shrink below this; the page scrolls instead */
  overflow: auto;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
`

const Table = styled.table<{ $minWidth: string }>`
  width: 100%;
  min-width: ${({ $minWidth }) => $minWidth};
  border-collapse: separate; /* sticky header cells only keep their borders this way */
  border-spacing: 0;
`

type DataTableProps = {
  label: string // accessible name of the table
  headers: string[]
  rows: { key: string; cells: ReactNode[] }[]
  minWidth?: string
}

export function DataTable({ label, headers, rows, minWidth = '720px' }: DataTableProps) {
  return (
    <Scroll>
      <Table aria-label={label} $minWidth={minWidth}>
        <thead>
          <Row header cells={headers} />
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row key={row.key} cells={row.cells} />
          ))}
        </tbody>
      </Table>
    </Scroll>
  )
}

import styled from 'styled-components'
import type { ErrorCode, RowError } from '../../../api/matchCompanies'
import { Text } from '../../atoms/Text/Text'
import { DataTable } from '../DataTable/DataTable'

const ERROR_LABELS: Record<ErrorCode, string> = {
  invalid_business_id: 'Invalid business ID',
  not_found: 'Not found',
  no_exact_match: 'No exact match',
  ambiguous_name: 'Ambiguous name',
  no_identifier: 'Missing identifier',
  lookup_failed: 'Lookup failed',
  name_mismatch: 'Name does not match ID',
}

const HEADERS = ['Row', 'Business ID', 'Name', 'Problem', 'Details', 'Closest companies']

const Candidates = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
  margin: 0;
  padding: 0;
  list-style: none;
`

export function ErrorList({ errors }: { errors: RowError[] }) {
  if (errors.length === 0) {
    return <Text variant="success">No errors. Every row was matched.</Text>
  }

  return (
    <DataTable
      label="Rows that could not be matched"
      headers={HEADERS}
      rows={errors.map((error) => ({
        key: String(error.row),
        cells: [
          error.row,
          error.input.business_id || '—',
          error.input.name || '—',
          ERROR_LABELS[error.code],
          error.message,
          error.candidates?.length ? (
            <Candidates>
              {error.candidates.map((candidate) => (
                <li key={candidate.businessId}>
                  <Text variant="caption">
                    {candidate.name} ({candidate.businessId}
                    {candidate.active ? '' : ', inactive'}, {Math.round(candidate.score * 100)}%)
                  </Text>
                </li>
              ))}
            </Candidates>
          ) : (
            '—'
          ),
        ],
      }))}
    />
  )
}

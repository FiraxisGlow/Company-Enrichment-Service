import { useState } from 'react'
import styled from 'styled-components'
import { matchCompanies, type MatchResponse } from '../../../api/matchCompanies'
import { Button } from '../../atoms/Button/Button'
import { Text } from '../../atoms/Text/Text'
import { CsvDropzone } from '../../molecules/CsvDropzone/CsvDropzone'
import { PageTemplate } from '../../templates/PageTemplate/PageTemplate'
import { ResultsTabs } from '../../organisms/ResultsTabs/ResultsTabs'

const Section = styled.section`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  min-height: 0;
`

const SubmitButton = styled(Button)`
  align-self: flex-start;
`

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; result: MatchResponse }

export function MatchPage() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<State>({ status: 'idle' })
  const loading = state.status === 'loading'

  async function handleSubmit() {
    if (!file) return
    setState({ status: 'loading' })
    try {
      setState({ status: 'done', result: await matchCompanies(file) })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }

  return (
    <PageTemplate>
      <Section>
        <Text variant="title">Enrich company data with additional data from PRH</Text>
        <Text variant="body">
          Upload a CSV with a business ID column (business_id or y-tunnus), a company name column (name, company_name or
          nimi), or both. Rows are matched by business ID when one is given, otherwise by exact company name.
        </Text>
        <Text variant="body">
          Requests to PRH are spaced about a second apart to stay under its rate limit, so expect roughly one second per
          row: a 50 row file takes about a minute.
        </Text>

        <CsvDropzone
          file={file}
          disabled={loading}
          onFileSelect={(selected) => {
            setFile(selected)
            setState({ status: 'idle' })
          }}
        />

        <SubmitButton type="button" disabled={!file || loading} onClick={handleSubmit}>
          {loading ? 'Fetching… (about 1 s per row)' : 'Fetch data'}
        </SubmitButton>

        {state.status === 'error' && <Text variant="error">{state.message}</Text>}

        {state.status === 'done' && (
          <>
            <Text variant="body">
              {state.result.matchedCount} of {state.result.total} rows matched exactly. {state.result.errorCount} need
              attention.
            </Text>
            <ResultsTabs matches={state.result.matches} errors={state.result.errors} records={state.result.companies} />
          </>
        )}
      </Section>
    </PageTemplate>
  )
}

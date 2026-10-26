import { useState } from 'react'
import styled from 'styled-components'
import type { Company, CompanyRecord, RowError } from '../../../api/matchCompanies'
import { TabBar } from '../../molecules/TabBar/TabBar'
import { ErrorList } from '../ErrorList/ErrorList'
import { RecordList } from '../RecordList/RecordList'
import { ResultList } from '../ResultList/ResultList'

type TabId = 'results' | 'records' | 'errors'

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.md};
  min-height: 0;
`

const Panel = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`

type ResultsTabsProps = { matches: Company[]; records: CompanyRecord[]; errors: RowError[] }

export function ResultsTabs({ matches, records, errors }: ResultsTabsProps) {
  const [selected, setSelected] = useState<TabId>(errors.length > 0 ? 'errors' : 'results')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'results', label: `Results (${matches.length})` },
    { id: 'records', label: `Company records (${records.length})` },
    { id: 'errors', label: `Errors (${errors.length})` },
  ]

  return (
    <Wrapper>
      <TabBar label="Upload outcome" tabs={tabs} selectedId={selected} onSelect={setSelected} />
      <Panel role="tabpanel" id={`panel-${selected}`} aria-labelledby={`tab-${selected}`}>
        {selected === 'records' ? (
          <RecordList records={records} />
        ) : selected === 'results' ? (
          <ResultList companies={matches} />
        ) : (
          <ErrorList errors={errors} />
        )}
      </Panel>
    </Wrapper>
  )
}

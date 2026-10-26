import styled from 'styled-components'
import type { Address, Company, CompanySituation } from '../../../api/matchCompanies'
import { Link } from '../../atoms/Link/Link'
import { Text } from '../../atoms/Text/Text'
import { DataTable } from '../DataTable/DataTable'

const HEADERS = [
  'Name',
  'Business ID',
  'VAT number',
  'Legal form',
  'Main business line',
  'Addresses',
  'Website',
  'Status',
  'Last modified',
]

const Lines = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space.xs};
  margin: 0;
  padding: 0;
  list-style: none;
`

// Same helpers as server/src/companyMapping.ts; the two packages share no code on purpose.
// PRH sends cities in capitals ("HELSINKI")
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())

function formatAddress(a: Address): string {
  const street = [a.address, a.entrance, a.apartment].filter(Boolean).join(' ')
  const place = [a.postcode, a.city ? titleCase(a.city) : null].filter(Boolean).join(' ')
  return [a.co ? `c/o ${a.co}` : null, street, a.postOfficeBox, place].filter(Boolean).join(', ')
}

const SITUATION_LABELS: Record<CompanySituation, string> = {
  KONK: 'bankruptcy',
  SELTILA: 'liquidation',
  SANE: 'restructuring',
}

function describeStatus(company: Company): string {
  return [company.active ? 'Active' : 'Inactive', ...company.situations.map((s) => SITUATION_LABELS[s])].join(', ')
}

// A company often registers the same place as street and mailing address: show it once
function describeAddresses(addresses: Address[]): { text: string; label: string }[] {
  const kinds = new Map<string, Set<string>>()
  for (const a of addresses) {
    const text = formatAddress(a)
    if (!text) continue
    const set = kinds.get(text) ?? new Set<string>()
    set.add(a.isMailingAddress ? 'mailing' : 'street')
    kinds.set(text, set)
  }
  return [...kinds].map(([text, set]) => ({ text, label: [...set].join(' and ') }))
}

function legalForm(company: Company): string {
  const form = company.companyForm
  if (!form) return '—'
  if (form.shorthand && form.description) return `${form.shorthand} (${form.description})`
  return form.shorthand ?? form.description ?? '—'
}

const toHref = (website: string) => (/^https?:\/\//i.test(website) ? website : `https://${website}`)

export function ResultList({ companies }: { companies: Company[] }) {
  if (companies.length === 0) {
    return <Text variant="body">No companies were matched.</Text>
  }

  return (
    <DataTable
      label="Matched companies"
      headers={HEADERS}
      minWidth="1200px"
      rows={companies.map((company, index) => {
        const addresses = describeAddresses(company.addresses)
        return {
          key: `${company.businessId}-${index}`,
          cells: [
            company.name,
            company.businessId,
            company.vatNumber ?? '—',
            legalForm(company),
            company.mainBusinessLine
              ? `${company.mainBusinessLine.type} ${company.mainBusinessLine.description ?? ''}`.trim()
              : '—',
            addresses.length > 0 ? (
              <Lines>
                {addresses.map(({ text, label }) => (
                  <li key={text}>
                    {text} <Text variant="caption">({label})</Text>
                  </li>
                ))}
              </Lines>
            ) : (
              '—'
            ),
            company.website ? (
              <Link href={toHref(company.website)} target="_blank" rel="noopener noreferrer">
                {company.website}
              </Link>
            ) : (
              '—'
            ),
            describeStatus(company),
            company.lastModified ? company.lastModified.slice(0, 10) : '—',
          ],
        }
      })}
    />
  )
}

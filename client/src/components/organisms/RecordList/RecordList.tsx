import type { CompanyAddress, CompanyRecord } from '../../../api/matchCompanies'
import { Link } from '../../atoms/Link/Link'
import { Text } from '../../atoms/Text/Text'
import { DataTable } from '../DataTable/DataTable'

const HEADERS = [
  'Business ID',
  'Company name',
  'Inactive',
  'VAT number',
  'Web address',
  'Legal form',
  'Industry',
  'Billing address',
  'Shipping address',
  'Situation',
  'Registry updated',
]

type RecordAddress = CompanyAddress['addressBookAddress']

const formatAddress = (a: RecordAddress | undefined) =>
  a ? [a.addr2, a.addr1, [a.zip, a.city].filter(Boolean).join(' '), a.country].filter(Boolean).join(', ') : '—'

export function RecordList({ records }: { records: CompanyRecord[] }) {
  if (records.length === 0) {
    return <Text variant="body">No company records were created.</Text>
  }

  return (
    <DataTable
      label="Mapped company records"
      headers={HEADERS}
      minWidth="1500px"
      rows={records.map((r, index) => ({
        key: `${r.businessId}-${index}`,
        cells: [
          r.businessId,
          r.companyName,
          r.isInactive ? 'Yes' : 'No',
          r.vatRegNumber ?? '—',
          r.url ? (
            <Link href={r.url} target="_blank" rel="noopener noreferrer">
              {r.url}
            </Link>
          ) : (
            '—'
          ),
          [r.custentity_legal_form, r.custentity_legal_form_desc].filter(Boolean).join(' · ') || '—',
          [r.custentity_industry_code, r.custentity_industry_desc].filter(Boolean).join(' ') || '—',
          formatAddress(r.addressBook.find((e) => e.defaultBilling)?.addressBookAddress),
          formatAddress(r.addressBook.find((e) => e.defaultShipping)?.addressBookAddress),
          r.custentity_company_situation ?? '—',
          r.custentity_registry_updated ? r.custentity_registry_updated.slice(0, 10) : '—',
        ],
      }))}
    />
  )
}

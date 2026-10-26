export type Address = {
  address: string | null
  postcode: string | null
  city: string | null
  entrance: string | null
  apartment: string | null
  postOfficeBox: string | null
  co: string | null
  country: string | null
  isMailingAddress: boolean
}

export type Company = {
  name: string
  businessId: string
  addresses: Address[]
  website: string | null
  companyForm: { shorthand: string | null; description: string | null } | null
  mainBusinessLine: { type: string; description: string | null } | null
  lastModified: string | null
  active: boolean
  situations: CompanySituation[]
  vatNumber: string | null
}

export type CompanyAddress = {
  defaultBilling: boolean
  defaultShipping: boolean
  addressBookAddress: {
    addressee: string
    addr1: string
    addr2: string | null
    city: string | null
    zip: string | null
    country: string
  }
}

export type CompanyRecord = {
  businessId: string
  isPerson: false
  companyName: string
  isInactive: boolean
  vatRegNumber: string | null
  url: string | null
  addressBook: CompanyAddress[]
  custentity_legal_form: string | null
  custentity_legal_form_desc: string | null
  custentity_industry_code: string | null
  custentity_industry_desc: string | null
  custentity_company_situation: string | null
  custentity_registry_updated: string | null
}

export type ErrorCode =
  | 'invalid_business_id'
  | 'not_found'
  | 'name_mismatch'
  | 'no_exact_match'
  | 'ambiguous_name'
  | 'no_identifier'
  | 'lookup_failed'

export type CompanySituation = 'SANE' | 'SELTILA' | 'KONK'
export type Candidate = { businessId: string; name: string; active: boolean; score: number }
export type RowInput = { business_id: string; name: string }

export type RowError = {
  row: number
  input: RowInput
  code: ErrorCode
  message: string
  candidates?: Candidate[]
}

export type MatchResponse = {
  total: number
  matchedCount: number
  errorCount: number
  matches: Company[]
  errors: RowError[]
  companies: CompanyRecord[]
}

export async function matchCompanies(file: File): Promise<MatchResponse> {
  const body = new FormData()
  body.append('file', file)

  const res = await fetch('/api/companies/match', { method: 'POST', body })

  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => (b as { error?: string }).error)
      .catch(() => undefined)
    throw new Error(message ?? `Upload failed (HTTP ${res.status})`)
  }
  return (await res.json()) as MatchResponse
}

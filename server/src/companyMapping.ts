import type { NormalizedAddress, NormalizedCompany } from './prhCompanies.js'

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

// Client and server are separate packages, so titleCase and toUrl are repeated in the client's ResultList on purpose.
// PRH sends city names in capitals ("HELSINKI"); company records read better in normal case
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())

// PRH stores websites without a scheme ("www.dynava.fi")
function toUrl(website: string | null): string | null {
  const w = website?.trim()
  if (!w) return null
  return /^https?:\/\//i.test(w) ? w : `https://${w}`
}

// "Katu 7 A 12": street, number, entrance, apartment
const streetLine = (a: NormalizedAddress) => [a.address, a.entrance, a.apartment].filter(Boolean).join(' ')

// A PO box can take an invoice, so it counts as an address line when there is no street
const addr1Of = (a: NormalizedAddress) => streetLine(a) || a.postOfficeBox || ''

const coLine = (a: NormalizedAddress) => (!a.co ? null : /^c\/o\b/i.test(a.co) ? a.co : `c/o ${a.co}`)

const sameAddress = (a: NormalizedAddress, b: NormalizedAddress) =>
  addr1Of(a) === addr1Of(b) && a.postcode === b.postcode && a.city === b.city

function toAddressBook(company: NormalizedCompany): CompanyAddress[] {
  const usable = company.addresses.filter((a) => addr1Of(a))
  const mailing = usable.find((a) => a.isMailingAddress)
  const visiting = usable.find((a) => !a.isMailingAddress && streetLine(a))

  // Invoices go to the mailing address (a PO box is fine); deliveries need a street address
  const billing = mailing ?? visiting
  const shipping = visiting ?? (mailing && streetLine(mailing) ? mailing : undefined)
  if (!billing) return []

  const entry = (a: NormalizedAddress, defaultBilling: boolean, defaultShipping: boolean): CompanyAddress => ({
    defaultBilling,
    defaultShipping,
    addressBookAddress: {
      addressee: company.name,
      addr1: addr1Of(a),
      addr2: coLine(a),
      city: a.city ? titleCase(a.city) : null,
      zip: a.postcode,
      country: a.country ?? 'FI',
    },
  })

  if (!shipping) return [entry(billing, true, false)] // PO box only: no delivery address
  return sameAddress(billing, shipping)
    ? [entry(billing, true, true)]
    : [entry(billing, true, false), entry(shipping, false, true)]
}

export function toCompanyRecord(company: NormalizedCompany): CompanyRecord {
  return {
    businessId: company.businessId,
    isPerson: false,
    companyName: company.name,
    isInactive: !company.active,
    vatRegNumber: company.vatNumber,
    url: toUrl(company.website),
    addressBook: toAddressBook(company),
    custentity_legal_form: company.companyForm?.shorthand ?? null,
    custentity_legal_form_desc: company.companyForm?.description ?? null,
    custentity_industry_code: company.mainBusinessLine?.type ?? null,
    custentity_industry_desc: company.mainBusinessLine?.description ?? null,
    custentity_company_situation: company.situations.length > 0 ? company.situations.join(',') : null,
    custentity_registry_updated: company.lastModified,
  }
}

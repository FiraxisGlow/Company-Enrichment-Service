const BASE_URL = 'https://avoindata.prh.fi/opendata-ytj-api/v3/companies'

type Description = { languageCode: string; description: string }

export type ApiCompany = {
  businessId: { value: string }
  euId?: { value: string }
  names?: { name: string; type: string; registrationDate?: string; endDate?: string }[]
  mainBusinessLine?: { type: string; descriptions?: Description[] }
  website?: { url: string }
  companyForms?: { type: string; descriptions?: Description[]; endDate?: string }[]
  addresses?: {
    type: number
    street?: string
    buildingNumber?: string
    entrance?: string
    apartmentNumber?: string
    apartmentIdSuffix?: string
    postCode?: string
    postOfficeBox?: string
    co?: string
    country?: string
    freeAddressLine?: string
    postOffices?: { city: string; languageCode: string }[]
  }[]
  companySituations?: { type: 'SANE' | 'SELTILA' | 'KONK'; endDate?: string }[]
  registeredEntries?: { type: string; register: string; endDate?: string }[]
  status?: string
  tradeRegisterStatus?: string
  registrationDate?: string
  endDate?: string
  lastModified?: string
}

export type CompanySituation = 'SANE' | 'SELTILA' | 'KONK' // restructuring, liquidation, bankruptcy

export type NormalizedAddress = {
  address: string | null // street and building number, or the free-form line of a foreign address
  postcode: string | null
  city: string | null
  entrance: string | null
  apartment: string | null
  postOfficeBox: string | null // e.g. "PL 10"
  co: string | null
  country: string | null // two-letter code; null when the register does not state one
  isMailingAddress: boolean
}

export type NormalizedCompany = {
  name: string
  businessId: string
  addresses: NormalizedAddress[]
  website: string | null
  companyForm: { shorthand: string | null; description: string | null } | null
  mainBusinessLine: { type: string; description: string | null } | null
  lastModified: string | null
  active: boolean // no cessation date, and no open liquidation or bankruptcy
  situations: CompanySituation[] // open ones
  vatNumber: string | null
}

export type SearchResult = {
  companies: ApiCompany[]
  totalResults: number
  truncated: boolean // true when the page cap stopped the search before all results were read
}

const MAX_PAGES = 10 // safety cap: 10 pages = up to 1,000 results per search
const MIN_INTERVAL_MS = 1000 // spacing between request starts, shared by every upload
const MAX_ATTEMPTS = 5
const COOLDOWN_CAP_MS = 30000
const TRIP_MS = 60000 // after a request gives up, fail fast for this long

let nextStart = 0 // earliest time the next request may begin
let blockedUntil = 0 // set when the API pushes back; every request waits for it
let trippedUntil = 0 // set when a request used up all its retries

// Resolves after ms, or rejects as soon as the signal aborts
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

async function waitForTurn(signal: AbortSignal): Promise<void> {
  for (;;) {
    signal.throwIfAborted()
    const now = Date.now()
    if (now < blockedUntil) {
      await sleep(blockedUntil - now, signal)
      continue
    }
    const start = Math.max(now, nextStart)
    nextStart = start + MIN_INTERVAL_MS
    if (start > now) await sleep(start - now, signal)
    if (Date.now() >= blockedUntil) return
  }
}

// Pauses every request, not just the failing one
function backOff(attempt: number, retryAfterMs?: number) {
  const delay = retryAfterMs ?? Math.min(2000 * 2 ** attempt, COOLDOWN_CAP_MS)
  blockedUntil = Math.max(blockedUntil, Date.now() + delay)
}

async function fetchPage(params: Record<string, string>, page: number, signal: AbortSignal) {
  const url = `${BASE_URL}?${new URLSearchParams({ ...params, page: String(page) })}`
  let lastReason = 'unknown error'

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    signal.throwIfAborted()
    if (Date.now() < trippedUntil) {
      throw new Error('PRH API is rate limiting requests. Try again in a minute.')
    }
    await waitForTurn(signal)

    let res: Response
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      })
    } catch (err) {
      if (signal.aborted) throw signal.reason // the upload was stopped, not a network problem

      const code = (err as { cause?: { code?: string } }).cause?.code
      lastReason = code ? `network error ${code}` : (err as Error).message
      backOff(attempt)
      continue
    }

    if (res.ok) {
      const body = (await res.json()) as { totalResults?: number; companies?: ApiCompany[] }
      return { totalResults: body.totalResults ?? 0, companies: body.companies ?? [] }
    }

    if (res.status === 429 || res.status >= 500) {
      lastReason = `HTTP ${res.status}`
      const retryAfter = Number(res.headers.get('retry-after'))
      backOff(attempt, retryAfter > 0 ? Math.min(retryAfter * 1000, COOLDOWN_CAP_MS) : undefined)
      continue
    }

    // 400 and anything else: surface PRH's own message when there is one
    const detail = await res
      .json()
      .then((b) => (b as { message?: string }).message)
      .catch(() => undefined)
    throw new Error(`PRH API returned HTTP ${res.status}${detail ? `: ${detail}` : ''}`)
  }

  trippedUntil = Date.now() + TRIP_MS // stop the rest of the batch from waiting on a dead API
  throw new Error(`PRH API unavailable after ${MAX_ATTEMPTS} attempts (${lastReason})`)
}

export async function fetchAllCompanies(params: Record<string, string>, signal: AbortSignal): Promise<SearchResult> {
  const all: ApiCompany[] = []
  const seen = new Set<string>()
  let totalResults = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(params, page, signal)
    if (page === 1) totalResults = result.totalResults

    // Past the last page the API has been seen to return an empty list (its docs say page 1). Both end the loop:
    // a page with nothing new means we're done, so this does not depend on either behaviour.
    const fresh = result.companies.filter((company) => !seen.has(company.businessId.value))
    if (fresh.length === 0) break

    for (const company of fresh) {
      seen.add(company.businessId.value)
      all.push(company)
    }
    if (all.length >= totalResults) break
  }

  return { companies: all, totalResults, truncated: all.length < totalResults }
}

// Description arrays carry fi/sv/en text: prefer Finnish (1), then English (3)
const pick = (ds?: Description[]) =>
  ds?.find((d) => d.languageCode === '1')?.description ??
  ds?.find((d) => d.languageCode === '3')?.description ??
  ds?.[0]?.description ??
  null

export function currentName(company: ApiCompany): string {
  const official = (company.names ?? []).filter((n) => n.type === '1')
  const current =
    official.find((n) => !n.endDate) ??
    [...official].sort((a, b) => (b.registrationDate ?? '').localeCompare(a.registrationDate ?? ''))[0]
  return current?.name ?? company.names?.[0]?.name ?? ''
}

// Company forms (PRH code list YRMU, Finnish):
// https://avoindata.prh.fi/opendata-ytj-api/v3/description?code=YRMU&lang=fi
const COMPANY_FORMS: Record<string, { shorthand: string; description: string }> = {
  '2': { shorthand: 'AOY', description: 'Asunto-osakeyhtiö' },
  '3': { shorthand: 'ASH', description: 'Asukashallintoalue' },
  '4': { shorthand: 'ASY', description: 'Asumisoikeusyhdistys' },
  '5': { shorthand: 'AY', description: 'Avoin yhtiö' },
  '6': { shorthand: 'AYH', description: 'Aatteellinen yhdistys' },
  '7': { shorthand: 'ETS', description: 'Euroopp.taloudell.etuyht.sivutoimipaikka' },
  '8': { shorthand: 'ETY', description: 'Eurooppalainen taloudellinen etuyhtymä' },
  '9': { shorthand: 'HY', description: 'Hypoteekkiyhdistys' },
  '10': { shorthand: 'KOY', description: 'Keskinäinen kiinteistöosakeyhtiö' },
  '11': { shorthand: 'KVJ', description: 'Julkinen keskinäinen vakuutusyhtiö' },
  '12': { shorthand: 'KVY', description: 'Keskinäinen vakuutusyhtiö' },
  '13': { shorthand: 'KY', description: 'Kommandiittiyhtiö' },
  '14': { shorthand: 'OK', description: 'Osuuskunta' },
  '15': { shorthand: 'OP', description: 'Osuuspankki' },
  '16': { shorthand: 'OY', description: 'Osakeyhtiö' },
  '17': { shorthand: 'OYJ', description: 'Julkinen osakeyhtiö' },
  '18': { shorthand: 'SÄÄ', description: 'Säätiö' },
  '19': { shorthand: 'SL', description: 'Sivuliike' },
  '20': { shorthand: 'SP', description: 'Säästöpankki' },
  '21': { shorthand: 'TYH', description: 'Taloudellinen yhdistys' },
  '22': { shorthand: 'VALTLL', description: 'Valtion liikelaitos' },
  '23': { shorthand: 'VOJ', description: 'Julkinen vakuutusosakeyhtiö' },
  '24': { shorthand: 'VOY', description: 'Vakuutusosakeyhtiö' },
  '25': { shorthand: 'VY', description: 'Vakuutusyhdistys' },
  '80': { shorthand: 'SE', description: 'Eurooppayhtiö' },
  '83': { shorthand: 'SCE', description: 'Eurooppaosuuskunta' },
  '84': { shorthand: 'SCP', description: 'Eurooppaosuuspankki' },
}

const clean = (s?: string | null) => s?.replace(/\s+/g, ' ').trim() || null

// The register stores the box number alone ("10"); show it the Finnish way
const poBox = (box?: string | null) => {
  const b = box?.trim()
  if (!b) return null
  return /^\d/.test(b) ? `PL ${b}` : b
}

const openSituations = (company: ApiCompany): CompanySituation[] =>
  (company.companySituations ?? []).filter((s) => !s.endDate).map((s) => s.type)

// Inactive when ceased, or in liquidation or bankruptcy. Restructuring (SANE) still trades, so it counts as active
export function isActive(company: ApiCompany): boolean {
  return !company.endDate && !openSituations(company).some((s) => s === 'KONK' || s === 'SELTILA')
}

export function normalizeCompany(company: ApiCompany): NormalizedCompany {
  const forms = company.companyForms ?? []
  const form = forms.find((f) => !f.endDate) ?? forms[0]
  // An open entry in the VAT register (register "6") means the company is VAT-registered
  const vatRegistered = (company.registeredEntries ?? []).some((e) => e.register === '6' && !e.endDate)

  return {
    name: currentName(company),
    businessId: company.businessId.value,
    addresses: (company.addresses ?? []).map((a) => ({
      address:
        clean([a.street, a.buildingNumber].filter(Boolean).join(' ')) ?? clean(a.freeAddressLine?.replace(/_/g, ' ')), // foreign addresses: spaces are underscores
      postcode: a.postCode || null,
      city: a.postOffices?.find((p) => p.languageCode === '1')?.city ?? a.postOffices?.[0]?.city ?? null,
      entrance: a.entrance || null,
      apartment: clean([a.apartmentNumber, a.apartmentIdSuffix].filter(Boolean).join(' ')),
      postOfficeBox: poBox(a.postOfficeBox),
      co: clean(a.co),
      country: a.country || null,
      isMailingAddress: a.type === 2,
    })),
    website: company.website?.url ?? null,
    companyForm: form
      ? {
          shorthand: COMPANY_FORMS[form.type]?.shorthand ?? null,
          description: COMPANY_FORMS[form.type]?.description ?? pick(form.descriptions),
        }
      : null,
    mainBusinessLine: company.mainBusinessLine
      ? { type: company.mainBusinessLine.type, description: pick(company.mainBusinessLine.descriptions) }
      : null,
    lastModified: company.lastModified ?? null,
    active: isActive(company),
    situations: openSituations(company),
    vatNumber: vatRegistered ? `FI${company.businessId.value.replace('-', '')}` : null,
  }
}

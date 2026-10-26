import { parse } from 'csv-parse/sync'
import { normalizeBusinessId } from './businessId.js'
import {
  currentName,
  fetchAllCompanies,
  isActive,
  normalizeCompany,
  type ApiCompany,
  type NormalizedCompany,
  type SearchResult,
} from './prhCompanies.js'

export class InputError extends Error {}

const MAX_ROWS = 150 // each row is a live API call
const CONCURRENCY = 5 // be polite to the public API
const SUGGESTION_MIN = 0.5 // minimum similarity to list a company as a candidate

// Headers are normalised (lowercase, no spaces/underscores/hyphens) before comparing
const ID_HEADERS = ['businessid', 'ytunnus']
const NAME_HEADERS = ['name', 'companyname', 'company', 'nimi', 'yritys', 'toiminimi']

type RowInput = { business_id: string; name: string }

export type Candidate = { businessId: string; name: string; active: boolean; score: number }

export type RowError = {
  row: number
  input: RowInput
  code:
    | 'invalid_business_id'
    | 'not_found'
    | 'no_exact_match'
    | 'ambiguous_name'
    | 'no_identifier'
    | 'lookup_failed'
    | 'name_mismatch'
  message: string
  candidates?: Candidate[]
}

export type MatchResult = { matches: NormalizedCompany[]; errors: RowError[] }

type ParsedRow = { row: number; businessId: string; name: string }
type Lookup = (params: Record<string, string>) => Promise<SearchResult>
type Outcome = { match: NormalizedCompany } | { error: RowError }

// ---------- CSV parsing ----------

// Finnish Excel exports often use ";" so detect the delimiter from the header line
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const counts = [',', ';', '\t'].map((d) => [d, firstLine.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  const best = counts[0]
  return best && best[1] > 0 ? best[0] : ','
}

function parseCsv(buffer: Buffer): ParsedRow[] {
  const text = buffer.toString('utf8')
  if (text.includes('\uFFFD')) {
    throw new InputError('File is not valid UTF-8. Export the CSV as UTF-8 (CSV UTF-8 in Excel).')
  }

  let records: { record: Record<string, string>; info: { lines: number } }[]
  try {
    records = parse(text, {
      columns: (header: string[]) =>
        header.map((h) =>
          h
            .trim()
            .toLowerCase()
            .replace(/[\s_-]+/g, ''),
        ),
      delimiter: detectDelimiter(text),
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      info: true, // gives each record its real line number, even after blank lines
    })
  } catch (err) {
    throw new InputError(`Could not parse CSV: ${(err as Error).message}`)
  }

  const first = records[0]?.record
  if (!first) throw new InputError('CSV has no data rows')
  if (records.length > MAX_ROWS) throw new InputError(`Too many rows (max ${MAX_ROWS})`)

  const headers = Object.keys(first)
  const idCol = ID_HEADERS.find((h) => headers.includes(h))
  const nameCol = NAME_HEADERS.find((h) => headers.includes(h))
  if (!idCol && !nameCol) {
    throw new InputError(
      'CSV needs a business ID column (business_id / y-tunnus) and/or a name column (name / company_name / nimi)',
    )
  }

  return records.map(({ record: r, info }) => ({
    row: info.lines,
    businessId: ((idCol && r[idCol]) || '').trim(),
    name: ((nameCol && r[nameCol]) || '').replace(/\s+/g, ' ').trim(),
  }))
}

// ---------- Name comparison ----------

// Exact comparison ignores case and whitespace only (punctuation still counts)
function normalizeName(s: string): string {
  return s.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Sørensen–Dice coefficient on character bigrams (0 to 1); only used to suggest candidates
function dice(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) return 0
  const grams = (s: string) => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2)
      m.set(g, (m.get(g) ?? 0) + 1)
    }
    return m
  }
  const A = grams(a)
  const B = grams(b)
  let overlap = 0
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0)
  return (2 * overlap) / (a.length - 1 + (b.length - 1))
}

// 1 = exact match on any of the company's names; below 1 = similarity only
function bestNameScore(company: ApiCompany, wanted: string): number {
  let best = 0
  for (const n of company.names ?? []) {
    const candidate = normalizeName(n.name)
    const score = candidate === wanted ? 1 : Math.min(dice(candidate, wanted), 0.99)
    if (score > best) best = score
  }
  return best
}

const toCandidate = (company: ApiCompany, score: number): Candidate => ({
  businessId: company.businessId.value,
  name: currentName(company),
  active: isActive(company),
  score: Math.round(score * 100) / 100,
})

// ---------- Matching ----------

async function resolveRow(row: ParsedRow, lookup: Lookup): Promise<Outcome> {
  const input: RowInput = { business_id: row.businessId, name: row.name }

  const fail = (code: RowError['code'], message: string, candidates?: Candidate[]): Outcome => ({
    error: { row: row.row, input, code, message, ...(candidates && { candidates }) },
  })

  // A business ID, when present, is matched by ID only
  if (row.businessId) {
    const norm = normalizeBusinessId(row.businessId)
    if (!norm.ok) return fail('invalid_business_id', norm.reason)

    const { companies } = await lookup({ businessId: norm.value })
    const found = companies.find((company) => company.businessId.value === norm.value)
    if (!found) return fail('not_found', `No company with business ID ${norm.value}`)
    // A name next to the ID must agree with the register, otherwise the ID may be a typo for another company
    if (row.name) {
      const score = bestNameScore(found, normalizeName(row.name))
      if (score < 1) {
        return fail(
          'name_mismatch',
          `Business ID ${norm.value} belongs to ${currentName(found)}, which does not match the name in the file`,
          [toCandidate(found, score)],
        )
      }
    }
    return { match: normalizeCompany(found) }
  }

  if (!row.name) return fail('no_identifier', 'Row has neither a business ID nor a company name')

  const { companies, totalResults, truncated } = await lookup({ name: row.name })
  const scope = truncated ? ` Only the first ${companies.length} of ${totalResults} search results were checked.` : ''

  const wanted = normalizeName(row.name)
  const scored = companies
    .map((company) => ({ company, score: bestNameScore(company, wanted) }))
    .sort((a, b) => b.score - a.score)

  // Exact name matches
  let exact = scored.filter((s) => s.score === 1)
  if (exact.length > 1) {
    const active = exact.filter((s) => isActive(s.company))
    if (active.length === 1) exact = active // prefer the one still operating
  }

  const only = exact.length === 1 ? exact[0] : undefined
  if (only) return { match: normalizeCompany(only.company) }

  if (exact.length > 1) {
    return fail(
      'ambiguous_name',
      'Several companies have exactly this name, use a business ID instead',
      exact.slice(0, 5).map((s) => toCandidate(s.company, s.score)),
    )
  }

  // No exact match: report similar companies as errors, never as matches
  const candidates = scored
    .filter((s) => s.score >= SUGGESTION_MIN)
    .slice(0, 3)
    .map((s) => toCandidate(s.company, s.score))

  if (candidates.length === 0) return fail('not_found', `No company found with this name.${scope}`)
  return fail('no_exact_match', `No exact name match. Closest companies are listed as candidates.${scope}`, candidates)
}

async function mapLimit(count: number, limit: number, fn: (index: number) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, count) }, async () => {
    while (next < count) {
      const index = next++
      await fn(index)
    }
  })
  await Promise.all(workers)
}

export async function matchCsv(buffer: Buffer, signal: AbortSignal): Promise<MatchResult> {
  const rows = parseCsv(buffer)
  const outcomes: (Outcome | undefined)[] = new Array(rows.length)

  // Identical lookups within one file only hit the API once
  const cache = new Map<string, Promise<SearchResult>>()
  const lookup: Lookup = (params) => {
    const key = new URLSearchParams(params).toString()
    let p = cache.get(key)
    if (!p) {
      p = fetchAllCompanies(params, signal)
      cache.set(key, p)
    }
    return p
  }

  await mapLimit(rows.length, CONCURRENCY, async (i) => {
    const row = rows[i]
    if (!row) return

    try {
      outcomes[i] = await resolveRow(row, lookup)
    } catch (err) {
      // One failing row shouldn't sink the whole upload
      outcomes[i] = {
        error: {
          row: row.row,
          input: { business_id: row.businessId, name: row.name },
          code: 'lookup_failed',
          message: signal.aborted
            ? 'Not reached: the upload took too long or the connection closed'
            : (err as Error).message,
        },
      }
    }
  })

  const matches: NormalizedCompany[] = []
  const errors: RowError[] = []
  for (const o of outcomes) {
    if (!o) continue
    if ('match' in o) matches.push(o.match)
    else errors.push(o.error)
  }
  return { matches, errors }
}

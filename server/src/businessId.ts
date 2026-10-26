export type BusinessIdResult = { ok: true; value: string } | { ok: false; reason: string }

// Weights for the Finnish Y-tunnus check digit
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2]

function hasValidCheckDigit(digits: string): boolean {
  const sum = WEIGHTS.reduce((acc, w, i) => acc + w * Number(digits[i]), 0)
  const remainder = sum % 11
  if (remainder === 1) return false
  const check = remainder === 0 ? 0 : 11 - remainder
  return check === Number(digits[7])
}

// Accepts "0100002-9", "100002-9" (missing leading zero), "01000029", "FI01000029"
export function normalizeBusinessId(input: string): BusinessIdResult {
  const digits = input.trim().toUpperCase().replace(/^FI/, '').replace(/\D/g, '')
  let full: string
  if (digits.length === 8) full = digits
  else if (digits.length === 7) full = '0' + digits
  else return { ok: false, reason: 'Business ID must have 7 digits, a hyphen and a check digit' }

  if (!hasValidCheckDigit(full)) return { ok: false, reason: 'Invalid check digit' }
  return { ok: true, value: `${full.slice(0, 7)}-${full[7]}` }
}

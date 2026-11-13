const SIDES = new Set(['buy', 'sell']);
const CURRENCIES = new Set(['ILS', 'USD', 'EUR', 'GBP', 'HKD']);
const SOURCES = new Set(['broker_screenshot', 'trade_confirmation', 'manual']);
const isFinitePositive = n => typeof n === 'number' && Number.isFinite(n) && n > 0;
const isFiniteNonNegative = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Strictly validate an OCR/manual candidate. It is never an instruction to persist it. */
export function validateTransactionCandidate(candidate) {
  const errors = [];
  const add = (field, code) => errors.push({ field, code });
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { valid: false, errors: [{ field: 'candidate', code: 'not_object' }] };
  }
  if (typeof candidate.symbol !== 'string' || !/^[A-Z0-9.-]{1,20}$/i.test(candidate.symbol.trim())) add('symbol', 'invalid_symbol');
  if (typeof candidate.name !== 'string' || candidate.name.trim().length > 120) add('name', 'invalid_name');
  if (!SIDES.has(candidate.side)) add('side', 'invalid_side');
  if (!isFinitePositive(candidate.quantity)) add('quantity', 'invalid_quantity');
  if (!isFinitePositive(candidate.unitPrice)) add('unitPrice', 'invalid_unit_price');
  if (!CURRENCIES.has(candidate.currency)) add('currency', 'unsupported_currency');
  if (candidate.fees !== undefined && !isFiniteNonNegative(candidate.fees)) add('fees', 'invalid_fees');
  if (typeof candidate.executedAt !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2})?(Z|[+-]\\d{2}:\\d{2})$/.test(candidate.executedAt) || Number.isNaN(Date.parse(candidate.executedAt)) || new Date(`${candidate.executedAt.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== candidate.executedAt.slice(0, 10)) add('executedAt', 'invalid_datetime');
  if (!SOURCES.has(candidate.source)) add('source', 'invalid_source');
  if (candidate.broker !== undefined && (typeof candidate.broker !== 'string' || candidate.broker.length > 100)) add('broker', 'invalid_broker');
  if (candidate.confidence !== undefined && (typeof candidate.confidence !== 'number' || candidate.confidence < 0 || candidate.confidence > 1)) add('confidence', 'invalid_confidence');
  if (candidate.rawText !== undefined && (typeof candidate.rawText !== 'string' || candidate.rawText.length > 12000)) add('rawText', 'invalid_raw_text');
  return { valid: errors.length === 0, errors };
}

/** Reject locale-ambiguous OCR numbers instead of guessing what a comma means. */
export function parseUnambiguousNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? { ok: true, value } : { ok: false, reason: 'not_finite' };
  if (typeof value !== 'string') return { ok: false, reason: 'not_numeric_text' };
  const normalized = value.trim().replace(/[\\s₪$€£]/g, '');
  if (!/^-?\\d+(?:\\.\\d+)?$/.test(normalized)) return { ok: false, reason: 'ambiguous_or_invalid_format' };
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? { ok: true, value: parsed } : { ok: false, reason: 'not_finite' };
}

/** Stable review fingerprint. A match is a duplicate warning, not an automatic rejection. */
export function transactionFingerprint(candidate) {
  const checked = validateTransactionCandidate(candidate);
  if (!checked.valid) throw new TypeError('Cannot fingerprint an invalid transaction candidate');
  return [candidate.broker?.trim().toLowerCase() ?? 'unknown-broker', candidate.symbol.trim().toUpperCase(), candidate.side, candidate.quantity, candidate.unitPrice, candidate.currency, new Date(candidate.executedAt).toISOString()].join('|');
}

export function prepareTransactionForReview(candidate, existingFingerprints = []) {
  const validation = validateTransactionCandidate(candidate);
  if (!validation.valid) return { status: 'rejected', validation, candidate: null };
  const fingerprint = transactionFingerprint(candidate);
  return {
    status: 'pending_review',
    validation,
    fingerprint,
    possibleDuplicate: existingFingerprints.includes(fingerprint),
    candidate: {
      ...candidate,
      symbol: candidate.symbol.trim().toUpperCase(),
      name: candidate.name.trim(),
      broker: candidate.broker?.trim() || null,
      fees: candidate.fees ?? 0,
      confidence: candidate.confidence ?? null,
      reviewRequired: true,
      persistenceAllowed: false
    }
  };
}

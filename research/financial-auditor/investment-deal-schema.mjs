const KINDS = new Set(['fixed', 'declining']);
const CADENCES = new Set(['monthly', 'weekly']);
const CLASSIFICATIONS = new Set(['principal', 'interest', 'mixed', 'unknown']);
const finiteNonNegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const text = (value, max = 500) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

export function validateInvestmentDeals(input) {
  const errors = [];
  const add = (path, code) => errors.push({ path, code });
  if (!Array.isArray(input)) return { valid: false, errors: [{ path: 'investmentDeals', code: 'not_array' }] };
  if (input.length > 20) add('investmentDeals', 'too_many_deals');
  const ids = new Set();
  input.forEach((deal, i) => {
    const p = `investmentDeals[${i}]`;
    if (!deal || typeof deal !== 'object' || Array.isArray(deal)) { add(p, 'not_object'); return; }
    if (!text(deal.id, 128)) add(`${p}.id`, 'invalid_id');
    else if (ids.has(deal.id)) add(`${p}.id`, 'duplicate_id');
    else ids.add(deal.id);
    if (!text(deal.title, 200)) add(`${p}.title`, 'invalid_title');
    if (!KINDS.has(deal.kind)) add(`${p}.kind`, 'invalid_kind');
    if (!finiteNonNegative(deal.principal)) add(`${p}.principal`, 'invalid_amount');
    if (!finiteNonNegative(deal.payment)) add(`${p}.payment`, 'invalid_amount');
    if (!CADENCES.has(deal.cadence)) add(`${p}.cadence`, 'invalid_cadence');
    if (!text(deal.dueLabel, 200)) add(`${p}.dueLabel`, 'invalid_due_label');
    if (!Number.isSafeInteger(deal.received) || deal.received < 0) add(`${p}.received`, 'invalid_count');
    if (deal.remaining !== undefined && (!Number.isSafeInteger(deal.remaining) || deal.remaining < 0)) add(`${p}.remaining`, 'invalid_count');
    if (typeof deal.source !== 'string' || deal.source.length > 1000) add(`${p}.source`, 'invalid_source');
    if (!Array.isArray(deal.history) || deal.history.length > 2000) { add(`${p}.history`, 'invalid_history'); return; }
    deal.history.forEach((payment, j) => {
      const q = `${p}.history[${j}]`;
      if (!payment || typeof payment !== 'object' || Array.isArray(payment)) { add(q, 'not_object'); return; }
      if (!finiteNonNegative(payment.amount)) add(`${q}.amount`, 'invalid_amount');
      if (payment.date !== undefined && (typeof payment.date !== 'string' || payment.date.length > 40)) add(`${q}.date`, 'invalid_date_type');
      if (payment.note !== undefined && (typeof payment.note !== 'string' || payment.note.length > 1000)) add(`${q}.note`, 'invalid_note');
      if (payment.classification !== undefined && !CLASSIFICATIONS.has(payment.classification)) add(`${q}.classification`, 'invalid_classification');
      if (payment.classification === 'mixed') {
        const validSplit = finiteNonNegative(payment.principalAmount) && finiteNonNegative(payment.interestAmount) && finiteNonNegative(payment.amount) && Math.abs(payment.principalAmount + payment.interestAmount - payment.amount) < 0.01;
        if (!validSplit) add(q, 'invalid_mixed_allocation');
      }
    });
  });
  return { valid: errors.length === 0, errors };
}

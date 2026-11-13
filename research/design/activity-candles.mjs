const INCLUDED_TYPES = new Set(['income', 'expense', 'fee', 'external_investment', 'deal_receipt', 'deal_funding']);
const EXCLUDED_TYPES = new Set(['internal_transfer', 'valuation_snapshot']);

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function periodKey(date, interval) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  if (interval === 'day') return `${y}-${m}-${d}`;
  if (interval === 'month') return `${y}-${m}`;
  if (interval === 'week') {
    const day = new Date(Date.UTC(y, date.getUTCMonth(), date.getUTCDate()));
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    return day.toISOString().slice(0, 10);
  }
  throw new TypeError('Unsupported interval');
}

function signedAmount(event) {
  const amount = Number(event.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new TypeError('Event amount must be a non-negative finite number');
  if (event.type === 'income' || event.type === 'deal_receipt') return amount;
  if (event.type === 'expense' || event.type === 'fee' || event.type === 'external_investment' || event.type === 'deal_funding') return -amount;
  return 0;
}

/**
 * Creates an illustrative activity index (not a balance or investment return).
 * Each 1,000 currency units of net movement changes the index by 1 point.
 * Only dated, confirmed events in one currency are accepted.
 */
export function buildActivityCandles(events, { currency, interval = 'day', base = 1000, scale = 1000 } = {}) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  if (typeof currency !== 'string' || !currency) throw new TypeError('currency is required');
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(scale) || scale <= 0) throw new TypeError('base and scale must be positive finite numbers');

  const normalized = events.map((event, index) => {
    if (!event || typeof event !== 'object') throw new TypeError('Invalid event');
    if (event.status !== 'confirmed') return null;
    if (EXCLUDED_TYPES.has(event.type)) return null;
    if (!INCLUDED_TYPES.has(event.type)) throw new TypeError(`Unsupported event type: ${event.type}`);
    if (event.currency !== currency) throw new TypeError('Mixed currencies must be converted explicitly before aggregation');
    const date = validDate(event.occurredAt);
    if (!date) throw new TypeError('Every included event needs a valid occurredAt timestamp');
    return { date, key: periodKey(date, interval), delta: signedAmount(event), id: event.id ?? `event-${index}` };
  }).filter(Boolean).sort((a, b) => a.date - b.date || String(a.id).localeCompare(String(b.id)));

  let indexValue = base;
  const buckets = new Map();
  for (const event of normalized) {
    if (!buckets.has(event.key)) buckets.set(event.key, { open: indexValue, high: indexValue, low: indexValue, close: indexValue, eventCount: 0, netMovement: 0, eventIds: [] });
    const candle = buckets.get(event.key);
    indexValue += event.delta / scale;
    candle.high = Math.max(candle.high, indexValue);
    candle.low = Math.min(candle.low, indexValue);
    candle.close = indexValue;
    candle.eventCount += 1;
    candle.netMovement += event.delta;
    candle.eventIds.push(event.id);
  }

  return [...buckets.entries()].map(([period, candle]) => ({
    period, ...candle, currency, metric: 'net_cash_activity_index',
    unit: 'index_points', baseIndex: base, scale, isSimulation: false,
    meaning: 'Illustrative index of confirmed net cash movements; not account balance, asset value, or investment return.'
  }));
}

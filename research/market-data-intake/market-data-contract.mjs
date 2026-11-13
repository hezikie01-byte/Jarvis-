const CURRENCIES = new Set(['ILS', 'USD', 'EUR', 'GBP', 'HKD']);
const STATUSES = new Set(['real_time', 'delayed', 'end_of_day']);

export function validateMarketQuote(quote) {
  const errors = [];
  const add = (field, code) => errors.push({ field, code });
  if (!quote || typeof quote !== 'object' || Array.isArray(quote)) return { valid: false, errors: [{ field: 'quote', code: 'not_object' }] };
  if (typeof quote.symbol !== 'string' || !/^[A-Z0-9.-]{1,20}$/i.test(quote.symbol.trim())) add('symbol', 'invalid_symbol');
  if (typeof quote.exchange !== 'string' || !quote.exchange.trim() || quote.exchange.length > 40) add('exchange', 'invalid_exchange');
  if (typeof quote.provider !== 'string' || !quote.provider.trim() || quote.provider.length > 80) add('provider', 'invalid_provider');
  if (typeof quote.price !== 'number' || !Number.isFinite(quote.price) || quote.price <= 0) add('price', 'invalid_price');
  if (!CURRENCIES.has(quote.currency)) add('currency', 'unsupported_currency');
  if (typeof quote.observedAt !== 'string' || Number.isNaN(Date.parse(quote.observedAt)) || !/(Z|[+-]\d{2}:\d{2})$/.test(quote.observedAt)) add('observedAt', 'invalid_timestamp');
  if (!STATUSES.has(quote.marketDataStatus)) add('marketDataStatus', 'invalid_status');
  return { valid: errors.length === 0, errors };
}

export function assessQuoteFreshness(quote, nowMs = Date.now()) {
  const validation = validateMarketQuote(quote);
  if (!validation.valid) return { usable: false, freshness: 'invalid', validation };
  const ageMs = nowMs - Date.parse(quote.observedAt);
  if (ageMs < -60_000) return { usable: false, freshness: 'future_timestamp', ageMs, validation };
  if (quote.marketDataStatus === 'end_of_day') return { usable: true, freshness: 'end_of_day', ageMs, validation };
  if (quote.marketDataStatus === 'delayed') return { usable: true, freshness: 'delayed', ageMs, validation };
  return { usable: ageMs <= 120_000, freshness: ageMs <= 120_000 ? 'fresh' : 'stale', ageMs, validation };
}

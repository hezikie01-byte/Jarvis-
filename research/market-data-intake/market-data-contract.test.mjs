import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMarketQuote, assessQuoteFreshness } from './market-data-contract.mjs';

const now = Date.parse('2026-11-13T12:00:00Z');
const quote = overrides => ({ symbol: 'AAPL', exchange: 'NASDAQ', provider: 'Longbridge', price: 190.5, currency: 'USD', observedAt: '2026-11-13T11:59:30Z', marketDataStatus: 'real_time', ...overrides });

test('accepts a complete normalized quote', () => assert.equal(validateMarketQuote(quote()).valid, true));
test('rejects zero price and unsupported currency', () => {
  const result = validateMarketQuote(quote({ price: 0, currency: 'XYZ' }));
  assert.deepEqual(result.errors.map(e => e.field).sort(), ['currency', 'price']);
});
test('marks recent real-time quote fresh', () => assert.equal(assessQuoteFreshness(quote(), now).freshness, 'fresh'));
test('marks old real-time quote stale and unusable', () => {
  const result = assessQuoteFreshness(quote({ observedAt: '2026-11-13T11:50:00Z' }), now);
  assert.equal(result.freshness, 'stale'); assert.equal(result.usable, false);
});
test('preserves delayed status rather than presenting it as real-time', () => {
  const result = assessQuoteFreshness(quote({ marketDataStatus: 'delayed' }), now);
  assert.equal(result.freshness, 'delayed'); assert.equal(result.usable, true);
});
test('rejects materially future-dated quotes', () => {
  const result = assessQuoteFreshness(quote({ observedAt: '2026-11-13T12:05:00Z' }), now);
  assert.equal(result.freshness, 'future_timestamp'); assert.equal(result.usable, false);
});

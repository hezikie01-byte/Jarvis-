import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityCandles } from './activity-candles.mjs';

const event = (id, type, amount, occurredAt, extra = {}) => ({ id, type, amount, occurredAt, currency: 'ILS', status: 'confirmed', ...extra });

test('builds deterministic OHLC from confirmed events in a period', () => {
  const candles = buildActivityCandles([
    event('a', 'income', 2000, '2026-11-01T08:00:00Z'),
    event('b', 'expense', 500, '2026-11-01T10:00:00Z')
  ], { currency: 'ILS', interval: 'day' });
  assert.equal(candles.length, 1);
  assert.deepEqual([candles[0].open, candles[0].high, candles[0].low, candles[0].close], [1000, 1002, 1000, 1001.5]);
  assert.equal(candles[0].netMovement, 1500);
});

test('ignores pending, internal transfers and valuation snapshots', () => {
  const candles = buildActivityCandles([
    event('pending', 'income', 9000, '2026-11-01T08:00:00Z', { status: 'pending' }),
    event('transfer', 'internal_transfer', 500, '2026-11-01T09:00:00Z'),
    event('valuation', 'valuation_snapshot', 7000, '2026-11-01T10:00:00Z')
  ], { currency: 'ILS' });
  assert.deepEqual(candles, []);
});

test('does not invent flat candles for missing dates', () => {
  const candles = buildActivityCandles([
    event('a', 'income', 1000, '2026-11-01T08:00:00Z'),
    event('b', 'expense', 1000, '2026-11-04T08:00:00Z')
  ], { currency: 'ILS', interval: 'day' });
  assert.deepEqual(candles.map(c => c.period), ['2026-11-01', '2026-11-04']);
});

test('rejects mixed currencies instead of silently combining them', () => {
  assert.throws(() => buildActivityCandles([
    event('a', 'income', 10, '2026-11-01T08:00:00Z'),
    event('b', 'income', 10, '2026-11-01T09:00:00Z', { currency: 'USD' })
  ], { currency: 'ILS' }), /Mixed currencies/);
});

test('rejects undated confirmed events and negative amounts', () => {
  assert.throws(() => buildActivityCandles([event('a', 'income', 10, 'bad-date')], { currency: 'ILS' }), /valid occurredAt/);
  assert.throws(() => buildActivityCandles([event('b', 'income', -2, '2026-11-01T08:00:00Z')], { currency: 'ILS' }), /non-negative/);
});

test('marks the series as an actual derived activity metric, not simulation', () => {
  const [candle] = buildActivityCandles([event('a', 'deal_receipt', 100, '2026-11-01T08:00:00Z')], { currency: 'ILS' });
  assert.equal(candle.isSimulation, false);
  assert.equal(candle.metric, 'net_cash_activity_index');
  assert.match(candle.meaning, /not account balance/);
});

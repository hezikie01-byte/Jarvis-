import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTransactionCandidate, parseUnambiguousNumber, transactionFingerprint, prepareTransactionForReview } from './transaction-intake.mjs';

const valid = () => ({ symbol: 'AAPL', name: 'Apple Inc.', side: 'buy', quantity: 2, unitPrice: 190.5, currency: 'USD', fees: 1, executedAt: '2026-11-13T10:15:00-05:00', source: 'broker_screenshot', broker: 'Example Broker', confidence: 0.98, rawText: 'synthetic OCR text' });

test('accepts a well-formed candidate but does not persist it', () => {
  const result = prepareTransactionForReview(valid());
  assert.equal(result.status, 'pending_review');
  assert.equal(result.candidate.persistenceAllowed, false);
  assert.equal(result.candidate.reviewRequired, true);
});

test('rejects missing or invalid financial fields', () => {
  const candidate = valid(); candidate.quantity = 0; candidate.currency = 'XYZ'; candidate.side = 'transfer';
  const result = validateTransactionCandidate(candidate);
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map(e => e.field).sort(), ['currency', 'quantity', 'side']);
});

test('rejects impossible calendar dates', () => {
  const candidate = valid(); candidate.executedAt = '2026-02-31T10:15:00Z';
  assert.equal(validateTransactionCandidate(candidate).valid, false);
});

test('parses unambiguous numeric text', () => {
  assert.deepEqual(parseUnambiguousNumber(' 190.50 '), { ok: true, value: 190.5 });
  assert.deepEqual(parseUnambiguousNumber('₪190.50'), { ok: true, value: 190.5 });
});

test('does not guess comma decimal/thousands formats', () => {
  assert.equal(parseUnambiguousNumber('1,234.56').ok, false);
  assert.equal(parseUnambiguousNumber('190,50').ok, false);
});

test('flags an exact fingerprint match as a possible duplicate', () => {
  const candidate = valid(); const fingerprint = transactionFingerprint(candidate);
  const result = prepareTransactionForReview(candidate, [fingerprint]);
  assert.equal(result.possibleDuplicate, true);
});

test('normalizes symbol and broker without altering amounts', () => {
  const candidate = valid(); candidate.symbol = ' aapl '; candidate.broker = ' Example Broker ';
  const result = prepareTransactionForReview(candidate);
  assert.equal(result.candidate.symbol, 'AAPL');
  assert.equal(result.candidate.broker, 'Example Broker');
  assert.equal(result.candidate.unitPrice, 190.5);
});

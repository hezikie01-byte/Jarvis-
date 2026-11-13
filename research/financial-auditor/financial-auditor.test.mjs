import test from 'node:test';
import assert from 'node:assert/strict';
import { auditInvestmentDeals } from './financial-auditor.mjs';

test('reports legacy unknown payments without assigning principal or interest', () => {
  const result = auditInvestmentDeals([{
    id: 'deal-a', principal: 1700, payment: 170, received: 1,
    history: [{ amount: 170, note: 'legacy receipt' }]
  }]);
  assert.equal(result.findings.some(item => item.code === 'UNCLASSIFIED_PAYMENT'), true);
  assert.equal(result.findings.some(item => item.code === 'INVALID_MIXED_ALLOCATION'), false);
});

test('detects exact duplicate receipts but does not mutate input', () => {
  const history = [
    { amount: 200, date: '2026-11-01', classification: 'interest', note: 'monthly' },
    { amount: 200, date: '2026-11-01', classification: 'interest', note: 'monthly' }
  ];
  const original = structuredClone(history);
  const result = auditInvestmentDeals([{
    id: 'deal-b', principal: 2000, payment: 200, received: 2, history
  }]);
  assert.equal(result.findings.some(item => item.code === 'POSSIBLE_DUPLICATE_PAYMENT'), true);
  assert.deepEqual(history, original);
});

test('detects invalid mixed allocation and invalid date', () => {
  const result = auditInvestmentDeals([{
    id: 'deal-c', principal: 1000, payment: 100, received: 1,
    history: [{
      amount: 100, date: '2026-02-30', classification: 'mixed',
      principalAmount: 70, interestAmount: 20
    }]
  }]);
  assert.equal(result.findings.some(item => item.code === 'INVALID_PAYMENT_DATE'), true);
  assert.equal(result.findings.some(item => item.code === 'INVALID_MIXED_ALLOCATION'), true);
});

test('rejects a non-array collection without throwing', () => {
  const result = auditInvestmentDeals(null);
  assert.equal(result.status, 'invalid_input');
  assert.equal(result.summary.findings, 1);
});

test('reports mismatch between received counter and payment history', () => {
  const result = auditInvestmentDeals([{
    id: 'deal-d', principal: 500, payment: 50, received: 3, history: []
  }]);
  assert.equal(result.findings.some(item => item.code === 'RECEIVED_COUNT_MISMATCH'), true);
});

test('accepts the current app seed shape, including an undated legacy receipt', () => {
  const result = auditInvestmentDeals([{
    id: 'weekly-declining', title: 'Weekly loan', kind: 'declining',
    principal: 1700, payment: 170, cadence: 'weekly', dueLabel: 'Thursday',
    received: 1, remaining: 11, source: 'Reinvested proceeds',
    history: [{ amount: 170, note: 'First receipt' }]
  }]);
  assert.equal(result.status, 'completed');
  assert.equal(result.findings.some(item => item.severity === 'critical'), false);
  assert.equal(result.findings.some(item => item.code === 'INVALID_DEAL_FIELD'), false);
  assert.equal(result.findings.some(item => item.code === 'UNCLASSIFIED_PAYMENT'), true);
});

test('validates app-specific deal fields and payment note types', () => {
  const result = auditInvestmentDeals([{
    id: 'bad-shape', title: '', kind: 'other', principal: 10, payment: 1,
    cadence: 'daily', dueLabel: 'Today', received: 0, remaining: -1,
    source: 'test', history: [{ amount: 1, note: 42 }]
  }]);
  const codes = result.findings.map(item => item.code);
  assert.equal(codes.includes('INVALID_DEAL_FIELD'), true);
  assert.equal(codes.includes('INVALID_DEAL_KIND'), true);
  assert.equal(codes.includes('INVALID_DEAL_CADENCE'), true);
  assert.equal(codes.includes('INVALID_REMAINING_COUNT'), true);
  assert.equal(codes.includes('INVALID_PAYMENT_NOTE'), true);
});

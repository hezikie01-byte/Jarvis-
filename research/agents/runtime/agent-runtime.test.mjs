import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS, resolveAgent, buildAgentContext, buildResponsesRequest, extractResponseText, estimateCostUsd, sanitizeAgentResult } from './agent-runtime.mjs';

test('seven profiles have explicit model IDs', () => {
  assert.equal(Object.keys(AGENTS).length, 7);
  assert.equal(AGENTS.cashflow_forecaster.modelId, 'gpt-6-luna');
  assert.equal(AGENTS.financial_data_auditor.modelId, 'gpt-6.1-sol');
});
test('domain routing and role boundaries are enforced', () => {
  assert.equal(resolveAgent({ domain: 'deal_analysis' }).key, 'deal_performance_analyst');
  assert.throws(() => resolveAgent({ domain: 'unknown' }), /unsupported_agent/);
  assert.throws(() => resolveAgent({ agentKey: 'manager' }), /unsupported_agent/);
  assert.throws(() => resolveAgent({ agentKey: 'cashflow_forecaster', domain: 'operations' }), /agent_domain_mismatch/);
});
test('synthetic transactions are excluded', () => {
  const c = buildAgentContext({ transactions: [{ amount: 10, origin: 'manual' }, { amount: 999, origin: 'synthetic' }] }, 'financial_audit');
  assert.equal(c.transactions.length, 1);
});
test('undated transactions are not used as dated cashflow history', () => {
  const c = buildAgentContext({ transactions: [{ amount: 10, origin: 'manual' }] }, 'cashflow');
  assert.equal(c.transactions.length, 0);
});
test('deal history is bounded to the latest 100 records', () => {
  const history = Array.from({ length: 120 }, (_, i) => ({ amount: i + 1 }));
  const c = buildAgentContext({ investmentDeals: [{ principal: 1000, history }] }, 'deal_analysis');
  assert.equal(c.deals[0].history.length, 100);
});
test('Responses request pins model, caps output tokens and disables server storage', () => {
  const r = buildResponsesRequest({ modelId: 'gpt-6.1-sol', systemPrompt: 'Read-only', task: 'Audit', context: {}, maxOutputTokens: 9000 });
  assert.equal(r.model, 'gpt-6.1-sol');
  assert.equal(r.max_output_tokens, 4000);
  assert.equal(r.store, false);
});
test('unknown model is rejected', () => {
  assert.throws(() => buildResponsesRequest({ modelId: 'made-up', systemPrompt: 'x', task: 'y', context: {} }), /unpriced_or_unapproved_model/);
  assert.throws(() => estimateCostUsd('made-up', {}), /unpriced_or_unapproved_model/);
});
test('Responses output is extracted from both supported shapes', () => {
  assert.equal(extractResponseText({ output_text: 'hello' }), 'hello');
  assert.equal(extractResponseText({ output: [{ content: [{ type: 'output_text', text: 'world' }] }] }), 'world');
});
test('proposed actions can never be represented as executed', () => {
  const r = sanitizeAgentResult(JSON.stringify({ summary: 'review', confidence: 2, proposed_actions: [{ type: 'edit_ledger' }] }));
  assert.equal(r.proposed_actions[0].execution_state, 'not_executed');
  assert.equal(r.proposed_actions[0].approval_required, true);
  assert.equal(r.confidence, 1);
});
test('plain text fallback preserves model output without fabricated structure', () => {
  const r = sanitizeAgentResult('Need more dated data.');
  assert.equal(r.format, 'plain_text');
  assert.equal(r.summary, 'Need more dated data.');
  assert.equal(r.proposed_actions.length, 0);
});
test('cost estimation uses model-specific input and output rates', () => {
  assert.equal(estimateCostUsd('gpt-6-luna', { input_tokens: 1000, output_tokens: 500 }), 0.00035);
});

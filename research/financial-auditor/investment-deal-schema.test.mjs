import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvestmentDeals } from './investment-deal-schema.mjs';
const validDeal = () => ({ id:'d1', title:'Loan', kind:'declining', principal:1700, payment:170, cadence:'weekly', dueLabel:'Thursday', received:1, remaining:11, source:'reinvested proceeds', history:[{ amount:170, note:'legacy receipt' }] });

test('accepts current seed-shaped record and legacy undated/unclassified receipt', () => assert.equal(validateInvestmentDeals([validDeal()]).valid, true));
test('rejects duplicate deal identifiers', () => { const d=validDeal(); assert.equal(validateInvestmentDeals([d,{...d}]).errors.some(x=>x.code==='duplicate_id'), true); });
test('rejects invalid amounts and enum values', () => { const d=validDeal(); d.principal=-1; d.kind='other'; d.cadence='daily'; const codes=validateInvestmentDeals([d]).errors.map(x=>x.code); assert.ok(codes.includes('invalid_amount')); assert.ok(codes.includes('invalid_kind')); assert.ok(codes.includes('invalid_cadence')); });
test('rejects invalid payment classification and mixed split', () => { const d=validDeal(); d.history=[{amount:100,classification:'mixed',principalAmount:60,interestAmount:30},{amount:2,classification:'mystery'}]; const codes=validateInvestmentDeals([d]).errors.map(x=>x.code); assert.ok(codes.includes('invalid_mixed_allocation')); assert.ok(codes.includes('invalid_classification')); });
test('rejects malformed collection and excessive deal count', () => { assert.equal(validateInvestmentDeals(null).valid,false); assert.ok(validateInvestmentDeals(Array.from({length:21},(_,i)=>({...validDeal(),id:String(i)}))).errors.some(x=>x.code==='too_many_deals')); });
test('rejects malformed history entries but does not mutate the input', () => { const d=validDeal(); d.history=[{amount:-5,note:42}]; const before=structuredClone(d); const result=validateInvestmentDeals([d]); assert.equal(result.valid,false); assert.deepEqual(d,before); });
test('allows source placeholder and preserves unknown classification semantics', () => { const d=validDeal(); d.source='טרם הוזן'; d.history=[{amount:170}]; assert.equal(validateInvestmentDeals([d]).valid,true); });

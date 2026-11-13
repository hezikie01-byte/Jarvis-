# Investment deal schema validator — test report

Date: 2026-11-13  
Runtime: Node.js v22.16.0  
Command: `node --test investment-deal-schema.test.mjs`

## Result
**7 passed, 0 failed.**

## Coverage
- Current seed-shaped deal and legacy receipt without date/classification.
- Duplicate deal IDs.
- Invalid principal amount, deal kind and cadence.
- Invalid payment classification and mixed principal/interest allocation.
- Non-array input and maximum deal count.
- Invalid payment records and input immutability.
- Placeholder source text and unknown classification compatibility.

## Scope
Synthetic fixtures only. This validator is a research prototype and has not been connected to `POST /api/state`, the live app, or user financial records. It intentionally permits legacy receipts with missing dates/classifications so it does not force invented history or block older entries. The existing backend size/array guard remains unchanged.

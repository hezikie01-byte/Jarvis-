# Screenshot Transaction Intake — Test Report

Date: 2026-11-13
Runtime: Node.js v22.16.0
Command: `node --test transaction-intake.test.mjs`

Result: **7/7 tests passed**

Coverage:
1. Valid candidate is placed in pending review and cannot persist.
2. Invalid side, quantity, and currency are rejected.
3. Impossible calendar dates are rejected.
4. Unambiguous numeric strings are parsed.
5. Ambiguous comma formats are rejected instead of guessed.
6. Exact fingerprint match is flagged as a possible duplicate.
7. Symbol/broker normalization does not alter monetary values.

All fixtures are synthetic. No live brokerage data, private user transactions, or credentials were used.

This is a research-branch prototype only. It has not been integrated into the live J.A.R.V.I.S. app and has not been deployed.

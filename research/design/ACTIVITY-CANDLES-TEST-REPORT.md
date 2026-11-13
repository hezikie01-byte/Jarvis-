# Activity Candles Prototype — Test Report

Date: 2026-11-13
Scope: deterministic derived activity candles; synthetic data only.
Status: research prototype, not integrated into J.A.R.V.I.S.

Execution: Node.js v22.16.0 — 6 tests passed, 0 failed.

Verified:
- OHLC generated deterministically from confirmed dated events.
- Pending events, internal transfers and valuation snapshots excluded.
- Missing periods remain gaps; no fabricated candles.
- Mixed currencies rejected until explicitly converted.
- Undated confirmed events and negative amounts rejected.
- Output explicitly labels the series as activity, not balance or investment return.

No production integration, live data, or user financial data used.
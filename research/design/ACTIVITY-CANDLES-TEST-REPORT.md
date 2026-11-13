# Activity Candles Prototype — Test Report

Date: 2026-11-13
Scope: deterministic derived activity candles; synthetic data only.
Status: research prototype, not integrated into J.A.R.V.I.S.

Tests:
- OHLC generated from confirmed dated events.
- Pending events, internal transfers and valuation snapshots excluded.
- Missing periods remain gaps; no fabricated candles.
- Mixed currencies rejected until explicitly converted.
- Undated confirmed events and negative amounts rejected.
- Output explicitly labels the series as activity, not balance or investment return.

Execution: pending local execution after files are committed.

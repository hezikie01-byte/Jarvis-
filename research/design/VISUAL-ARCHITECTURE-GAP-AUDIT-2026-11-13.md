# Visual/Architecture Gap Audit — Requested Financial Terminal Direction

Date: 2026-11-13
Audited AppDeploy snapshot: 1794594168910
Status: read-only audit; no live files modified.

## User-approved direction

- Actual balances and financial facts must remain authoritative and visually dominant.
- A subtle background activity index should depict the financial activity represented by each balance.
- Hypothetical simulations should be confined to candlestick indicators / a dedicated candlestick sandbox.
- Do not use simulation outputs as balance, P&L, portfolio value, loan performance, or actual transaction data.
- Keep the dark professional blue/turquoise financial-terminal style, readable on Android.
- No robot/face mascot; use the wordmark J.A.R.V.I.S. only.

## Findings in the audited snapshot

1. src/App.tsx defines simulation state (cash-flow assumptions, portfolio assumptions, shocks and scenario selectors) near lines 123–148.
2. Dashboard KPI cards around lines 607–610 render generic .sparkline decorations. They are not shown to be derived from dated ledger events, so they must not be represented as real financial activity until backed by the deterministic series service.
3. The Opportunities view around line 642 includes a separate cash-flow what-if simulator.
4. The Investments view around line 644 includes a portfolio growth simulator, market stress simulation and portfolio profile simulator.
5. The Home hero around line 600 still contains robot-face/hologram SVG markup. CSS currently hides the hologram in the mobile refinement layer, but the underlying component remains in the source.
6. The audited deployment status was ready, with no frontend/backend errors reported at audit time. This does not mean the new design has been integrated or tested.

## Required refactor plan (do not apply directly to production without review)

### A. Consolidate hypothetical work
- Move the existing cash-flow, portfolio-growth, stress-test and profile what-if controls into one dedicated Candlestick Lab.
- The Lab must show an always-visible SIMULATION label, scenario assumptions, selected interval and a clear reset action.
- Its state and outputs must be isolated from canonical transactions, deal records, balances, dashboard KPIs and exports.
- Keep the rest of the app focused on actual recorded facts, derived actual indicators and actionable analysis. No other hypothetical balance cards or simulated portfolio values on the main dashboard.

### B. Replace decorative balance-card sparklines
- Build each background trace only from dated confirmed events or genuine dated valuation snapshots.
- For cash-flow cards, use the net cash activity index and preserve inflow/outflow classification.
- For portfolio value cards, use genuine valuation snapshots; if unavailable, show contributions/withdrawals as activity, not returns.
- For private loans, use actual receipts and outstanding principal as separate concepts; do not make a private loan look like a traded security.
- Show a neutral state when history is insufficient. Do not fabricate candles, fill missing dates or animate random values.
- Keep the amount foreground clear, large and stable; the background index is low-contrast and never changes the number.

### C. Simplify the visual system
- Remove robot-face/hologram markup and unused animation rules after confirming no dependencies.
- Retain the text-only J.A.R.V.I.S. wordmark.
- Use large tabular-number KPIs, strong spacing, restrained cyan/blue accents, and readable Hebrew labels.
- Respect reduced-motion settings; no flashing, random price-like motion or decorative fake market tickers.
- On small Android screens, show two KPI cards per row only when each retains sufficient width; otherwise stack.

### D. Data and calculation architecture
- Canonical events -> validation/reconciliation -> deterministic financial calculation services -> read-only activity/valuation series -> UI view models.
- Simulation engine -> isolated hypothetical inputs -> simulation-only candle series -> Candlestick Lab.
- The UI must not compute authoritative financial amounts.
- Every derived series must expose formula version, currency, interval, source coverage, timestamps, and simulation flag.
- AI can extract and explain but cannot be the authority for financial arithmetic.

## Release gates

- Unit tests prove simulation cannot mutate canonical state.
- Integration tests prove balance cards never read simulation data.
- Visual QA on Android at 360px, 390px and tablet widths.
- Screenshot review confirms amount legibility and background activity semantics.
- Test missing dates, mixed currencies, pending events, duplicate events and zero-activity periods.
- Preserve current user data and provide a rollback snapshot before any live refactor.

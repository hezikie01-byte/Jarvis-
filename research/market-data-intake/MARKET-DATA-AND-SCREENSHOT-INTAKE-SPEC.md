# J.A.R.V.I.S. Market Data + Screenshot Transaction Intake

Date: 2026-11-13
Status: research prototype; not integrated into the live app and not deployed.

## Goal
Combine external read-only market data with owner-submitted trade evidence. A user may upload a broker screenshot, trade confirmation, or enter a trade manually. OCR proposes structured fields; the owner reviews and confirms before the canonical portfolio ledger is changed.

## Intake flow
1. Accept an image/document in a dedicated investment activity intake.
2. Preprocess images client-side (AppDeploy image.resizeIfNeeded; target <=1600px longest edge and <=2MP).
3. Run server-side OCR/extraction with a strict schema. Preserve the original attachment reference and extraction timestamp.
4. Normalize only safe fields. Reject ambiguous number formats, unknown currencies, invalid dates, and missing required values; never silently guess locale separators.
5. Create a pending-review record, not a portfolio transaction.
6. Show the original image beside the extracted values. Owner can edit each field, then explicitly confirm.
7. On confirmation, revalidate on the server, check duplicate fingerprint, append to the canonical ledger, and write an audit event. Never let OCR call a persistence route directly.

## Proposed extraction fields
- symbol, security name, side (buy/sell), quantity, unit price, currency
- fees (optional; zero only when explicitly confirmed or user accepts the default)
- execution timestamp including timezone
- broker/source label, raw OCR text, field-level confidence
- evidence attachment ID/hash and extraction version

## Safety and accounting rules
- Pending OCR candidates are not holdings and do not affect balances, average cost, P&L, or market index.
- Duplicate matches are warnings for owner review, not automatic deletion/rejection.
- Ambiguous comma/decimal separators must be corrected by the owner.
- Preserve original currency and calculate reporting-currency values only using a timestamped FX rate.
- Separate stocks/funds/ETFs from crypto and private lending deals.
- Record buys and sells as immutable ledger events; corrections use reversal/correction events, not silent overwrites.
- Do not store broker passwords, session cookies, or API tokens in screenshots or OCR text. Mask/redact where feasible and restrict image access.
- OCR output is untrusted input. Apply server-side schema validation, size limits, MIME validation, and owner-only authorization.

## Market-data boundary
Use a server-side Market Data Gateway with provider adapters. First adapter candidate: Longbridge OpenAPI for supported US/HK/CN instruments, contingent on account, OpenAPI activation, market-data entitlements, and secrets being configured securely. Crypto needs a separate provider adapter. The AI analyst receives normalized quotes with provider, exchange, currency, observedAt, and delayed/real-time status. No broker trading endpoint is enabled in this phase.

## Acceptance criteria before live integration
- Image can be uploaded and OCR fields shown without writing to portfolio state.
- Every extracted value is editable and linked to source evidence.
- Owner confirmation is mandatory.
- Invalid and ambiguous values are blocked.
- Exact/near duplicate warnings are visible.
- Tests cover validation, timezone/date handling, locale ambiguity, duplicate review, and no-persistence-before-confirmation.
- Privacy, authorization, retention, and image deletion policy are reviewed.
- A staging test uses synthetic images/data before any real account data is enabled.

## Current implementation
`transaction-intake.mjs` provides pure validation, strict numeric parsing, fingerprinting, and a pending-review envelope. It deliberately returns `persistenceAllowed: false`.

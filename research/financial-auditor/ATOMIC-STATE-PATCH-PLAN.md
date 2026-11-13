# Atomic state patch plan for J.A.R.V.I.S.

Date: 2026-11-13  
Status: SDK capability confirmed; production change not applied.

## SDK finding

The generated AppDeploy SDK reference for `database` explicitly supports:
- `db.tx.update(table, items, { patch: true })`
- top-level conditional fields through `if`
- atomic `db.transact([...])`
- patch semantics: omitted fields stay, `undefined` removes, `null` stores null
- standalone missing patch targets return false; transaction conditions/targets abort the transaction
- legacy `db.update` replaces the entire record and is unsafe for this read-modify-write use case.

## P0 remediation

### A. Change ordinary state saves to patch only fields supplied by the client

Current risk: `saveState` reads the entire state and writes a replacement record. A concurrent reminder update can be lost.

Proposed approach:
- Keep the current lookup to obtain the physical record ID.
- When the record exists, call `db.tx.update('user_state', [{ id, record: { ...input, updatedAt } }], { patch: true })`.
- Include `investmentDeals` only when it was explicitly supplied. Do not write `remindedKeys` from the API save path.
- Check the returned boolean; false is a conflict/missing target, not success. Re-read once or return a retryable conflict response; do not fall back to legacy full-record replacement.
- For first-time state creation, retain a stable chosen ID derived from the authenticated owner or another safe, deterministic key after verifying the table's current ID convention. Do not generate a second ID in the client.

### B. Change reminder state persistence to patch only reminder fields

Replace the full-record write:
`db.update('user_state', [{ id: item.id, record: { ...item, remindedKeys, updatedAt } }])`

with a patch:
`db.tx.update('user_state', [{ id: item.id, record: { remindedKeys: [...reminded], updatedAt: new Date().toISOString() } }], { patch: true })`

Check the returned boolean. This prevents reminder persistence from replacing financial and other user fields. It does not, by itself, prevent two reminder workers from sending the same notification concurrently.

## P1 delivery idempotency

A patch is not an outbox. Two overlapping workers can both read an unmarked reminder key, both send, and then both patch it. To prevent duplicate sends:
1. Create a dedicated `reminder_outbox` record using a stable deterministic ID derived from owner + reminder key.
2. Atomically claim a pending item with a conditional patch, e.g. `if: { status: 'pending' }`, and a short lease/claim token.
3. Only the successful claimant sends the notification.
4. Mark delivered after provider success; on failure, retain retryable state and use the same stable idempotency key.
5. If the notification provider supports idempotency keys, pass the stable key. Confirm SDK support before relying on provider-side deduplication.
6. Bound outbox processing and checkpoint; do not scan an unbounded table from cron.

## Required regression tests

- API state patch does not remove/overwrite a concurrent `remindedKeys` update.
- Reminder patch does not overwrite concurrent transactions, tasks, events, settings, or investmentDeals.
- Two workers racing for the same outbox item produce one successful claim.
- A failed notification leaves a retryable outbox item.
- A successful notification followed by a failed delivery-status write does not create a second external send when provider idempotency is available.
- Missing state target / failed condition is surfaced; no unsafe full-record fallback.
- Existing local-first and cloud backup behavior remains unchanged.

## Rollout gate

Implement in a branch, run unit and integration tests against the exact AppDeploy SDK revision, inspect logs, then stage a non-production snapshot. Deploy only after explicit approval. Do not migrate existing state or alter user financial records as part of this fix.

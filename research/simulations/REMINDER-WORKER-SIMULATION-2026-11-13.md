# Reminder worker concurrency simulation — 2026-11-13

## Scope
Read-only review of the live AppDeploy snapshot `1794594168910` and deterministic in-memory simulation of the two reminder-worker failure windows. No production code, financial records, or user state were changed.

## Source facts
The current `reminderWorker` reads a complete `user_state` record, sends notifications, then writes the complete record back with updated `remindedKeys`. The same backend also uses full-record `db.update` in `saveState`. The AppDeploy SDK reference documents `db.tx.update(..., { patch: true })` for field-only patches and top-level conditional fields.

## Simulation results
| Scenario | Result |
|---|---|
| Worker writes stale full-record snapshot after user saves a transaction | Reproduced lost user update |
| Worker writes only reminder fields | Concurrent user transaction preserved |
| Compare-and-swap condition checks stale `updatedAt` | Stale write rejected |
| Notification sends before reminder key persistence; persistence then fails | Duplicate delivery window reproduced |

**Result: 4 scenarios passed, 0 failed.** The script is `reminder-worker-concurrency.mjs`.

## Engineering conclusion
1. The P0 lost-update race is reproducible in a deterministic model.
2. A field-only patch prevents unrelated fields from being overwritten, but does not alone solve duplicate notifications or competing reminder workers.
3. A compare-and-swap guard rejects stale snapshots, but the worker must retry/re-read safely and avoid resending a notification that was already delivered.
4. The send-before-persist sequence has an at-least-once duplicate window. A durable outbox with stable reminder IDs and explicit delivery states is the recommended next design. Because the notification provider does not expose a confirmed idempotency/delivery receipt in the inspected integration, exactly-once delivery must not be promised; ambiguous sends should move to `needs_review`.

## Next safe implementation sequence
- Add a dedicated reminder outbox with deterministic IDs and unique reservation semantics.
- Atomically reserve/claim each reminder before sending; use bounded leases and recovery for abandoned claims.
- Persist `sent` only after provider success; preserve ambiguous outcomes as `needs_review`.
- Use field-only patch updates for reminder metadata, never full-record replacement from a stale worker snapshot.
- Add integration tests against AppDeploy DB transaction semantics and notification failure injection.
- Keep the production deployment unchanged until all tests pass and a release is explicitly approved.

## Limitations
This simulation is not an AppDeploy database integration test and does not validate actual concurrent transaction timing, notification provider delivery guarantees, or deployment behavior. The production app remains unchanged.

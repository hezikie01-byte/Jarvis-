# J.A.R.V.I.S. state concurrency risk — remediation design

Date: 2026-11-13  
Status: Confirmed source-level risk; remediation not applied.

## Evidence from current backend source

- `saveState()` reads the current `user_state` record, creates a replacement record from the request plus selected preserved fields, then writes the whole record.
- `reminderWorker` separately reads the whole record, changes `remindedKeys`, then writes `{ ...item, remindedKeys, updatedAt }`.
- Both paths can operate between the other's read and write. A reminder write based on an older snapshot can therefore overwrite newer transactions, tasks, events, goals, settings, or investment deals.
- Reminder notifications are sent before the updated `remindedKeys` are persisted, so a failed persistence step can cause the same reminder to be sent again on a later run.

## Required safe design

1. Prefer a database-supported atomic patch or compare-and-swap update. The reminder worker should update only the reminder-key field, never replace unrelated user state.
2. If the database supports version conditions, add a monotonically increasing `stateVersion`; update only when the version read is still current, otherwise re-read and retry with a bounded retry count.
3. If neither atomic patch nor conditional update is supported, use a dedicated reminder-delivery/outbox table with a unique idempotency key. Do not emulate atomicity with an in-memory lock; scheduled workers and API requests may run in different processes.
4. Persist an outbox intent before sending. Mark delivery status after provider success; retries must reuse the same idempotency key.
5. Add tests for interleaving: API save occurs after reminder read but before reminder write; reminder send succeeds but persistence fails; duplicate scheduled invocations overlap.
6. Log structured failures and retry outcomes without logging private financial values or notification contents.

## Pre-implementation gate

Before changing production code, verify the AppDeploy database SDK's supported operations for:
- atomic field-level patch,
- conditional update / compare-and-swap,
- unique constraints or insert-if-absent,
- transaction semantics.

Do not deploy a read-modify-write workaround that still replaces the complete record. Do not change the live app until the persistence guarantees are established and regression tests pass.
